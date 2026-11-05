using System.Text.Json;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Messaging;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using Shouldly;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Xunit;

namespace FraudCell.Transaction.Service.Tests;

/// <summary>
/// The outbox and inbox guarantees, checked against a real PostgreSQL and a real
/// RabbitMQ started by Testcontainers (Docker required).
/// </summary>
public sealed class MessagingIntegrationTests : IAsyncLifetime
{
    private const string StaffQueue = "transaction.identity-staff-profile-updated";
    private const string StaffRoutingKey = "identity.staff.profile.updated.v1";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18.4").Build();
    private readonly RabbitMqContainer _rabbitMq = new RabbitMqBuilder("rabbitmq:4.3").Build();
    private ServiceProvider _services = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(Ct), _rabbitMq.StartAsync(Ct));

        var broker = new Uri(_rabbitMq.GetConnectionString());
        var credentials = broker.UserInfo.Split(':');

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<TransactionServiceDbContext>(options => options.UseNpgsql(_postgres.GetConnectionString()));
        services.AddScoped<IMessagingDbContext>(sp => sp.GetRequiredService<TransactionServiceDbContext>());
        services.AddScoped<CorrelationContext>();
        services.AddScoped<OutboxWriter>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton(new ServiceIdentity("transaction-service"));
        services.Configure<RabbitMqOptions>(options =>
        {
            options.Host = broker.Host;
            options.Port = broker.Port;
            options.UserName = Uri.UnescapeDataString(credentials[0]);
            options.Password = Uri.UnescapeDataString(credentials[1]);
        });
        services.Configure<OutboxOptions>(options =>
        {
            options.StartupDelaySeconds = 0;
            options.PollIntervalMilliseconds = 100;
        });
        services.AddSingleton<RabbitMqConnectionProvider>();
        services.AddSingleton<RabbitMqEventPublisher>();
        _services = services.BuildServiceProvider();

        await using var scope = _services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>().Database.MigrateAsync(Ct);
    }

    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync();
        await _postgres.DisposeAsync();
        await _rabbitMq.DisposeAsync();
    }

    [Fact]
    public async Task Event_is_not_stored_when_the_business_change_fails()
    {
        var analystId = Ulid.NewUlid().ToString();
        await SaveProjectionWithEventAsync(analystId);

        // Same primary key again: the business insert fails, so its event must not survive either.
        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        db.AnalystEligibilityProjections.Add(NewProjection(analystId));
        var eventId = scope.ServiceProvider.GetRequiredService<OutboxWriter>().Enqueue("test.analyst.saved", analystId, new { analystId });

        await Should.ThrowAsync<DbUpdateException>(() => db.SaveChangesAsync(Ct));

        await using var verify = _services.CreateAsyncScope();
        var verifyDb = verify.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        (await verifyDb.OutboxMessages.AnyAsync(m => m.Id == eventId, Ct)).ShouldBeFalse();
    }

    [Fact]
    public async Task Outbox_publisher_delivers_a_stored_event_and_marks_it_published()
    {
        var options = _services.GetRequiredService<IOptions<RabbitMqOptions>>().Value;
        await using var connection = await new ConnectionFactory { Uri = new Uri(_rabbitMq.GetConnectionString()) }.CreateConnectionAsync(Ct);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: Ct);
        await RabbitMqTopology.DeclareExchangesAsync(channel, options, Ct);
        var queue = (await channel.QueueDeclareAsync(cancellationToken: Ct)).QueueName;
        await channel.QueueBindAsync(queue, options.Exchange, "test.analyst.saved.v1", cancellationToken: Ct);

        var eventId = await SaveProjectionWithEventAsync(Ulid.NewUlid().ToString());

        var outboxPublisher = ActivatorUtilities.CreateInstance<OutboxPublisherService>(_services);
        await outboxPublisher.StartAsync(Ct);
        try
        {
            BasicGetResult? delivered = null;
            for (var attempt = 0; attempt < 100 && delivered is null; attempt++)
            {
                delivered = await channel.BasicGetAsync(queue, autoAck: true, Ct);
                if (delivered is null)
                {
                    await Task.Delay(100, Ct);
                }
            }

            delivered.ShouldNotBeNull();
            JsonSerializer.Deserialize<EventEnvelope>(delivered.Body.Span, JsonDefaults.Events)!.EventId.ShouldBe(eventId);
        }
        finally
        {
            await outboxPublisher.StopAsync(CancellationToken.None);
        }

        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        (await db.OutboxMessages.SingleAsync(m => m.Id == eventId, Ct)).PublishedAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task Consumer_applies_a_redelivered_event_only_once()
    {
        var options = _services.GetRequiredService<IOptions<RabbitMqOptions>>().Value;
        await using (var connection = await new ConnectionFactory { Uri = new Uri(_rabbitMq.GetConnectionString()) }.CreateConnectionAsync(Ct))
        await using (var channel = await connection.CreateChannelAsync(cancellationToken: Ct))
        {
            // Same declaration the consumer makes, so nothing published below is unroutable.
            await RabbitMqTopology.DeclareConsumerQueueAsync(channel, options, StaffQueue, [StaffRoutingKey], Ct);
        }

        var duplicate = StaffEvent(Ulid.NewUlid().ToString());
        var marker = StaffEvent(Ulid.NewUlid().ToString());
        var publisher = _services.GetRequiredService<RabbitMqEventPublisher>();
        await publisher.PublishAsync(duplicate, Ct);
        await publisher.PublishAsync(duplicate, Ct);
        await publisher.PublishAsync(marker, Ct);

        var consumer = ActivatorUtilities.CreateInstance<StaffProfileUpdatedConsumer>(_services);
        await consumer.StartAsync(Ct);
        try
        {
            // Deliveries are handled in order, so once the marker is applied both copies have been handled.
            for (var attempt = 0; attempt < 100 && !await ProjectionExistsAsync(marker.SubjectId); attempt++)
            {
                await Task.Delay(100, Ct);
            }
        }
        finally
        {
            await consumer.StopAsync(CancellationToken.None);
        }

        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        (await ProjectionExistsAsync(marker.SubjectId)).ShouldBeTrue();
        (await db.InboxMessages.CountAsync(m => m.EventId == duplicate.Id, Ct)).ShouldBe(1);
        (await db.AnalystEligibilityProjections.CountAsync(p => p.AnalystId == duplicate.SubjectId, Ct)).ShouldBe(1);
    }

    private async Task<string> SaveProjectionWithEventAsync(string analystId)
    {
        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
        db.AnalystEligibilityProjections.Add(NewProjection(analystId));
        var eventId = scope.ServiceProvider.GetRequiredService<OutboxWriter>().Enqueue("test.analyst.saved", analystId, new { analystId });
        await db.SaveChangesAsync(Ct);
        return eventId;
    }

    private async Task<bool> ProjectionExistsAsync(string analystId)
    {
        await using var scope = _services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>()
            .AnalystEligibilityProjections.AnyAsync(p => p.AnalystId == analystId, Ct);
    }

    private static AnalystEligibilityProjection NewProjection(string analystId) => new()
    {
        AnalystId = analystId,
        IsActive = true,
        AssignmentEnabled = true,
        SpecialtiesJson = "[\"CALINTI_KART\"]",
        RegionsJson = "[\"MARMARA\"]",
        LastSourceEventId = Ulid.NewUlid().ToString(),
        SourceUpdatedAt = DateTimeOffset.UtcNow,
        ProjectionUpdatedAt = DateTimeOffset.UtcNow,
    };

    private static OutboxMessage StaffEvent(string analystId) => new()
    {
        Id = Ulid.NewUlid().ToString(),
        EventType = "identity.staff.profile.updated",
        EventVersion = 1,
        RoutingKey = StaffRoutingKey,
        SubjectId = analystId,
        CorrelationId = Ulid.NewUlid().ToString(),
        Producer = "identity-service",
        OccurredAt = DateTimeOffset.UtcNow,
        Payload = JsonSerializer.Serialize(
            new StaffProfileUpdatedPayload(analystId, true, true, ["CALINTI_KART"], ["MARMARA"], "Test Analist", DateTimeOffset.UtcNow),
            JsonDefaults.Events),
    };
}
