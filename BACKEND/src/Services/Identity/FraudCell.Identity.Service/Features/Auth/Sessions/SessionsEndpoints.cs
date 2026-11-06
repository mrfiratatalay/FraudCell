using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Auth.Sessions;

public sealed record SessionResponse(
    string Id,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? LastUsedAt,
    string? CreatedIp,
    string? UserAgent,
    bool IsCurrent);

/// <summary>
/// Kullanicinin kendi aktif oturumlarini listeler/iptal eder (dokuman
/// <c>/auth/sessions</c>). Yalnizca oturum sahibi
/// kendi kayitlarina erisir; baska kullanicinin session ID'si 404 doner.
/// </summary>
public static class SessionsEndpoints
{
    public static void MapSessions(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/auth/sessions", ListAsync).WithName("GetSessions").WithTags("Auth")
           .ProducesApi<IReadOnlyList<SessionResponse>>().RequireAuthorization();
        app.MapDelete("/api/v1/auth/sessions/{sessionId}", RevokeOneAsync).WithName("RevokeSession").WithTags("Auth")
           .ProducesApi<object?>().RequireAuthorization();
        app.MapDelete("/api/v1/auth/sessions", RevokeAllAsync).WithName("RevokeAllSessions").WithTags("Auth")
           .ProducesApi<object?>().RequireAuthorization();
    }

    private static async Task<IResult> ListAsync(
        HttpContext httpContext, IdentityServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var userId = RequireUserId(httpContext);
        var currentRaw = RefreshCookie.Read(httpContext.Request);
        var currentHash = currentRaw is null ? null : System.Convert.ToHexStringLower(
            System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(currentRaw)));

        var now = System.DateTimeOffset.UtcNow;
        var sessions = await db.RefreshSessions
            .Where(s => s.UserId == userId && s.RevokedAt == null && s.ExpiresAt > now)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { s.Id, s.CreatedAt, s.ExpiresAt, s.LastUsedAt, s.CreatedIp, s.UserAgent, s.TokenHash })
            .ToListAsync(cancellationToken);

        var items = sessions.Select(s => new SessionResponse(
            s.Id, s.CreatedAt, s.ExpiresAt, s.LastUsedAt, s.CreatedIp, s.UserAgent, s.TokenHash == currentHash)).ToList();

        httpContext.Response.Headers.CacheControl = "no-store";
        return ApiResults.Ok(items, correlation);
    }

    private static async Task<IResult> RevokeOneAsync(
        string sessionId, HttpContext httpContext, IdentityServiceDbContext db,
        RefreshTokenService refreshTokenService, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var userId = RequireUserId(httpContext);
        var owned = await db.RefreshSessions.AsNoTracking()
            .AnyAsync(s => s.Id == sessionId && s.UserId == userId, cancellationToken);

        if (!owned)
        {
            throw AppException.NotFound();
        }

        await refreshTokenService.RevokeByIdAsync(sessionId, RevocationReasons.UserRevoked, cancellationToken);
        return ApiResults.Empty(correlation);
    }

    private static async Task<IResult> RevokeAllAsync(
        HttpContext httpContext, RefreshTokenService refreshTokenService, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var userId = RequireUserId(httpContext);
        await refreshTokenService.RevokeAllForUserAsync(userId, RevocationReasons.UserRevoked, cancellationToken);
        RefreshCookie.Clear(httpContext.Response);
        return ApiResults.Empty(correlation);
    }

    private static string RequireUserId(HttpContext httpContext)
        => httpContext.User.FindFirstValue("sub") ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token geçersiz.");
}
