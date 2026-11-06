using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;

namespace FraudCell.Identity.Service.Common;

/// <summary>
/// Identity Service audit persistence otoritesidir (dokuman
/// kendi eylemlerini dogrudan yazar, baska
/// servislerin eylemlerini ise <c>audit.entry.requested</c> tuketicisi
/// araciligiyla yazar (bkz. Messaging/AuditEntryRequestedConsumer).
///
/// <c>SaveChangesAsync</c> CAGIRMAZ; cagiran kod business degisiklikleriyle
/// birlikte tek transaction'da commit eder.
/// </summary>
public sealed class AuditWriter(IdentityServiceDbContext db, IClock clock, CorrelationContext correlation)
{
    public void Record(
        string? actorId,
        string? actorRole,
        string action,
        AuditResult result,
        string? resourceType = null,
        string? resourceId = null,
        string? ipAddress = null,
        string? detailsJson = null)
    {
        var now = clock.UtcNow;

        db.AuditLogs.Add(new AuditLog
        {
            Id = Ulid.NewUlid().ToString(),
            // Identity kendi eylemini dogrudan yazdigi icin harici bir kaynak
            // event'i yoktur; unique constraint'i saglamak icin taze bir ULID uretilir.
            SourceEventId = Ulid.NewUlid().ToString(),
            ActorId = actorId,
            ActorRole = actorRole,
            Action = action,
            SourceService = "identity-service",
            ResourceType = resourceType,
            ResourceId = resourceId,
            IpAddress = ipAddress,
            Result = result,
            OccurredAt = now,
            PersistedAt = now,
            CorrelationId = correlation.CorrelationId,
            DetailsJson = detailsJson,
        });
    }
}
