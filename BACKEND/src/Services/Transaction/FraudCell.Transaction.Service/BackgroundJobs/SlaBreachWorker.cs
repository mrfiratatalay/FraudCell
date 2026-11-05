using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FraudCell.Transaction.Service.BackgroundJobs;

/// <summary>
/// Dokuman `05-DOMAIN-AND-STATE-MACHINE.md` §38-39: SLA deadline'i gecmis ve
/// henuz final karari olmayan vakalari <c>slaBreachedAt</c> ile isaretler.
/// KRITIK vakalarda transaction'i ayrica geçici bloklar.
/// </summary>
public sealed class SlaBreachWorker(IServiceScopeFactory scopeFactory, IClock clock, ILogger<SlaBreachWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PollInterval);

        do
        {
            try
            {
                await ProcessOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "SLA breach cycle failed; will retry next interval.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<OutboxWriter>();
        var crossCutting = scope.ServiceProvider.GetRequiredService<CrossCuttingEventPublisher>();

        var now = clock.UtcNow;

        var dueIds = await db.RiskCases
            .Where(c => c.SlaDeadlineAt <= now && c.SlaBreachedAt == null && c.FinalDecision == null)
            .Select(c => c.Id)
            .Take(50)
            .ToListAsync(cancellationToken);

        foreach (var caseId in dueIds)
        {
            await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

            var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken);
            if (riskCase is null || riskCase.SlaBreachedAt is not null || riskCase.FinalDecision is not null)
            {
                await dbTransaction.RollbackAsync(cancellationToken);
                continue;
            }

            riskCase.MarkSlaBreached(now);

            if (riskCase.SlaPriority == SlaPriority.KRITIK)
            {
                var fraudTransaction = await db.Transactions.SingleAsync(t => t.Id == riskCase.TransactionId, cancellationToken);
                fraudTransaction.MarkTemporarilyBlocked(now);

                var hasBlock = await db.TemporaryBlocks.AnyAsync(
                    b => b.TransactionId == fraudTransaction.Id && b.Reason == TemporaryBlockReason.CRITICAL_SLA_BREACH && b.ReleasedAt == null, cancellationToken);

                if (!hasBlock)
                {
                    db.TemporaryBlocks.Add(new Domain.TemporaryBlock
                    {
                        Id = Ulid.NewUlid().ToString(),
                        TransactionId = fraudTransaction.Id,
                        Reason = TemporaryBlockReason.CRITICAL_SLA_BREACH,
                        AppliedAt = now,
                        CreatedAt = now,
                    });
                }
            }

            crossCutting.PublishAudit(null, null, AuditActions.SlaBreached, "SUCCESS", "risk_case", caseId, null);
            outboxWriter.Enqueue(TransactionEventTypes.CaseSlaBreached, caseId, new
            {
                caseId,
                analystId = riskCase.AssignedAnalystId,
                slaPriority = riskCase.SlaPriority.ToString(),
                breachedAt = now,
            });

            if (riskCase.AssignedAnalystId is not null)
            {
                crossCutting.PublishNotification(riskCase.AssignedAnalystId, "SLA_BREACHED", "SLA süresi aşıldı", "Atanmış vakanızın SLA süresi doldu.", "CASE", caseId);
            }

            await db.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);

            logger.LogWarning("Case {CaseId} SLA breached ({Priority}).", caseId, riskCase.SlaPriority);
        }
    }
}
