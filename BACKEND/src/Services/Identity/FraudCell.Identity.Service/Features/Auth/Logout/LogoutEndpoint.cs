using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;

namespace FraudCell.Identity.Service.Features.Auth.Logout;

/// <summary>
/// <c>POST /api/v1/auth/logout</c>. Idempotenttir:
/// zaten revoke edilmis bir oturum icin tekrar cagri guvenli sekilde 204 doner.
/// </summary>
public static class LogoutEndpoint
{
    public static void MapLogout(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/auth/logout", HandleAsync)
           .WithName("Logout")
           .WithTags("Auth")
           .ProducesApi<object?>()
           .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext,
        RefreshTokenService refreshTokenService,
        AuditWriter auditWriter,
        IdentityServiceDbContext db,
        CancellationToken cancellationToken)
    {
        var rawToken = RefreshCookie.Read(httpContext.Request);
        if (rawToken is not null)
        {
            await refreshTokenService.RevokeAsync(rawToken, RevocationReasons.Logout, cancellationToken);
        }

        RefreshCookie.Clear(httpContext.Response);

        var actorId = httpContext.User.FindFirstValue("sub");
        var role = httpContext.User.FindFirstValue("role");

        auditWriter.Record(actorId, role, AuditActions.Logout, AuditResult.Success, "user", actorId,
            RefreshCookie.GetClientIp(httpContext));
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
