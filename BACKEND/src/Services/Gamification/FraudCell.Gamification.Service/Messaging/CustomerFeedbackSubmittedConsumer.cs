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

public sealed record CustomerFeedbackSubmittedPayload(
    string CaseId, string TransactionId, string CustomerId, string? AnalystId, string? FinalDecision, int Rating, DateTimeOffset SubmittedAt);

/// <summary>
/// <c>customer.feedback.submitted</c> consumer. The 1-5 star rating measures how
/// satisfied the customer is with the process (case §4.6); it is not evidence
/// that a block was wrong, so it changes no points. Wrong blocks are scored from
/// the customer's verification answer instead (see <see cref="PointRuleEngine"/>).
/// </summary>
public sealed partial class CustomerFeedbackSubmittedConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    IServiceScopeFactory scopeFactory,
    IClock clock,
    ILogger<CustomerFeedbackSubmittedConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    private const string ConsumerName = "gamification-service";

    protected override string QueueName => "gamification.customer-feedback-submitted";

    protected override IReadOnlyCollection<string> RoutingKeys => [$"{GamificationEventTypes.CustomerFeedbackSubmitted}.v1"];

    protected override async Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GamificationServiceDbContext>();

        var alreadyProcessed = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId && m.ConsumerName == ConsumerName, cancellationToken);
        if (alreadyProcessed)
        {
            return;
        }

        var payload = envelope.PayloadAs<CustomerFeedbackSubmittedPayload>();
        var now = clock.UtcNow;
        LogFeedbackReceived(logger, payload.CaseId, payload.Rating);

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

    [LoggerMessage(Level = LogLevel.Information, Message = "Customer rated case {CaseId} with {Rating} star(s).")]
    private static partial void LogFeedbackReceived(ILogger logger, string caseId, int rating);
}
