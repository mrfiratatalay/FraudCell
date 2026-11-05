using System.Text.Json;
using System.Threading.RateLimiting;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Security;
using FraudCell.BuildingBlocks.Time;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "edge-gateway")
    .Enrich.WithEnvironmentName()
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

builder.Services.AddScoped<CorrelationContext>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton(new ServiceIdentity("edge-gateway"));
builder.Services.AddSingleton(JsonDefaults.Create());
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.ApplyTo(options.SerializerOptions));
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection(RabbitMqOptions.SectionName));
builder.Services.AddSingleton<RabbitMqConnectionProvider>();
builder.Services.AddSingleton<RabbitMqEventPublisher>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy => policy
        .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.AddFraudCellJwtBearer(builder.Configuration);

builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var key = context.User.Identity?.IsAuthenticated == true
            ? context.User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value ?? "authenticated"
            : context.Connection.RemoteIpAddress?.ToString() ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 300,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true,
        });
    });
});

builder.Services.AddHealthChecks();
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();
var jsonOptions = app.Services.GetRequiredService<JsonSerializerOptions>();

app.UseMiddleware<CorrelationMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSecurityHeaders();
app.UseCors("FrontendDev");
app.UseAuthentication();
app.UseInvalidBearerTokenGuard(jsonOptions);
app.UseRateLimiter();
app.UseAuthorizationDeniedAudit();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = _ => false });

app.MapReverseProxy();

app.Run();

public sealed partial class Program;

internal static class GatewayMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
        => app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "no-referrer";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
                headers["Content-Security-Policy"] =
                    "default-src 'self'; " +
                    "script-src 'self'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data:; " +
                    "connect-src 'self'; " +
                    "object-src 'none'; " +
                    "base-uri 'self'; " +
                    "frame-ancestors 'none'";
                return Task.CompletedTask;
            });

            await next(context);
        });

    public static IApplicationBuilder UseInvalidBearerTokenGuard(this IApplicationBuilder app, JsonSerializerOptions jsonOptions)
        => app.Use(async (context, next) =>
        {
            var authorization = context.Request.Headers.Authorization.ToString();
            var hasBearerToken = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);
            var isAuthenticated = context.User.Identity?.IsAuthenticated == true;

            if (hasBearerToken && !isAuthenticated)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json; charset=utf-8";

                var payload = ApiResponse.Failure(
                    new ApiError(ErrorCodes.AccessTokenInvalid, "Access token gecersiz veya suresi dolmus."),
                    context.TraceIdentifier);

                await context.Response.WriteAsync(JsonSerializer.Serialize(payload, jsonOptions), context.RequestAborted);
                return;
            }

            await next(context);
        });

    /// <summary>
    /// Downstream servislerin RBAC sonucu dondurdugu 403 cevaplarini merkezi audit
    /// event'ine cevirir. Gateway domain DB tutmadigi icin event publisher-confirm
    /// ile dogrudan broker'a verilir; broker hatasi asil 403 cevabini bozmaz.
    /// </summary>
    public static IApplicationBuilder UseAuthorizationDeniedAudit(this IApplicationBuilder app)
        => app.Use(async (context, next) =>
        {
            await next(context);

            if (context.Response.StatusCode != StatusCodes.Status403Forbidden)
            {
                return;
            }

            var publisher = context.RequestServices.GetRequiredService<RabbitMqEventPublisher>();
            var clock = context.RequestServices.GetRequiredService<IClock>();
            var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("AuthorizationDeniedAudit");
            var occurredAt = clock.UtcNow;
            var actorId = context.User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            var actorRole = context.User.FindFirst("role")?.Value;
            var resourceId = context.Request.Path.Value ?? "/";

            var payload = JsonSerializer.Serialize(new
            {
                actorId,
                actorRole,
                action = "AUTHORIZATION_DENIED",
                sourceService = "edge-gateway",
                resourceType = "http_endpoint",
                resourceId,
                ipAddress = context.Connection.RemoteIpAddress?.ToString(),
                result = "FAILURE",
                occurredAt,
                details = new { method = context.Request.Method },
            }, JsonDefaults.Events);

            var message = new OutboxMessage
            {
                Id = Ulid.NewUlid().ToString(),
                EventType = "audit.entry.requested",
                EventVersion = 1,
                RoutingKey = "audit.entry.requested.v1",
                SubjectId = actorId ?? resourceId,
                CorrelationId = context.TraceIdentifier,
                Producer = "edge-gateway",
                OccurredAt = occurredAt,
                Payload = payload,
            };

            try
            {
                await publisher.PublishAsync(message, context.RequestAborted);
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Authorization denied audit event could not be published.");
            }
        });
}
