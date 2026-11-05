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

public sealed record CaseDecisionMadePayload(
    string CaseId, string TransactionId, string? AnalystId, string Decision, string? FraudType,
    string? RiskLevel, decimal Amount, DateTimeOffset DecidedAt, DateTimeOffset CreatedAt, bool SlaCompliant,
    string? CustomerVerification = null);

/// <summary>
/// <c>case.decision.made</c> tuketicisi (dokuman §17 puan kurallari). Bu servis
/// puanı Transaction Service'in kararindan SONRA, event uzerinden hesaplar;
/// hicbir zaman dogrudan bir "add-points" komutu kabul etmez (dokuman §7.2).
/// </summary>
public sealed class CaseDecisionMadeConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<CaseDecisionMadeConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "gamification-service";

    protected override string QueueName => "gamification.case-decision-made";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{GamificationEventTypes.CaseDecisionMade}.v1"];

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

        var payload = envelope.PayloadAs<CaseDecisionMadePayload>();
        var now = clock.UtcNow;

        if (!string.IsNullOrWhiteSpace(payload.AnalystId))
        {
            var decision = new CaseDecision(
                envelope.EventId, payload.AnalystId, payload.CaseId, payload.FraudType, payload.RiskLevel,
                payload.SlaCompliant, payload.DecidedAt, payload.CreatedAt, payload.Decision == "BLOCK",
                payload.CustomerVerification switch
                {
                    "MINE" => CustomerVerdict.Mine,
                    "NOT_MINE" => CustomerVerdict.NotMine,
                    _ => CustomerVerdict.None,
                });
            await engine.ApplyCaseDecisionAsync(decision, now, cancellationToken);
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
