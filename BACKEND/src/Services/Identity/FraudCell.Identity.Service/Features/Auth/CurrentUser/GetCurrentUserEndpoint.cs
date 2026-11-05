using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Auth.CurrentUser;

public sealed record CurrentUserResponse(
    string Id,
    string Role,
    string? FirstName,
    string? LastName,
    string? Email,
    string? GsmNumber,
    IReadOnlyCollection<string> Specialties,
    IReadOnlyCollection<string> Regions);

/// <summary><c>GET /api/v1/auth/me</c>.</summary>
public static class GetCurrentUserEndpoint
{
    public static void MapGetCurrentUser(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/auth/me", HandleAsync)
           .WithName("GetCurrentUser")
           .WithTags("Auth")
           .ProducesApi<CurrentUserResponse>()
           .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext,
        IdentityServiceDbContext db,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.FindFirstValue("sub")
            ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token geçersiz.");

        var role = httpContext.User.FindFirstValue("role") ?? string.Empty;
        var specialties = httpContext.User.FindAll("specialties").Select(c => c.Value).ToArray();
        var regions = httpContext.User.FindAll("regions").Select(c => c.Value).ToArray();

        var user = await db.Users
            .Include(u => u.CustomerProfile)
            .Include(u => u.StaffProfile)
            .AsNoTracking()
            .SingleOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw AppException.NotFound("Kullanıcı bulunamadı.");

        httpContext.Response.Headers.CacheControl = "no-store";

        var response = new CurrentUserResponse(
            user.Id,
            role,
            user.CustomerProfile?.FirstName ?? user.StaffProfile?.FirstName,
            user.CustomerProfile?.LastName ?? user.StaffProfile?.LastName,
            user.Email,
            user.GsmNumber,
            specialties,
            regions);

        return ApiResults.Ok(response, correlation);
    }
}
