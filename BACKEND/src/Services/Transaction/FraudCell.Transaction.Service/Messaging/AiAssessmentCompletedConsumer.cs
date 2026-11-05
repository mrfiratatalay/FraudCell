using System.Text.Json;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.Transaction.Service.Messaging;

public sealed record ReasonCodePayload(string Code, string Label, string Impact);

public sealed record AnalystCandidatePayload(string AnalystId, int Rank, decimal Score, decimal ExpertiseScore, decimal CapacityScore, decimal PerformanceScore);

public sealed record AiAssessmentCompletedPayload(
    string TransactionId,
    string AssessmentId,
    decimal RiskScore,
    FraudType FraudType,
    string ModelVersion,
    IReadOnlyList<ReasonCodePayload> ReasonCodes,
    IReadOnlyList<AnalystCandidatePayload> AnalystCandidates);

/// <summary>
/// <c>ai.assessment.completed</c> tuketicisi (dokuman `02-ARCHITECTURE-OVERVIEW.md`
/// §14-15). AI'nin risk skorunu Transaction Service'in KENDI esik politikasiyla
/// (dokuman §10-11) uygular; AI yalnizca oneri sunar (dokuman `04-SERVICE-BOUNDARIES.md` §9.9).
///
/// Tum islem TEK bir explicit transaction icinde yapilir (dokuman §60.2):
/// inbox + ai_assessments + transactions + risk_cases + case_assignments +
/// analyst_workloads + case_transitions + outbox, hepsi ya birlikte commit
/// olur ya da hic olmaz.
/// </summary>
public sealed class AiAssessmentCompletedConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<AiAssessmentCompletedConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "transaction-service";

    protected override string QueueName => "transaction.ai-assessment-completed";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{TransactionEventTypes.AiAssessmentCompleted}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<OutboxWriter>();
        var crossCutting = scope.ServiceProvider.GetRequiredService<CrossCuttingEventPublisher>();
        var assignmentService = scope.ServiceProvider.GetRequiredService<AssignmentService>();

        await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var alreadyProcessed = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);
        if (alreadyProcessed)
        {
            await dbTransaction.CommitAsync(cancellationToken);
            return;
        }

        var payload = envelope.PayloadAs<AiAssessmentCompletedPayload>();
        var now = clock.UtcNow;

        var fraudTransaction = await db.Transactions.SingleOrDefaultAsync(t => t.Id == payload.TransactionId, cancellationToken);
        if (fraudTransaction is null)
        {
            logger.LogError("ai.assessment.completed received for unknown transaction {TransactionId}.", payload.TransactionId);
            await RecordInboxAsync(db, envelope, now, cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
            return;
        }

        var riskScore = payload.RiskScore;
        var riskLevel = RiskThresholds.MapRiskLevel(riskScore);
        var decision = RiskThresholds.MapDecision(riskScore);

        var hasPrimary = await db.AiAssessments.AnyAsync(a => a.TransactionId == payload.TransactionId && a.IsPrimary, cancellationToken);
        var isLate = now > fraudTransaction.AssessmentDeadlineAt;

        var assessment = new AiAssessment
        {
            Id = Ulid.NewUlid().ToString(),
            ExternalAssessmentId = payload.AssessmentId,
            TransactionId = payload.TransactionId,
            SourceEventId = envelope.EventId,
            RiskScore = riskScore,
            RiskLevel = riskLevel,
            Decision = decision,
            FraudType = payload.FraudType,
            ModelVersion = payload.ModelVersion,
            ReasonCodesJson = JsonSerializer.Serialize(payload.ReasonCodes, JsonDefaults.Events),
            AnalystCandidatesJson = JsonSerializer.Serialize(payload.AnalystCandidates, JsonDefaults.Events),
            AssessedAt = envelope.OccurredAt,
            ReceivedAt = now,
            IsLate = isLate,
            IsPrimary = !hasPrimary,
            PayloadHash = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(envelope.Payload.GetRawText()))),
            CreatedAt = now,
        };

        db.AiAssessments.Add(assessment);

        if (fraudTransaction.AssessmentStatus == AssessmentStatus.PENDING)
        {
            await ApplyPrimaryAssessmentAsync(db, outboxWriter, crossCutting, assignmentService, fraudTransaction, assessment, payload, now, cancellationToken);
        }
        else if (fraudTransaction.AssessmentStatus is AssessmentStatus.TIMED_OUT or AssessmentStatus.FAILED)
        {
            await ApplyLateAssessmentAsync(db, fraudTransaction, assessment, now, cancellationToken);
        }

        // AssessmentStatus == COMPLETED: ayni transaction icin ikinci gercek
        // degerlendirme normalde olusmaz; olusursa snapshot yalnizca audit icin saklanir.

        await RecordInboxAsync(db, envelope, now, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);
    }

    private static async Task ApplyPrimaryAssessmentAsync(
        TransactionServiceDbContext db, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting, AssignmentService assignmentService,
        Domain.FraudTransaction fraudTransaction, AiAssessment assessment, AiAssessmentCompletedPayload payload, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var riskLevel = assessment.RiskLevel;
        var decision = assessment.Decision;

        fraudTransaction.ApplyAssessment(assessment.RiskScore, riskLevel, decision, assessment.FraudType, now);

        crossCutting.PublishNotification(fraudTransaction.CustomerId, "AI_ASSESSMENT_COMPLETED",
            "İşlem değerlendirmesi tamamlandı", "İşlem değerlendirmesi tamamlandı.", "TRANSACTION", fraudTransaction.Id);

        if (decision == ScreeningDecision.ONAY)
        {
            outboxWriter.Enqueue(TransactionEventTypes.TransactionApproved, fraudTransaction.Id, new { transactionId = fraudTransaction.Id, approvedAt = now });
            return;
        }

        var riskCase = new RiskCase
        {
            Id = Ulid.NewUlid().ToString(),
            TransactionId = fraudTransaction.Id,
            CustomerId = fraudTransaction.CustomerId,
            PrimaryAssessmentId = assessment.Id,
            EffectiveRiskScore = assessment.RiskScore,
            EffectiveRiskLevel = riskLevel,
            EffectiveFraudType = assessment.FraudType,
            SlaStartedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        };

        riskCase.StartSla(RiskThresholds.MapSlaPriority(riskLevel), now);

        if (decision == ScreeningDecision.BLOK)
        {
            fraudTransaction.MarkTemporarilyBlocked(now);

            db.TemporaryBlocks.Add(new TemporaryBlock
            {
                Id = Ulid.NewUlid().ToString(),
                TransactionId = fraudTransaction.Id,
                Reason = TemporaryBlockReason.AI_CRITICAL_RISK,
                AppliedBy = null,
                SourceEventId = assessment.SourceEventId,
                AppliedAt = now,
                CreatedAt = now,
            });

            outboxWriter.Enqueue(TransactionEventTypes.TransactionTemporarilyBlocked, fraudTransaction.Id, new { transactionId = fraudTransaction.Id, blockedAt = now });
            crossCutting.PublishNotification(fraudTransaction.CustomerId, "SUSPICIOUS_TRANSACTION_DETECTED",
                "Şüpheli işlem tespit edildi", "İşleminiz güvenlik nedeniyle geçici olarak durduruldu.", "TRANSACTION", fraudTransaction.Id);
        }

        db.RiskCases.Add(riskCase);

        var candidates = payload.AnalystCandidates
            .Select(c => new AnalystCandidate(c.AnalystId, c.Rank, c.Score, c.ExpertiseScore, c.CapacityScore, c.PerformanceScore))
            .ToList();

        var assignedAnalystId = candidates.Count > 0
            ? await assignmentService.TryAssignFirstEligibleAsync(candidates, now, cancellationToken)
            : null;

        if (assignedAnalystId is not null)
        {
            riskCase.Assign(assignedAnalystId, now);

            db.CaseAssignments.Add(new CaseAssignment
            {
                Id = Ulid.NewUlid().ToString(),
                CaseId = riskCase.Id,
                AnalystId = assignedAnalystId,
                AssignmentSource = AssignmentSource.AI_RECOMMENDATION,
                AssignedAt = now,
                CreatedAt = now,
            });

            outboxWriter.Enqueue(TransactionEventTypes.CaseAssigned, riskCase.Id, new
            {
                caseId = riskCase.Id,
                analystId = assignedAnalystId,
                assignmentSource = "AI_RECOMMENDATION",
                assignedAt = now,
            });

            crossCutting.PublishNotification(assignedAnalystId, "CASE_ASSIGNED", "Yeni vaka atandı", "Size yeni bir risk vakası atandı.", "CASE", riskCase.Id);
        }
        else
        {
            riskCase.EnqueueForAssignment(manual: false, now);
            outboxWriter.Enqueue(TransactionEventTypes.CaseAssignmentQueued, riskCase.Id, new { caseId = riskCase.Id, queuedAt = now });
        }

        outboxWriter.Enqueue(TransactionEventTypes.CaseCreated, riskCase.Id, new
        {
            caseId = riskCase.Id,
            transactionId = fraudTransaction.Id,
            customerId = fraudTransaction.CustomerId,
            riskLevel = riskLevel.ToString(),
            fraudType = assessment.FraudType.ToString(),
            slaPriority = riskCase.SlaPriority.ToString(),
            slaDeadlineAt = riskCase.SlaDeadlineAt,
            createdAt = now,
        });

        crossCutting.PublishAudit(null, null, "RISK_CASE_CREATED", "SUCCESS", "risk_case", riskCase.Id, null,
            new { riskScore = assessment.RiskScore, riskLevel = riskLevel.ToString(), decision = decision.ToString() });
    }

    private static async Task ApplyLateAssessmentAsync(
        TransactionServiceDbContext db, Domain.FraudTransaction fraudTransaction, AiAssessment assessment, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // Dokuman §43: gec gelen AI sonucu manuel fallback nedenini kaldirmaz;
        // evidence olarak uygulanir. Manuel review case zaten olusturulmustur (watchdog).
        fraudTransaction.ApplyLateAssessmentEvidence(assessment.RiskScore, assessment.RiskLevel, assessment.FraudType, now);

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.TransactionId == fraudTransaction.Id, cancellationToken);
        riskCase?.ApplyLateEvidence(assessment.RiskScore, assessment.RiskLevel, assessment.FraudType, now);
    }

    private static async Task RecordInboxAsync(TransactionServiceDbContext db, EventEnvelope envelope, DateTimeOffset now, CancellationToken cancellationToken)
    {
        db.InboxMessages.Add(new InboxMessage
        {
            EventId = envelope.EventId,
            ConsumerName = ConsumerName,
            EventType = envelope.EventType,
            ProcessedAt = now,
            CorrelationId = envelope.CorrelationId,
        });

        await Task.CompletedTask;
    }
}
