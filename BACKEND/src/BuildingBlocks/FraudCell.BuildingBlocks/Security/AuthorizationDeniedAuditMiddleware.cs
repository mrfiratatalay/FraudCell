using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.JsonWebTokens;

namespace FraudCell.BuildingBlocks.Security;

/// <summary>
/// Turns every 403 the service returns into an <c>audit.entry.requested</c>
/// event in the service's own outbox. The event is committed to the service's
/// database first, so the audit is not lost while RabbitMQ is down; Identity
/// consumes it and appends it to the audit log.
/// </summary>
public sealed partial class AuthorizationDeniedAuditMiddleware(
    RequestDelegate next,
    IServiceScopeFactory scopeFactory,
    ServiceIdentity serviceIdentity,
    IClock clock,
    ILogger<AuthorizationDeniedAuditMiddleware> logger)
{
    public const string EventType = "audit.entry.requested";

    public async Task InvokeAsync(HttpContext context)
    {
        await next(context);

        if (context.Response.StatusCode != StatusCodes.Status403Forbidden)
        {
            return;
        }

        try
        {
            // A fresh scope, so changes the denied request may have left in its
            // DbContext are never saved together with the audit.
            await using var scope = scopeFactory.CreateAsyncScope();
            var services = scope.ServiceProvider;
            services.GetRequiredService<CorrelationContext>()
                .Set(context.RequestServices.GetRequiredService<CorrelationContext>().CorrelationId);

            var actorId = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var resourceId = context.Request.Path.Value ?? "/";
            var occurredAt = clock.UtcNow;

            services.GetRequiredService<OutboxWriter>().Enqueue(
                EventType,
                actorId ?? resourceId,
                new
                {
                    actorId,
                    actorRole = context.User.FindFirst("role")?.Value,
                    action = "AUTHORIZATION_DENIED",
                    sourceService = serviceIdentity.Name,
                    resourceType = "http_endpoint",
                    resourceId,
                    ipAddress = ClientIp(context),
                    result = "FAILURE",
                    occurredAt,
                    details = new { method = context.Request.Method },
                },
                occurredAt: occurredAt);

            await services.GetRequiredService<IMessagingDbContext>().AsDbContext().SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception exception)
        {
            // The 403 has already been sent; a failed audit must not turn it into a 500.
            LogAuditFailed(logger, exception);
        }
    }

    // Behind the gateway the TCP peer is the gateway; YARP passes the caller in X-Forwarded-For.
    private static string? ClientIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
        return string.IsNullOrWhiteSpace(forwarded)
            ? context.Connection.RemoteIpAddress?.ToString()
            : forwarded.Split(',')[0].Trim();
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not record the authorization-denied audit event.")]
    private static partial void LogAuditFailed(ILogger logger, Exception exception);
}

public static class AuthorizationDeniedAuditExtensions
{
    /// <summary>Register it outside the exception handler so it sees the final status code.</summary>
    public static IApplicationBuilder UseAuthorizationDeniedAudit(this IApplicationBuilder app)
        => app.UseMiddleware<AuthorizationDeniedAuditMiddleware>();
}
