using System.Text;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace FraudCell.BuildingBlocks.Messaging.RabbitMq;

/// <summary>
/// Event'leri broker'a veren tek bilesen. YALNIZCA outbox worker tarafindan
/// kullanilir; business kodu dogrudan publish etmez (dokuman §46).
///
/// Kanal publisher confirm ile acilir: <c>BasicPublishAsync</c> tamamlandiginda
/// broker mesaji kabul etmis demektir. Ancak o zaman outbox satiri
/// <c>published_at</c> ile isaretlenir.
/// </summary>
public sealed partial class RabbitMqEventPublisher(
    RabbitMqConnectionProvider connectionProvider,
    IOptions<RabbitMqOptions> options,
    ILogger<RabbitMqEventPublisher> logger) : IAsyncDisposable
{
    private readonly RabbitMqOptions _options = options.Value;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private IChannel? _channel;
    private bool _disposed;

    /// <summary>
    /// Tek bir outbox kaydini yayinlar. Basarili donerse broker mesaji
    /// onaylamistir. Hata durumunda exception firlatir; cagiran kayit
    /// <c>published_at</c>'i GUNCELLEMEZ, kayit outbox'ta bekler.
    /// </summary>
    public async Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        var channel = await GetChannelAsync(cancellationToken);

        var properties = new BasicProperties
        {
            // Broker yeniden baslasa bile mesaj diskte kalir.
            Persistent = true,
            ContentType = "application/json",
            ContentEncoding = "utf-8",
            MessageId = message.Id,
            CorrelationId = message.CorrelationId,
            Type = message.EventType,
            AppId = message.Producer,
            Timestamp = new AmqpTimestamp(message.OccurredAt.ToUnixTimeSeconds()),
        };

        // Zarf, payload'i ham JSON olarak icerecek sekilde elle kurulur:
        // payload zaten serialize edilmis durumda, tekrar deserialize etmeyiz.
        var body = BuildEnvelopeBytes(message);

        await channel.BasicPublishAsync(
            exchange: _options.Exchange,
            routingKey: message.RoutingKey,
            mandatory: false,
            basicProperties: properties,
            body: body,
            cancellationToken: cancellationToken);

        LogPublished(logger, message.EventType, message.Id, message.RoutingKey);
    }

    private static ReadOnlyMemory<byte> BuildEnvelopeBytes(OutboxMessage message)
    {
        var builder = new StringBuilder(message.Payload.Length + 512);
        builder.Append("{\"eventId\":").Append(JsonString(message.Id))
               .Append(",\"eventType\":").Append(JsonString(message.EventType))
               .Append(",\"eventVersion\":").Append(message.EventVersion.ToString(System.Globalization.CultureInfo.InvariantCulture))
               .Append(",\"occurredAt\":").Append(JsonString(message.OccurredAt.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", System.Globalization.CultureInfo.InvariantCulture)))
               .Append(",\"producer\":").Append(JsonString(message.Producer))
               .Append(",\"correlationId\":").Append(JsonString(message.CorrelationId))
               .Append(",\"causationId\":").Append(message.CausationId is null ? "null" : JsonString(message.CausationId))
               .Append(",\"subjectId\":").Append(JsonString(message.SubjectId))
               .Append(",\"payload\":").Append(message.Payload)
               .Append('}');

        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private static string JsonString(string value)
        => System.Text.Json.JsonSerializer.Serialize(value, Api.JsonDefaults.Events);

    private async Task<IChannel> GetChannelAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        if (_channel is { IsOpen: true })
        {
            return _channel;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_channel is { IsOpen: true })
            {
                return _channel;
            }

            if (_channel is not null)
            {
                await _channel.DisposeAsync();
                _channel = null;
            }

            var connection = await connectionProvider.GetConnectionAsync(cancellationToken);

            _channel = await connection.CreateChannelAsync(
                new CreateChannelOptions(
                    publisherConfirmationsEnabled: true,
                    publisherConfirmationTrackingEnabled: true),
                cancellationToken);

            await RabbitMqTopology.DeclareExchangesAsync(_channel, _options, cancellationToken);

            return _channel;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;

        if (_channel is not null)
        {
            try
            {
                await _channel.CloseAsync();
            }
            catch (Exception ex)
            {
                LogChannelCloseFailed(logger, ex);
            }
            finally
            {
                await _channel.DisposeAsync();
            }
        }

        _gate.Dispose();
    }

    [LoggerMessage(Level = LogLevel.Debug, Message = "Published {EventType} {EventId} with routing key {RoutingKey}")]
    private static partial void LogPublished(ILogger logger, string eventType, string eventId, string routingKey);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Ignoring error while closing publisher channel.")]
    private static partial void LogChannelCloseFailed(ILogger logger, Exception exception);
}
