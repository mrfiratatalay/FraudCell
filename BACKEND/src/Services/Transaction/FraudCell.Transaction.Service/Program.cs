using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Security;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.BackgroundJobs;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Features.Cases.Assignment;
using FraudCell.Transaction.Service.Features.Cases.Decision;
using FraudCell.Transaction.Service.Features.Cases.Feedback;
using FraudCell.Transaction.Service.Features.Cases.FraudTypeOverride;
using FraudCell.Transaction.Service.Features.Cases.GetCase;
using FraudCell.Transaction.Service.Features.Cases.ListCases;
using FraudCell.Transaction.Service.Features.Cases.Notes;
using FraudCell.Transaction.Service.Features.Cases.Reassignment;
using FraudCell.Transaction.Service.Features.Cases.RiskLevelOverride;
using FraudCell.Transaction.Service.Features.Cases.StartReview;
using FraudCell.Transaction.Service.Features.Cases.VerificationRequests;
using FraudCell.Transaction.Service.Features.Cases.VerificationResponses;
using FraudCell.Transaction.Service.Features.Transactions.CreateTransaction;
using FraudCell.Transaction.Service.Features.Transactions.GetTransaction;
using FraudCell.Transaction.Service.Features.Transactions.ListTransactions;
using FraudCell.Transaction.Service.Messaging;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "transaction-service")
    .Enrich.WithEnvironmentName()
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<CorrelationContext>();
builder.Services.AddSingleton(new ServiceIdentity("transaction-service"));
builder.Services.AddSingleton(JsonDefaults.Create());
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.ApplyTo(options.SerializerOptions));

builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection(RabbitMqOptions.SectionName));
builder.Services.Configure<OutboxOptions>(builder.Configuration.GetSection(OutboxOptions.SectionName));
builder.Services.Configure<AssessmentOptions>(builder.Configuration.GetSection(AssessmentOptions.SectionName));

builder.Services.AddDbContext<TransactionServiceDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("TransactionDb")));

builder.Services.AddScoped<IMessagingDbContext>(sp => sp.GetRequiredService<TransactionServiceDbContext>());

builder.Services.AddScoped<OutboxWriter>();
builder.Services.AddScoped<CrossCuttingEventPublisher>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<CaseTransitionRecorder>();
builder.Services.AddScoped<TransactionNumberGenerator>();
builder.Services.AddScoped<ManualFallbackCaseCreator>();

builder.Services.AddSingleton<RabbitMqConnectionProvider>();
builder.Services.AddSingleton<RabbitMqEventPublisher>();
builder.Services.AddHostedService<OutboxPublisherService>();
builder.Services.AddHostedService<AiAssessmentCompletedConsumer>();
builder.Services.AddHostedService<AiAssessmentFailedConsumer>();
builder.Services.AddHostedService<StaffProfileUpdatedConsumer>();
builder.Services.AddHostedService<AssessmentWatchdogWorker>();
builder.Services.AddHostedService<SlaBreachWorker>();
builder.Services.AddHostedService<CaseClosureWorker>();
builder.Services.AddHostedService<VerificationExpiryWorker>();

builder.Services.AddFraudCellJwtBearer(builder.Configuration);

builder.Services.AddAuthorization();

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseMiddleware<CorrelationMiddleware>();
app.UseAuthorizationDeniedAudit();
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

app.MapCreateTransaction();
app.MapGetTransaction();
app.MapListTransactions();

app.MapListCases();
app.MapGetCase();
app.MapGetCaseHistory();
app.MapNotes();
app.MapStartReview();
app.MapVerificationRequests();
app.MapVerificationResponses();
app.MapSubmitDecision();
app.MapManualAssignment();
app.MapReassignment();
app.MapFraudTypeOverride();
app.MapRiskLevelOverride();
app.MapSubmitFeedback();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TransactionServiceDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();

public sealed partial class Program;
