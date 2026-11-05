using System.Text.Json;
using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Messaging;

public sealed record AuditEntryRequestedPayload(
    string? ActorId,
    string? ActorRole,
    string Action,
    string SourceService,
    string? ResourceType,
    string? ResourceId,
    string? IpAddress,
    string Result,
    DateTimeOffset OccurredAt,
    JsonElement? Details);

/// <summary>
/// Diger servislerin (Transaction, AI, Gamification, Edge) yayinladigi
/// <c>audit.entry.requested</c> event'ini tuketip append-only audit kaydina
/// donusturur. Identity
/// Service audit persistence otoritesidir; bu consumer tek yazma noktasidir.
///
/// Idempotency IKI katmandadir: BuildingBlocks inbox tablosu (ayni event'in
/// consumer tarafindan tekrar islenmesini engeller) ve <c>audit_logs.source_event_id</c>
/// unique constraint'i.
/// </summary>
public sealed class AuditEntryRequestedConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<AuditEntryRequestedConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "identity-service";

    protected override string QueueName => "identity.audit-events";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{IdentityEventTypes.AuditEntryRequested}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityServiceDbContext>();

        var alreadyProcessed = await db.InboxMessages
            .AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);

        if (alreadyProcessed)
        {
            return;
        }

        var payload = envelope.PayloadAs<AuditEntryRequestedPayload>();

        if (!Enum.TryParse<AuditResult>(payload.Result, ignoreCase: true, out var result))
        {
            result = payload.Result.Equals("SUCCESS", StringComparison.OrdinalIgnoreCase)
                ? AuditResult.Success
                : AuditResult.Failure;
        }

        var now = clock.UtcNow;

        db.AuditLogs.Add(new AuditLog
        {
            Id = Ulid.NewUlid().ToString(),
            SourceEventId = envelope.EventId,
            ActorId = payload.ActorId,
            ActorRole = payload.ActorRole,
            Action = payload.Action,
            SourceService = payload.SourceService,
            ResourceType = payload.ResourceType,
            ResourceId = payload.ResourceId,
            IpAddress = payload.IpAddress,
            Result = result,
            OccurredAt = payload.OccurredAt,
            PersistedAt = now,
            CorrelationId = envelope.CorrelationId,
            DetailsJson = payload.Details?.GetRawText(),
        });

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
