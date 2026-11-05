using System.Collections.Concurrent;
using System.Threading.Channels;

namespace FraudCell.Notification.Service.Realtime;

public sealed record RealtimeNotificationData(
    string NotificationType,
    string Title,
    string Message,
    string? ResourceType,
    string? ResourceId,
    DateTimeOffset OccurredAt);

public sealed record RealtimeNotification(string Id, string Type, RealtimeNotificationData Data);

public sealed class NotificationHub
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, Channel<RealtimeNotification>>> _subscribers = new(StringComparer.Ordinal);

    public NotificationSubscription Subscribe(string userId)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<RealtimeNotification>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
        var userSubscriptions = _subscribers.GetOrAdd(userId, _ => new ConcurrentDictionary<Guid, Channel<RealtimeNotification>>());
        userSubscriptions[id] = channel;
        return new NotificationSubscription(channel.Reader, () => Remove(userId, id));
    }

    public void Publish(string userId, RealtimeNotification notification)
    {
        if (!_subscribers.TryGetValue(userId, out var subscriptions))
        {
            return;
        }

        foreach (var channel in subscriptions.Values)
        {
            channel.Writer.TryWrite(notification);
        }
    }

    private void Remove(string userId, Guid id)
    {
        if (!_subscribers.TryGetValue(userId, out var subscriptions))
        {
            return;
        }

        if (subscriptions.TryRemove(id, out var channel))
        {
            channel.Writer.TryComplete();
        }

        if (subscriptions.IsEmpty)
        {
            _subscribers.TryRemove(userId, out _);
        }
    }
}

public sealed class NotificationSubscription(ChannelReader<RealtimeNotification> reader, Action dispose) : IAsyncDisposable
{
    public ChannelReader<RealtimeNotification> Reader { get; } = reader;

    public ValueTask DisposeAsync()
    {
        dispose();
        return ValueTask.CompletedTask;
    }
}
