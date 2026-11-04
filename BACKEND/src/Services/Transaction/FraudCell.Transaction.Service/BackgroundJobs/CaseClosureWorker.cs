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
/// Dokuman §29-31: final karardan (ONAYLANDI/BLOKLANDI) 48 saat sonra vakayi
/// KAPANDI yapar. <c>FOR UPDATE SKIP LOCKED</c> ile birden fazla instance'in
/// ayni vakayi ikinci kez kapatmasi engellenir.
/// </summary>
public sealed partial class CaseClosureWorker(IServiceScopeFactory scopeFactory, IClock clock, ILogger<CaseClosureWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(5);

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
                LogClosureCycleFailed(logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<OutboxWriter>();

        var now = clock.UtcNow;

        await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var dueCases = await db.RiskCases
            .FromSql(
                $"""
                 SELECT * FROM txn.risk_cases
                 WHERE status IN ('ONAYLANDI', 'BLOKLANDI')
                   AND closure_due_at <= {now}
                   AND closed_at IS NULL
                 ORDER BY closure_due_at
                 LIMIT 50
                 FOR UPDATE SKIP LOCKED
                 """)
            .ToListAsync(cancellationToken);

        foreach (var riskCase in dueCases)
        {
            riskCase.Close(now);
            outboxWriter.Enqueue(TransactionEventTypes.CaseClosed, riskCase.Id, new { caseId = riskCase.Id, closedAt = now });
        }

        if (dueCases.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            LogCasesClosed(logger, dueCases.Count);
        }

        await dbTransaction.CommitAsync(cancellationToken);
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Case closure cycle failed; will retry next interval.")]
    private static partial void LogClosureCycleFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information, Message = "Closed {Count} case(s) after 48h retention.")]
    private static partial void LogCasesClosed(ILogger logger, int count);
}
