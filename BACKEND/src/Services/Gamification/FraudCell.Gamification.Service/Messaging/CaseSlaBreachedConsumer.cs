using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.Gamification.Service.Messaging;

public sealed record CaseSlaBreachedPayload(string CaseId, string? AnalystId, string SlaPriority, DateTimeOffset BreachedAt);

/// <summary><c>case.sla.breached</c> tuketicisi: atanmis analiste -5 ceza uygular.</summary>
public sealed class CaseSlaBreachedConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<CaseSlaBreachedConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "gamification-service";

    protected override string QueueName => "gamification.case-sla-breached";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{GamificationEventTypes.CaseSlaBreached}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GamificationServiceDbContext>();
        var engine = scope.ServiceProvider.GetRequiredService<PointRuleEngine>();

        var alreadyProcessed = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);
        if (alreadyProcessed)
        {
            return;
        }

        var payload = envelope.PayloadAs<CaseSlaBreachedPayload>();
        var now = clock.UtcNow;

        if (!string.IsNullOrWhiteSpace(payload.AnalystId))
        {
            await engine.ApplySlaBreachPenaltyAsync(envelope.EventId, payload.AnalystId, payload.CaseId, payload.BreachedAt, now, cancellationToken);
        }

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
