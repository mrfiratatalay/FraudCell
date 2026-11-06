using System.Text.Json;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Inbox;
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

public sealed record StaffProfileUpdatedPayload(
    string UserId, bool IsActive, bool AssignmentEnabled, string[] Specialties, string[] Regions, string? DisplayName, DateTimeOffset UpdatedAt);

/// <summary>
/// <c>identity.staff.profile.updated</c> tuketicisi.
/// Identity Service authoritative sahibidir; bu yalnizca assignment
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
    private const string ConsumerName = "transaction-service";

    protected override string QueueName => "transaction.identity-staff-profile-updated";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{TransactionEventTypes.IdentityStaffProfileUpdated}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();

        var alreadyProcessed = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);
        if (alreadyProcessed)
        {
            return;
        }

        var payload = envelope.PayloadAs<StaffProfileUpdatedPayload>();
        var now = clock.UtcNow;

        var projection = await db.AnalystEligibilityProjections.SingleOrDefaultAsync(p => p.AnalystId == payload.UserId, cancellationToken);

        if (projection is null)
        {
            projection = new AnalystEligibilityProjection
            {
                AnalystId = payload.UserId,
                SpecialtiesJson = JsonSerializer.Serialize(payload.Specialties, JsonDefaults.Events),
                RegionsJson = JsonSerializer.Serialize(payload.Regions, JsonDefaults.Events),
                LastSourceEventId = envelope.EventId,
                SourceUpdatedAt = payload.UpdatedAt,
                ProjectionUpdatedAt = now,
            };
            db.AnalystEligibilityProjections.Add(projection);
        }
        else if (payload.UpdatedAt >= projection.SourceUpdatedAt)
        {
            // Eski event yeni veriyi ezmesin.
            projection.SpecialtiesJson = JsonSerializer.Serialize(payload.Specialties, JsonDefaults.Events);
            projection.RegionsJson = JsonSerializer.Serialize(payload.Regions, JsonDefaults.Events);
            projection.SourceUpdatedAt = payload.UpdatedAt;
            projection.ProjectionUpdatedAt = now;
        }

        projection.IsActive = payload.IsActive;
        projection.AssignmentEnabled = payload.AssignmentEnabled;
        projection.DisplayName = payload.DisplayName;

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
