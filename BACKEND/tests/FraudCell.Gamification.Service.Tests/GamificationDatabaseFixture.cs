using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using Xunit;

namespace FraudCell.Gamification.Service.Tests;

/// <summary>
/// One migrated and seeded Gamification database per test class (Docker required).
/// Tests stay independent by using a fresh analyst id each.
/// </summary>
public sealed class GamificationDatabaseFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18.4").Build();

    public ServiceProvider Services { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<GamificationServiceDbContext>(options => options.UseNpgsql(_postgres.GetConnectionString()));
        services.AddScoped<IMessagingDbContext>(sp => sp.GetRequiredService<GamificationServiceDbContext>());
        services.AddScoped<CorrelationContext>();
        services.AddScoped<OutboxWriter>();
        services.AddScoped<CrossCuttingEventPublisher>();
        services.AddScoped<PointRuleEngine>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton(new ServiceIdentity("gamification-service"));
        Services = services.BuildServiceProvider();

        await using var scope = Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<GamificationServiceDbContext>().Database.MigrateAsync(TestContext.Current.CancellationToken);
        await GamificationSeed.RunAsync(scope.ServiceProvider);
    }

    public async ValueTask DisposeAsync()
    {
        await Services.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}
