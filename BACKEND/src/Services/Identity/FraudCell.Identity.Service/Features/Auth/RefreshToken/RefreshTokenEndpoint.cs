using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Features.Auth.RefreshToken;

public sealed record RefreshTokenResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt);

/// <summary>
/// <c>POST /api/v1/auth/refresh</c> (dokuman `07-API-DESIGN.md` §26). Token
/// her kullanimda rotate edilir; revoke edilmis bir token'in tekrar
/// sunulmasi calinti token senaryosu sayilir ve TUM aktif oturumlar dusurulur.
/// </summary>
public static class RefreshTokenEndpoint
{
    public static void MapRefreshToken(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/auth/refresh", HandleAsync)
           .WithName("RefreshAccessToken")
           .WithTags("Auth")
           .ProducesApi<RefreshTokenResponse>()
           .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext,
        RefreshTokenService refreshTokenService,
        UserManager<ApplicationUser> userManager,
        SessionIssuer sessionIssuer,
        IdentityServiceDbContext db,
        JwtTokenService jwtTokenService,
        AuditWriter auditWriter,
        IOptions<JwtSigningOptions> jwtOptions,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        var rawToken = RefreshCookie.Read(httpContext.Request);
        if (rawToken is null)
        {
            throw AppException.Unauthorized(ErrorCodes.RefreshTokenInvalid, "Refresh token bulunamadı.");
        }

        var ip = RefreshCookie.GetClientIp(httpContext);
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();

        var result = await refreshTokenService.RotateAsync(rawToken, ip, userAgent, cancellationToken);

        switch (result.Outcome)
        {
            case RefreshOutcome.ReuseDetected:
            {
                RefreshCookie.Clear(httpContext.Response);

                if (result.UserId is not null)
                {
                    var user = await userManager.FindByIdAsync(result.UserId);
                    if (user is not null)
                    {
                        await userManager.UpdateSecurityStampAsync(user);
                    }
                }

                auditWriter.Record(
                    result.UserId, null, AuditActions.TokenReuseDetected, AuditResult.Failure,
                    "refresh_session_family", result.PreviousFamilyId, ip);
                await db.SaveChangesAsync(cancellationToken);

                throw AppException.Unauthorized(
                    ErrorCodes.RefreshTokenReuseDetected,
                    "Güvenlik ihlali tespit edildi; tum oturumlar sonlandırıldı. Lütfen tekrar giriş yapın.");
            }

            case RefreshOutcome.Invalid:
                RefreshCookie.Clear(httpContext.Response);
                throw AppException.Unauthorized(ErrorCodes.RefreshTokenInvalid, "Refresh token geçersiz.");

            case RefreshOutcome.Expired:
                RefreshCookie.Clear(httpContext.Response);
                throw AppException.Unauthorized(ErrorCodes.RefreshTokenExpired, "Refresh token süresi dolmuş.");

            case RefreshOutcome.Success:
            default:
                break;
        }

        var refreshedUser = await userManager.FindByIdAsync(result.UserId!)
            ?? throw AppException.Unauthorized(ErrorCodes.RefreshTokenInvalid, "Kullanıcı bulunamadı.");

        var roles = await userManager.GetRolesAsync(refreshedUser);
        var role = roles.FirstOrDefault() ?? throw new InvalidOperationException($"User {refreshedUser.Id} has no role.");

        var (specialties, regions) = await sessionIssuer.GetStaffClaimsAsync(refreshedUser, cancellationToken);
        var access = jwtTokenService.GenerateAccessToken(refreshedUser, role, specialties, regions);

        RefreshCookie.Append(httpContext.Response, result.NewRawToken!, jwtOptions);
        httpContext.Response.Headers.CacheControl = "no-store";

        return ApiResults.Ok(new RefreshTokenResponse(access.Token, access.ExpiresAt), correlation);
    }
}
