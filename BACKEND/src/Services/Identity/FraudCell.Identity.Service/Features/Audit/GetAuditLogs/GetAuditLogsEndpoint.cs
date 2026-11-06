using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace FraudCell.Identity.Service.Features.Audit.GetAuditLogs;

public sealed record AuditLogResponse(
    string Id,
    string? ActorId,
    string? ActorRole,
    string Action,
    string SourceService,
    string? ResourceType,
    string? ResourceId,
    string? IpAddress,
    string Result,
    DateTimeOffset OccurredAt,
    string? DetailsJson);

/// <summary>
/// <c>GET /api/v1/audit-logs</c> ve <c>/audit-logs/{auditId}</c>.
/// Yalnizca admin sorgulayabilir. Kayitlar append-only'dir; bu endpoint yalnizca okur.
/// </summary>
public static class GetAuditLogsEndpoint
{
    public static void MapGetAuditLogs(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/audit-logs", ListAsync)
           .WithName("GetAuditLogs").WithTags("Audit")
           .ProducesApi<CursorPage<AuditLogResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));

        app.MapGet("/api/v1/audit-logs/{auditId}", GetByIdAsync)
           .WithName("GetAuditLog").WithTags("Audit")
           .ProducesApi<AuditLogResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));
    }

    private static async Task<IResult> ListAsync(
        IdentityServiceDbContext db,
        HttpContext httpContext,
        CorrelationContext correlation,
        CancellationToken cancellationToken,
        string? actorId = null,
        string? action = null,
        DateTimeOffset? from = null,
        DateTimeOffset? to = null,
        string? cursor = null,
        int limit = 50)
    {
        limit = Math.Clamp(limit, 1, 100);

        if (from is not null && to is not null && from >= to)
        {
            throw AppException.Validation("'from' değeri 'to' değerinden küçük olmalıdır.");
        }

        var query = db.AuditLogs.AsNoTracking().OrderByDescending(e => e.OccurredAt).AsQueryable();

        if (!string.IsNullOrWhiteSpace(actorId))
        {
            query = query.Where(e => e.ActorId == actorId);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(e => e.Action == action);
        }

        if (from is not null)
        {
            query = query.Where(e => e.OccurredAt >= from);
        }

        if (to is not null)
        {
            query = query.Where(e => e.OccurredAt <= to);
        }

        var cursorTime = TryDecodeCursor(cursor);
        if (cursorTime is not null)
        {
            query = query.Where(e => e.OccurredAt < cursorTime);
        }

        var items = await query
            .Take(limit + 1)
            .Select(e => new AuditLogResponse(
                e.Id, e.ActorId, e.ActorRole, e.Action, e.SourceService, e.ResourceType, e.ResourceId,
                e.IpAddress, e.Result == AuditResult.Success ? "SUCCESS" : "FAILURE", e.OccurredAt, e.DetailsJson))
            .ToListAsync(cancellationToken);

        var hasMore = items.Count > limit;
        var pageItems = items.Take(limit).ToList();
        var nextCursor = hasMore ? EncodeCursor(pageItems[^1].OccurredAt) : null;
        var page = new PageInfo(nextCursor, hasMore, limit);

        httpContext.Response.Headers.CacheControl = "no-store";
        return ApiResults.Ok(new CursorPage<AuditLogResponse>(pageItems, page), correlation);
    }

    private static async Task<IResult> GetByIdAsync(
        string auditId, IdentityServiceDbContext db, HttpContext httpContext, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var entry = await db.AuditLogs.AsNoTracking().SingleOrDefaultAsync(e => e.Id == auditId, cancellationToken)
            ?? throw AppException.NotFound();

        httpContext.Response.Headers.CacheControl = "no-store";
        return ApiResults.Ok(
            new AuditLogResponse(entry.Id, entry.ActorId, entry.ActorRole, entry.Action, entry.SourceService,
                entry.ResourceType, entry.ResourceId, entry.IpAddress,
                entry.Result == AuditResult.Success ? "SUCCESS" : "FAILURE", entry.OccurredAt, entry.DetailsJson),
            correlation);
    }

    private static string EncodeCursor(DateTimeOffset value)
        => Convert.ToBase64String(Encoding.UTF8.GetBytes(value.ToString("O")))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static DateTimeOffset? TryDecodeCursor(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return null;
        }

        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + ((4 - (padded.Length % 4)) % 4), '=');
            return DateTimeOffset.Parse(
                Encoding.UTF8.GetString(Convert.FromBase64String(padded)),
                System.Globalization.CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
