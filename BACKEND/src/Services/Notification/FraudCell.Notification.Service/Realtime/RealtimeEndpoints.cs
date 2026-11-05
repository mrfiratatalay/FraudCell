using System.Security.Claims;
using System.Text.Json;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;

namespace FraudCell.Notification.Service.Realtime;

public sealed record StreamTicketResponse(string Ticket, DateTimeOffset ExpiresAt);

public static class RealtimeEndpoints
{
    public static void MapRealtimeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/events/tickets", IssueTicket)
            .WithName("IssueRealtimeStreamTicket")
            .WithTags("Realtime")
            .ProducesApi<StreamTicketResponse>()
            .RequireAuthorization();

        app.MapGet("/api/v1/events", StreamAsync)
            .WithName("StreamRealtimeEvents")
            .WithTags("Realtime")
            .Produces(StatusCodes.Status200OK, contentType: "text/event-stream")
            .AllowAnonymous();
    }

    private static IResult IssueTicket(HttpContext context, StreamTicketStore tickets, CorrelationContext correlation)
    {
        var userId = context.User.FindFirstValue("sub")
            ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token gecersiz.");
        var ticket = tickets.Issue(userId);
        return ApiResults.Ok(new StreamTicketResponse(ticket.Value, ticket.ExpiresAt), correlation);
    }

    private static async Task StreamAsync(
        string ticket,
        HttpContext context,
        StreamTicketStore tickets,
        NotificationHub hub,
        JsonSerializerOptions jsonOptions,
        CancellationToken cancellationToken)
    {
        if (!tickets.TryConsume(ticket, out var userId))
        {
            throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Stream ticket gecersiz veya suresi dolmus.");
        }

        context.Response.StatusCode = StatusCodes.Status200OK;
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache, no-store";
        context.Response.Headers["X-Accel-Buffering"] = "no";

        await using var subscription = hub.Subscribe(userId);
        await context.Response.WriteAsync(": connected\n\n", cancellationToken);
        await context.Response.Body.FlushAsync(cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            var available = subscription.Reader.WaitToReadAsync(cancellationToken).AsTask();
            var keepAlive = Task.Delay(TimeSpan.FromSeconds(15), cancellationToken);
            var completed = await Task.WhenAny(available, keepAlive);

            if (completed == keepAlive)
            {
                await context.Response.WriteAsync(": keep-alive\n\n", cancellationToken);
                await context.Response.Body.FlushAsync(cancellationToken);
                continue;
            }

            if (!await available)
            {
                break;
            }

            while (subscription.Reader.TryRead(out var notification))
            {
                await context.Response.WriteAsync($"id: {notification.Id}\n", cancellationToken);
                await context.Response.WriteAsync($"data: {JsonSerializer.Serialize(notification, jsonOptions)}\n\n", cancellationToken);
            }
            await context.Response.Body.FlushAsync(cancellationToken);
        }
    }
}
