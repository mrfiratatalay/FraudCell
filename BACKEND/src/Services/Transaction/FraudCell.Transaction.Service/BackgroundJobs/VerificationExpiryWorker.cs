using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FraudCell.Transaction.Service.BackgroundJobs;

/// <summary>
/// Dokuman §23.2: musteri dogrulama suresi dolduginda vaka otomatik olarak
/// INCELENIYOR durumuna doner; nihai karar otomatik verilmez.
/// </summary>
public sealed partial class VerificationExpiryWorker(IServiceScopeFactory scopeFactory, IClock clock, ILogger<VerificationExpiryWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(30);

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
                LogExpiryCycleFailed(logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();

        var now = clock.UtcNow;

        var expired = await db.CustomerVerifications
            .Where(v => v.Status == VerificationStatus.PENDING && v.ExpiresAt <= now)
            .Take(50)
            .ToListAsync(cancellationToken);

        foreach (var verification in expired)
        {
            verification.Status = VerificationStatus.EXPIRED;
            verification.Response = VerificationResponse.NO_RESPONSE;
            verification.RespondedAt = now;

            var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == verification.CaseId, cancellationToken);
            if (riskCase is { Status: CaseStatus.MUSTERI_DOGRULAMA })
            {
                riskCase.ResumeReviewAfterVerification(now);
            }
        }

        if (expired.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            LogVerificationsExpired(logger, expired.Count);
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Verification expiry cycle failed; will retry next interval.")]
    private static partial void LogExpiryCycleFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information, Message = "Expired {Count} pending customer verification(s).")]
    private static partial void LogVerificationsExpired(ILogger logger, int count);
}
