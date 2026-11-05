using System.Text.Json;
using System.Threading.RateLimiting;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Security;
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
builder.Services.AddSingleton(JsonDefaults.Create());
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.ApplyTo(options.SerializerOptions));

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy => policy
        .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.AddFraudCellJwtBearer(builder.Configuration);

// AI routes also require a valid token here ("AuthorizationPolicy": "default" in
// appsettings.json), as defence in depth. Roles and their 403 audit are decided by
// each service itself, the AI included, so a denial is audited exactly once.
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Case §10 brute force: staff login and the OTP endpoints get a tight budget per
    // address and endpoint, on top of the general limit below.
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        $"{context.Connection.RemoteIpAddress}|{context.Request.Path}",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true,
        }));

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
}
