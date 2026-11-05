using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Security;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Features.Badges;
using FraudCell.Gamification.Service.Features.Leaderboard;
using FraudCell.Gamification.Service.Features.Performance;
using FraudCell.Gamification.Service.Features.Profiles;
using FraudCell.Gamification.Service.Messaging;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "gamification-service")
    .Enrich.WithEnvironmentName()
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<CorrelationContext>();
builder.Services.AddSingleton(new ServiceIdentity("gamification-service"));
builder.Services.AddSingleton(JsonDefaults.Create());
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.ApplyTo(options.SerializerOptions));

builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection(RabbitMqOptions.SectionName));
builder.Services.Configure<OutboxOptions>(builder.Configuration.GetSection(OutboxOptions.SectionName));

builder.Services.AddDbContext<GamificationServiceDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("GamificationDb")));

builder.Services.AddScoped<IMessagingDbContext>(sp => sp.GetRequiredService<GamificationServiceDbContext>());

builder.Services.AddScoped<OutboxWriter>();
builder.Services.AddScoped<CrossCuttingEventPublisher>();
builder.Services.AddScoped<PointRuleEngine>();

builder.Services.AddSingleton<RabbitMqConnectionProvider>();
builder.Services.AddSingleton<RabbitMqEventPublisher>();
builder.Services.AddHostedService<OutboxPublisherService>();
builder.Services.AddHostedService<CaseDecisionMadeConsumer>();
builder.Services.AddHostedService<CaseSlaBreachedConsumer>();
builder.Services.AddHostedService<CustomerFeedbackSubmittedConsumer>();
builder.Services.AddHostedService<StaffProfileUpdatedConsumer>();

builder.Services.AddFraudCellJwtBearer(builder.Configuration);

builder.Services.AddAuthorization();

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseMiddleware<CorrelationMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
if (app.Environment.IsDevelopment())
{
    app.MapScalarApiReference();
}

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

app.MapProfiles();
app.MapLeaderboard();
app.MapGetBadgeDefinitions();
app.MapGetPerformance();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<GamificationServiceDbContext>();
    await db.Database.MigrateAsync();
    await GamificationSeed.RunAsync(scope.ServiceProvider);
}

app.Run();

public sealed partial class Program;
