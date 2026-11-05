using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.Decision;

public sealed record SubmitDecisionRequest(FinalDecision Decision, string? Note, string? OverrideReason);

public sealed record SubmitDecisionSlaResponse(DateTimeOffset DeadlineAt, DateTimeOffset? StoppedAt, bool Compliant);

public sealed record SubmitDecisionResponse(
    string CaseId, string PreviousStatus, string Status, string Decision, string? DecisionNote,
    string DecidedBy, DateTimeOffset DecidedAt, string TransactionControlStatus, SubmitDecisionSlaResponse Sla,
    DateTimeOffset? ClosureDueAt, long Version);

/// <summary>
/// <c>PATCH /api/v1/cases/{caseId}/decision</c> (dokuman §44-45). INCELENIYOR
/// -&gt; ONAYLANDI/BLOKLANDI. Supervisor override icin <c>overrideReason</c> zorunludur.
/// Puan hesabi burada YAPILMAZ; Gamification sonucu SSE ile ayrica gelir.
/// </summary>
public static class SubmitDecisionEndpoint
{
    public static void MapSubmitDecision(this IEndpointRouteBuilder app)
    {
        app.MapPatch("/api/v1/cases/{caseId}/decision", HandleAsync)
           .WithName("SubmitCaseDecision")
           .WithTags("Cases")
           .ProducesApi<SubmitDecisionResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, SubmitDecisionRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting, CaseTransitionRecorder transitions,
        AssignmentService assignmentService, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();
        var isSupervisor = role == RoleNames.Supervisor;

        if (isSupervisor && string.IsNullOrWhiteSpace(request.OverrideReason))
        {
            throw AppException.Validation("Supervizor karari icin overrideReason zorunludur.");
        }

        await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        if (!isSupervisor && riskCase.AssignedAnalystId != userId)
        {
            throw AppException.NotFound();
        }

        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        var transaction = await db.Transactions.SingleAsync(t => t.Id == riskCase.TransactionId, cancellationToken);
        var now = clock.UtcNow;
        var previousStatus = riskCase.Status;
        var versionBefore = riskCase.Version;

        if (request.Decision == FinalDecision.APPROVE)
        {
            riskCase.Approve(userId, request.Note, now);
            transaction.ApproveFinal(now);

            var activeBlocks = await db.TemporaryBlocks.Where(b => b.TransactionId == transaction.Id && b.ReleasedAt == null).ToListAsync(cancellationToken);
            foreach (var block in activeBlocks)
            {
                block.ReleasedAt = now;
                block.ReleaseReason = "CASE_APPROVED";
            }
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.Note))
            {
                throw AppException.DomainRule(ErrorCodes.DecisionNoteRequired, "Blok kararinda karar notu zorunludur.");
            }

            riskCase.Block(userId, request.Note, now);
            transaction.BlockFinal(now);
        }

        if (riskCase.AssignedAnalystId is not null)
        {
            await assignmentService.ReleaseAsync(riskCase.AssignedAnalystId, now, cancellationToken);

            var activeAssignment = await db.CaseAssignments
                .Where(a => a.CaseId == caseId && (a.Status == CaseAssignmentStatus.ASSIGNED || a.Status == CaseAssignmentStatus.IN_PROGRESS))
                .SingleOrDefaultAsync(cancellationToken);

            if (activeAssignment is not null)
            {
                activeAssignment.Status = CaseAssignmentStatus.COMPLETED;
                activeAssignment.EndedAt = now;
            }
        }

        transitions.Record(riskCase, previousStatus, userId, role, isSupervisor ? TransitionSource.SUPERVISOR : TransitionSource.ANALYST,
            request.OverrideReason ?? request.Note, null, versionBefore);

        var decisionAction = request.Decision == FinalDecision.APPROVE ? AuditActions.CaseApproved : AuditActions.CaseBlocked;
        crossCutting.PublishAudit(userId, role, decisionAction, "SUCCESS", "risk_case", caseId, httpContext.GetClientIp(),
            new { previousStatus = previousStatus.ToString(), newStatus = riskCase.Status.ToString() });

        // Gamification scores a block against the customer's verification answer (case §4.5, §6.1).
        var customerVerification = await db.CustomerVerifications.AsNoTracking()
            .Where(v => v.CaseId == caseId && v.Status == VerificationStatus.ANSWERED)
            .OrderByDescending(v => v.RespondedAt)
            .Select(v => v.Response)
            .FirstOrDefaultAsync(cancellationToken);

        outboxWriter.Enqueue(TransactionEventTypes.CaseDecisionMade, caseId, new
        {
            caseId,
            transactionId = transaction.Id,
            analystId = riskCase.AssignedAnalystId,
            decision = request.Decision.ToString(),
            fraudType = riskCase.EffectiveFraudType?.ToString(),
            riskLevel = riskCase.EffectiveRiskLevel?.ToString(),
            amount = transaction.Amount,
            decidedAt = now,
            createdAt = riskCase.CreatedAt,
            slaCompliant = riskCase.SlaBreachedAt is null,
            customerVerification = customerVerification?.ToString(),
        });

        if (request.Decision == FinalDecision.APPROVE)
        {
            outboxWriter.Enqueue(TransactionEventTypes.TransactionApproved, transaction.Id, new { transactionId = transaction.Id, approvedAt = now });
        }

        crossCutting.PublishNotification(riskCase.CustomerId, "CASE_DECISION_MADE",
            request.Decision == FinalDecision.APPROVE ? "Isleminiz onaylandi" : "Isleminiz bloklandi",
            request.Decision == FinalDecision.APPROVE ? "Isleminiz incelendi ve onaylandi." : "Isleminiz guvenlik nedeniyle bloklandi.",
            "CASE", caseId);

        await db.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);

        return ApiResults.Ok(new SubmitDecisionResponse(
            riskCase.Id, previousStatus.ToString(), riskCase.Status.ToString(), request.Decision.ToString(), riskCase.DecisionNote,
            userId, riskCase.DecidedAt!.Value, transaction.ControlStatus.ToString(),
            new SubmitDecisionSlaResponse(riskCase.SlaDeadlineAt, riskCase.SlaStoppedAt, riskCase.SlaBreachedAt is null),
            riskCase.ClosureDueAt, riskCase.Version), correlation);
    }
}
