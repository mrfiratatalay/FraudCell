using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FraudCell.Identity.Service.BackgroundJobs;

/// <summary>
/// Suresi dolmus OTP challenge, refresh session ve inbox kayitlarini periyodik
/// olarak temizler.
///
/// Temizlik yalnizca hacim/performans amaclidir; guvenlik kontrolleri
/// (expiry, revoked_at) zaten sorgu seviyesinde uygulanir. Bu worker
/// gecikse veya durdurulsa bile domain davranisi etkilenmez.
/// </summary>
public sealed partial class ExpiredCleanupWorker(
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<ExpiredCleanupWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan RetentionWindow = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        do
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                LogCleanupCycleFailed(logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task CleanupAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityServiceDbContext>();

        var now = clock.UtcNow;
        var retentionCutoff = now - RetentionWindow;

        var otpDeleted = await db.OtpChallenges
            .Where(c => c.ExpiresAt < retentionCutoff)
            .ExecuteDeleteAsync(cancellationToken);

        var refreshDeleted = await db.RefreshSessions
            .Where(s => s.ExpiresAt < retentionCutoff && s.RevokedAt != null)
            .ExecuteDeleteAsync(cancellationToken);

        var inboxDeleted = await db.InboxMessages
            .Where(m => m.ProcessedAt < retentionCutoff)
            .ExecuteDeleteAsync(cancellationToken);

        if (otpDeleted + refreshDeleted + inboxDeleted > 0)
        {
            LogCleanupCompleted(logger, otpDeleted, refreshDeleted, inboxDeleted);
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Expired cleanup cycle failed; will retry next interval.")]
    private static partial void LogCleanupCycleFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information, Message = "Cleanup removed {OtpDeleted} OTP challenge(s), {RefreshDeleted} refresh session(s), {InboxDeleted} inbox record(s).")]
    private static partial void LogCleanupCompleted(ILogger logger, int otpDeleted, int refreshDeleted, int inboxDeleted);
}
