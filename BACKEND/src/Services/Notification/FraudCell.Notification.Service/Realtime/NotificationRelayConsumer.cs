using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using Microsoft.Extensions.Options;

namespace FraudCell.Notification.Service.Realtime;

public sealed record NotificationRequestedPayload(
    string TargetUserId,
    string NotificationType,
    string Title,
    string Message,
    string? ResourceType,
    string? ResourceId,
    DateTimeOffset OccurredAt);

public sealed class NotificationRelayConsumer(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    NotificationHub hub,
    ILogger<NotificationRelayConsumer> logger)
    : RabbitMqConsumerHostedService(connectionProvider, options, logger)
{
    protected override string QueueName => "notification.user-notifications";

    protected override IReadOnlyCollection<string> RoutingKeys => ["user.notification.requested.v1"];

    protected override Task HandleAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        var payload = envelope.PayloadAs<NotificationRequestedPayload>();
        hub.Publish(payload.TargetUserId, new RealtimeNotification(
            envelope.EventId,
            "notification.received",
            new RealtimeNotificationData(
                payload.NotificationType,
                payload.Title,
                payload.Message,
                payload.ResourceType,
                payload.ResourceId,
                payload.OccurredAt)));
        return Task.CompletedTask;
    }
}
