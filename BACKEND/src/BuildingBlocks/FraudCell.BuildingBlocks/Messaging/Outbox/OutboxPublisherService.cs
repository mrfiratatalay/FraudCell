using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.BuildingBlocks.Messaging.Outbox;

/// <summary>
/// Outbox'taki bekleyen event'leri RabbitMQ'ya tasiyan arka plan worker'i.
///
/// Iki fazli calisir; publish islemi ASLA acik bir DB transaction'i icinde
/// yapilmaz, aksi halde broker yavasladiginda tablo kilitleri uzun sure tutulur:
///
///   Faz 1 (kisa transaction): SKIP LOCKED ile bir grup kayit "kiralanir"
///                             (next_attempt_at ileri atilir) ve commit edilir.
///   Faz 2 (transaction disi): kayitlar tek tek publish edilir, sonuc yazilir.
///
/// Broker kapaliysa hicbir kayit kaybolmaz; kira suresi dolunca tekrar denenir.
/// </summary>
public sealed partial class OutboxPublisherService(
    IServiceScopeFactory scopeFactory,
    RabbitMqEventPublisher publisher,
    IOptions<OutboxOptions> options,
    IClock clock,
    ILogger<OutboxPublisherService> logger) : BackgroundService
{
    private readonly OutboxOptions _options = options.Value;
    private readonly string _instanceId = $"{Environment.MachineName}:{Environment.ProcessId}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogPublisherStarted(logger, _options.PollIntervalMilliseconds);

        // Uygulama acilisinda migration/seed ile yarismamak icin kisa bir gecikme.
        await Task.Delay(TimeSpan.FromSeconds(_options.StartupDelaySeconds), stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(_options.PollIntervalMilliseconds));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Kuyruk doluysa beklemeden devam et; bos donene kadar cek.
                var processed = await PublishBatchAsync(stoppingToken);
                if (processed == _options.BatchSize)
                {
                    continue;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Worker dongusu asla olmemeli; olurse event'ler sonsuza kadar beklerdi.
                LogPublishCycleFailed(logger, ex);
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }

        LogPublisherStopped(logger);
    }

    private async Task<int> PublishBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var messaging = scope.ServiceProvider.GetRequiredService<IMessagingDbContext>();
        var dbContext = messaging.AsDbContext();

        var now = clock.UtcNow;
        var leased = await LeaseBatchAsync(dbContext, messaging, now, cancellationToken);

        if (leased.Count == 0)
        {
            return 0;
        }

        foreach (var message in leased)
        {
            try
            {
                await publisher.PublishAsync(message, cancellationToken);

                message.PublishedAt = clock.UtcNow;
                message.LastError = null;
                message.NextAttemptAt = null;
                message.LockedUntil = null;
                message.LockOwner = null;
            }
            catch (Exception ex)
            {
                // Broker kapali ya da kanal koptu. Kayit outbox'ta kalir.
                message.LastError = Truncate(ex.Message, 2000);
                message.NextAttemptAt = clock.UtcNow.AddSeconds(BackoffSeconds(message.AttemptCount));
                message.LockedUntil = null;
                message.LockOwner = null;

                LogPublishFailed(logger, message.Id, message.EventType, message.AttemptCount, message.NextAttemptAt);

                // Broker toptan kapaliysa kalan mesajlari denemek anlamsiz;
                // kiralari zaten ileri atilmis durumda, sonraki turda denenecek.
                break;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var publishedCount = leased.Count(m => m.PublishedAt is not null);
        if (publishedCount > 0)
        {
            LogPublished(logger, publishedCount);
        }

        return leased.Count;
    }

    /// <summary>
    /// Bekleyen kayitlari kiralar. <c>FOR UPDATE SKIP LOCKED</c>, birden fazla
    /// servis instance'i calistiginda ayni event'in iki kez yayinlanmasini onler.
    /// </summary>
    private async Task<List<OutboxMessage>> LeaseBatchAsync(
        DbContext dbContext,
        IMessagingDbContext messaging,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var tableName = GetOutboxTableName(dbContext);
        var sql =
            $$"""
             SELECT * FROM {{tableName}}
             WHERE published_at IS NULL
               AND (next_attempt_at IS NULL OR next_attempt_at <= {0})
               AND (locked_until IS NULL OR locked_until < {1})
             ORDER BY occurred_at
             LIMIT {2}
             FOR UPDATE SKIP LOCKED
             """;

        var batch = await messaging.OutboxMessages
            .FromSqlRaw(sql, now, now, _options.BatchSize)
            .ToListAsync(cancellationToken);

        if (batch.Count == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return batch;
        }

        foreach (var message in batch)
        {
            message.AttemptCount++;
            // Kira: bu sure icinde baska instance ayni kaydi almaz.
            // NextAttemptAt bu asamada BILEREK dokunulmaz; o yalnizca hata sonrasi
            // retry backoff'unu ifade eder.
            message.LockedUntil = now.AddSeconds(_options.LeaseSeconds);
            message.LockOwner = _instanceId;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return batch;
    }

    /// <summary>Ustel geri cekilme, 5 dakikada tavan yapar.</summary>
    private static int BackoffSeconds(int attemptCount)
        => (int)Math.Min(300, Math.Pow(2, Math.Min(attemptCount, 8)));

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    private static string GetOutboxTableName(DbContext dbContext)
    {
        var entityType = dbContext.Model.FindEntityType(typeof(OutboxMessage))
            ?? throw new InvalidOperationException("OutboxMessage entity is not mapped in this DbContext.");

        var tableName = entityType.GetTableName()
            ?? throw new InvalidOperationException("OutboxMessage table name is not configured.");
        var schema = entityType.GetSchema();

        return string.IsNullOrWhiteSpace(schema)
            ? QuoteIdentifier(tableName)
            : $"{QuoteIdentifier(schema)}.{QuoteIdentifier(tableName)}";
    }

    private static string QuoteIdentifier(string identifier)
        => "\"" + identifier.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";

    [LoggerMessage(Level = LogLevel.Information, Message = "Outbox publisher started (poll interval {IntervalMs} ms).")]
    private static partial void LogPublisherStarted(ILogger logger, int intervalMs);

    [LoggerMessage(Level = LogLevel.Error, Message = "Outbox publish cycle failed; will retry.")]
    private static partial void LogPublishCycleFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information, Message = "Outbox publisher stopped.")]
    private static partial void LogPublisherStopped(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Failed to publish outbox message {EventId} ({EventType}), attempt {AttemptCount}. Retrying at {NextAttemptAt}.")]
    private static partial void LogPublishFailed(ILogger logger, string eventId, string eventType, int attemptCount, DateTimeOffset? nextAttemptAt);

    [LoggerMessage(Level = LogLevel.Information, Message = "Published {PublishedCount} outbox message(s).")]
    private static partial void LogPublished(ILogger logger, int publishedCount);
}

public sealed class OutboxOptions
{
    public const string SectionName = "Outbox";

    public int PollIntervalMilliseconds { get; set; } = 500;

    public int BatchSize { get; set; } = 50;

    /// <summary>Kiralanan kaydin baska instance tarafindan alinamayacagi sure.</summary>
    public int LeaseSeconds { get; set; } = 60;

    public int StartupDelaySeconds { get; set; } = 2;
}
