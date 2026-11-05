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

public sealed record AiAssessmentFailedPayload(string TransactionId, string Reason);

/// <summary>
/// <c>ai.assessment.failed</c> tuketicisi. AI Service teknik/model hatasi
/// bildirdiginde watchdog ile AYNI guvenli fallback uygulanir.
/// </summary>
public sealed class AiAssessmentFailedConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<AiAssessmentFailedConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "transaction-service";

    protected override string QueueName => "transaction.ai-assessment-failed";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{TransactionEventTypes.AiAssessmentFailed}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        var fallbackCreator = scope.ServiceProvider.GetRequiredService<ManualFallbackCaseCreator>();

        var alreadyProcessed = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);
        if (alreadyProcessed)
        {
            return;
        }

        var payload = envelope.PayloadAs<AiAssessmentFailedPayload>();
        var now = clock.UtcNow;

        var fraudTransaction = await db.Transactions.SingleOrDefaultAsync(t => t.Id == payload.TransactionId, cancellationToken);
        if (fraudTransaction is not null && fraudTransaction.AssessmentStatus == AssessmentStatus.PENDING)
        {
            fraudTransaction.MarkAssessmentFailed(now);
            await fallbackCreator.CreateAsync(fraudTransaction, now, cancellationToken);
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
