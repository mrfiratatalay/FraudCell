using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Security;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Notification.Service.Realtime;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;

// Notification Service: consumes user.notification.requested events from
// RabbitMQ and pushes them to the signed-in browser over Server-Sent Events.
// It owns no database; a notification for a user who is offline is dropped,
// because the case asks only for live alerts.
var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "notification-service")
    .Enrich.WithEnvironmentName()
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

builder.Services.AddScoped<CorrelationContext>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton(new ServiceIdentity("notification-service"));
builder.Services.AddSingleton(JsonDefaults.Create());
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.ApplyTo(options.SerializerOptions));
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection(RabbitMqOptions.SectionName));
builder.Services.AddSingleton<RabbitMqConnectionProvider>();
builder.Services.AddSingleton<NotificationHub>();
builder.Services.AddSingleton<StreamTicketStore>();
builder.Services.AddHostedService<NotificationRelayConsumer>();

builder.Services.AddFraudCellJwtBearer(builder.Configuration);
builder.Services.AddAuthorization();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseMiddleware<CorrelationMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = _ => false });
app.MapRealtimeEndpoints();

app.Run();
