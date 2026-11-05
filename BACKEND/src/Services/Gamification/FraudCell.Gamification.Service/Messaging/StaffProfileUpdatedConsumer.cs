using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Domain;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.Gamification.Service.Messaging;

public sealed record StaffProfileUpdatedPayload(string UserId, bool IsActive, string? DisplayName, DateTimeOffset UpdatedAt);

/// <summary>
/// <c>identity.staff.profile.updated</c> tuketicisi. Identity
/// Service authoritative sahibidir; bu yalnizca leaderboard/profil gosterimi
/// icin kullanilan bir local projection'dir.
/// </summary>
public sealed class StaffProfileUpdatedConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<StaffProfileUpdatedConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "gamification-service";

    protected override string QueueName => "gamification.identity-staff-profile-updated";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{GamificationEventTypes.IdentityStaffProfileUpdated}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GamificationServiceDbContext>();

        var alreadyProcessed = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);
        if (alreadyProcessed)
        {
            return;
        }

        var payload = envelope.PayloadAs<StaffProfileUpdatedPayload>();
        var now = clock.UtcNow;

        var profile = await db.AnalystProfiles.SingleOrDefaultAsync(p => p.AnalystId == payload.UserId, cancellationToken);
        if (profile is null)
        {
            profile = new AnalystProfileProjection { AnalystId = payload.UserId, CreatedAt = now };
            db.AnalystProfiles.Add(profile);
        }

        profile.DisplayName = payload.DisplayName;
        profile.IsActive = payload.IsActive;
        profile.UpdatedAt = now;
        profile.LastSourceEventId = envelope.EventId;

        db.InboxMessages.Add(new InboxMessage
        {
            EventId = envelope.EventId,
            ConsumerName = ConsumerName,
            EventType = envelope.EventType,
            ProcessedAt = now,
            CorrelationId = envelope.CorrelationId,
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
