using System.Collections.Concurrent;
using System.Security.Cryptography;
using FraudCell.BuildingBlocks.Time;

namespace FraudCell.Notification.Service.Realtime;

public sealed record StreamTicket(string Value, DateTimeOffset ExpiresAt);

public sealed class StreamTicketStore(IClock clock)
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);
    private readonly ConcurrentDictionary<string, TicketEntry> _tickets = new(StringComparer.Ordinal);

    public StreamTicket Issue(string userId)
    {
        var now = clock.UtcNow;
        foreach (var stale in _tickets.Where(pair => pair.Value.ExpiresAt <= now))
        {
            _tickets.TryRemove(stale.Key, out _);
        }

        var value = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        var expiresAt = now.Add(Lifetime);
        _tickets[value] = new TicketEntry(userId, expiresAt);
        return new StreamTicket(value, expiresAt);
    }

    public bool TryConsume(string value, out string userId)
    {
        userId = string.Empty;
        if (string.IsNullOrWhiteSpace(value) || !_tickets.TryRemove(value, out var ticket))
        {
            return false;
        }

        if (ticket.ExpiresAt <= clock.UtcNow)
        {
            return false;
        }

        userId = ticket.UserId;
        return true;
    }

    private sealed record TicketEntry(string UserId, DateTimeOffset ExpiresAt);
}
