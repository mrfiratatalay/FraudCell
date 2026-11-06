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
/// AI degerlendirmesi belirlenen
/// sure icinde gelmezse (varsayilan 2sn) islemi <c>TIMED_OUT</c> isaretler ve
/// manuel inceleme vakasi olusturur. Bu, "AI kapaliyken islem kaybolmaz"
/// gereksiniminin calisma zamani kanitidir.
/// </summary>
public sealed class AssessmentWatchdogWorker(IServiceScopeFactory scopeFactory, IClock clock, ILogger<AssessmentWatchdogWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(1);

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
                logger.LogError(ex, "Assessment watchdog cycle failed; will retry next interval.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<OutboxWriter>();
        var fallbackCreator = scope.ServiceProvider.GetRequiredService<ManualFallbackCaseCreator>();

        var now = clock.UtcNow;

        var overdueIds = await db.Transactions
            .Where(t => t.AssessmentStatus == AssessmentStatus.PENDING && t.AssessmentDeadlineAt <= now)
            .Select(t => t.Id)
            .Take(50)
            .ToListAsync(cancellationToken);

        foreach (var transactionId in overdueIds)
        {
            await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

            var fraudTransaction = await db.Transactions.SingleOrDefaultAsync(t => t.Id == transactionId, cancellationToken);
            if (fraudTransaction is null || fraudTransaction.AssessmentStatus != AssessmentStatus.PENDING)
            {
                // AI sonucu bu arada geldi (yaris durumu); watchdog'un yapacagi bir sey yok.
                await dbTransaction.RollbackAsync(cancellationToken);
                continue;
            }

            fraudTransaction.MarkAssessmentTimedOut(now);
            await fallbackCreator.CreateAsync(fraudTransaction, now, cancellationToken);

            outboxWriter.Enqueue(TransactionEventTypes.TransactionAssessmentTimedOut, transactionId, new { transactionId, timedOutAt = now });

            await db.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);

            logger.LogWarning("Transaction {TransactionId} assessment timed out; routed to manual review.", transactionId);
        }
    }
}
