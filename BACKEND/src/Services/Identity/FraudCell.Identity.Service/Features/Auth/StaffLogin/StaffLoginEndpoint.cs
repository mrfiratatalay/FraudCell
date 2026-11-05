using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Features.Auth.StaffLogin;

public sealed record StaffLoginRequest(string Email, string Password);

public sealed record StaffLoginUserResponse(
    string Id,
    string Role,
    string? FirstName,
    string? LastName,
    IReadOnlyCollection<string> Specialties,
    IReadOnlyCollection<string> Regions);

public sealed record StaffLoginResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, StaffLoginUserResponse User);

/// <summary>
/// <c>POST /api/v1/auth/staff/login</c> (dokuman `07-API-DESIGN.md` §25).
/// Hesap kilidi ASP.NET Core Identity'nin yerlesik lockout altyapisiyla
/// saglanir: 5 basarisiz denemede 15 dakika kilit, PostgreSQL'de kalici.
/// </summary>
public static class StaffLoginEndpoint
{
    public static void MapStaffLogin(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/auth/staff/login", HandleAsync)
           .WithName("LoginStaff")
           .WithTags("Auth")
           .ProducesApi<StaffLoginResponse>()
           .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(
        StaffLoginRequest request,
        UserManager<ApplicationUser> userManager,
        SessionIssuer sessionIssuer,
        AuditWriter auditWriter,
        IOptions<JwtSigningOptions> jwtOptions,
        IdentityServiceDbContext db,
        IClock clock,
        HttpContext httpContext,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw AppException.Validation("E-posta ve şifre zorunludur.");
        }

        var ip = RefreshCookie.GetClientIp(httpContext);
        var user = await userManager.FindByEmailAsync(request.Email.Trim());

        if (user is null || user.UserType != UserType.Staff || !user.IsActive)
        {
            // Kullanici yoklugu ile yanlis sifre arasinda ayrim yapmayiz (enumeration onlemi).
            auditWriter.Record(null, null, AuditActions.LoginFailed, AuditResult.Failure, "user", null, ip);
            await db.SaveChangesAsync(cancellationToken);
            throw AppException.Unauthorized(ErrorCodes.InvalidCredentials, "E-posta veya şifre hatalı.");
        }

        if (await userManager.IsLockedOutAsync(user))
        {
            var lockoutEnd = await userManager.GetLockoutEndDateAsync(user);
            var remaining = lockoutEnd is null ? 0 : Math.Max(0, (int)(lockoutEnd.Value - clock.UtcNow).TotalSeconds);

            auditWriter.Record(user.Id, null, AuditActions.LoginFailed, AuditResult.Failure, "user", user.Id, ip);
            await db.SaveChangesAsync(cancellationToken);

            throw new AppException(
                (System.Net.HttpStatusCode)423,
                ErrorCodes.AccountLocked,
                "Hesap geçici olarak kilitlenmiştir.",
                new Dictionary<string, object?> { ["lockedUntil"] = lockoutEnd?.UtcDateTime, ["remainingSeconds"] = remaining });
        }

        var passwordValid = await userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            await userManager.AccessFailedAsync(user);

            if (await userManager.IsLockedOutAsync(user))
            {
                auditWriter.Record(user.Id, null, AuditActions.AccountLocked, AuditResult.Success, "user", user.Id, ip);
            }

            auditWriter.Record(user.Id, null, AuditActions.LoginFailed, AuditResult.Failure, "user", user.Id, ip);
            await db.SaveChangesAsync(cancellationToken);

            throw AppException.Unauthorized(ErrorCodes.InvalidCredentials, "E-posta veya şifre hatalı.");
        }

        await userManager.ResetAccessFailedCountAsync(user);

        var (specialties, regions) = await sessionIssuer.GetStaffClaimsAsync(user, cancellationToken);
        var session = await sessionIssuer.IssueAsync(user, ip, httpContext.Request.Headers.UserAgent.ToString(), null, cancellationToken);

        var profile = await db.StaffProfiles.FindAsync([user.Id], cancellationToken);
        user.LastLoginAt = clock.UtcNow;
        user.Version++;

        auditWriter.Record(user.Id, session.Role, AuditActions.LoginSucceeded, AuditResult.Success, "user", user.Id, ip);
        await db.SaveChangesAsync(cancellationToken);

        RefreshCookie.Append(httpContext.Response, session.RefreshToken, jwtOptions);
        httpContext.Response.Headers.CacheControl = "no-store";

        return ApiResults.Ok(
            new StaffLoginResponse(
                session.AccessToken, session.AccessTokenExpiresAt,
                new StaffLoginUserResponse(user.Id, session.Role, profile?.FirstName, profile?.LastName, specialties, regions)),
            correlation);
    }
}
