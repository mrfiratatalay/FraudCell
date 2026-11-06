using RabbitMQ.Client;

namespace FraudCell.BuildingBlocks.Messaging.RabbitMq;

/// <summary>
/// Exchange ve kuyruk tanimlarini kurar. Declare islemleri idempotenttir; her
/// servis kendi ihtiyaci olan parcayi acilista bildirir, sira onemli degildir.
///
/// Retry tasarimi — mesaj sonsuz donguye GIRMEZ:
///
///   fraudcell.events (topic)
///        -> q                                  ana kuyruk
///
///   islem hata verirse consumer mesaji su kuyruga kopyalar:
///   fraudcell.retry (direct)
///        -> q.retry.5   (TTL 5sn)   --DLX-->  fraudcell.requeue -> q
///        -> q.retry.30  (TTL 30sn)  --DLX-->  fraudcell.requeue -> q
///        -> q.retry.120 (TTL 120sn) --DLX-->  fraudcell.requeue -> q
///
///   deneme hakki bitince:
///   fraudcell.dlq (direct) -> q.dlq            insan mudahalesi bekler
///
/// TTL'i kuyrugun kendisine vermek, "basic.nack + requeue" dongusunun aksine
/// broker'i mesgul etmeden gercek gecikme saglar.
/// </summary>
public static class RabbitMqTopology
{
    public static async Task DeclareExchangesAsync(
        IChannel channel,
        RabbitMqOptions options,
        CancellationToken cancellationToken)
    {
        await channel.ExchangeDeclareAsync(
            exchange: options.Exchange,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: cancellationToken);

        await channel.ExchangeDeclareAsync(
            exchange: options.RetryExchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false,
            cancellationToken: cancellationToken);

        await channel.ExchangeDeclareAsync(
            exchange: options.RequeueExchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false,
            cancellationToken: cancellationToken);

        await channel.ExchangeDeclareAsync(
            exchange: options.DeadLetterExchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false,
            cancellationToken: cancellationToken);
    }

    /// <summary>Bir consumer'in ana kuyrugunu, retry kuyruklarini ve DLQ'sunu kurar.</summary>
    public static async Task DeclareConsumerQueueAsync(
        IChannel channel,
        RabbitMqOptions options,
        string queueName,
        IReadOnlyCollection<string> routingKeys,
        CancellationToken cancellationToken)
    {
        await DeclareExchangesAsync(channel, options, cancellationToken);

        // --- Ana kuyruk ---
        await channel.QueueDeclareAsync(
            queue: queueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            cancellationToken: cancellationToken);

        foreach (var routingKey in routingKeys)
        {
            await channel.QueueBindAsync(
                queue: queueName,
                exchange: options.Exchange,
                routingKey: routingKey,
                cancellationToken: cancellationToken);
        }

        // TTL dolan retry mesajlarinin ana kuyruga donus yolu.
        await channel.QueueBindAsync(
            queue: queueName,
            exchange: options.RequeueExchange,
            routingKey: queueName,
            cancellationToken: cancellationToken);

        // --- Gecikmeli yeniden deneme kuyruklari ---
        foreach (var delaySeconds in options.RetryDelaysSeconds)
        {
            var retryQueue = RetryQueueName(queueName, delaySeconds);

            await channel.QueueDeclareAsync(
                queue: retryQueue,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: new Dictionary<string, object?>
                {
                    ["x-message-ttl"] = delaySeconds * 1000,
                    ["x-dead-letter-exchange"] = options.RequeueExchange,
                    ["x-dead-letter-routing-key"] = queueName,
                },
                cancellationToken: cancellationToken);

            await channel.QueueBindAsync(
                queue: retryQueue,
                exchange: options.RetryExchange,
                routingKey: retryQueue,
                cancellationToken: cancellationToken);
        }

        // --- Dead letter kuyrugu ---
        var deadLetterQueue = DeadLetterQueueName(queueName);

        await channel.QueueDeclareAsync(
            queue: deadLetterQueue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            cancellationToken: cancellationToken);

        await channel.QueueBindAsync(
            queue: deadLetterQueue,
            exchange: options.DeadLetterExchange,
            routingKey: queueName,
            cancellationToken: cancellationToken);
    }

    public static string RetryQueueName(string queueName, int delaySeconds)
        => $"{queueName}.retry.{delaySeconds.ToString(System.Globalization.CultureInfo.InvariantCulture)}";

    public static string DeadLetterQueueName(string queueName) => $"{queueName}.dlq";
}
