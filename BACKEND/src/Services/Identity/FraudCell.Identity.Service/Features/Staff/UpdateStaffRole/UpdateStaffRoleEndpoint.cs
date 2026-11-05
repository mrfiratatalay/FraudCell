using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Staff.UpdateStaffRole;

public sealed record UpdateStaffRoleRequest(string Role);

/// <summary><c>PUT /api/v1/staff/{staffId}/role</c>.</summary>
public static class UpdateStaffRoleEndpoint
{
    public static void MapUpdateStaffRole(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/v1/staff/{staffId}/role", HandleAsync)
           .WithName("UpdateStaffRole")
           .WithTags("Staff")
           .ProducesApi<StaffResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));
    }

    private static async Task<IResult> HandleAsync(
        string staffId,
        UpdateStaffRoleRequest request,
        HttpContext httpContext,
        IdentityServiceDbContext db,
        UserManager<ApplicationUser> userManager,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        if (!RoleNames.StaffRoles.Contains(request.Role, StringComparer.Ordinal))
        {
            throw AppException.Validation("Rol ANALYST, SUPERVISOR veya ADMIN olmalıdır.");
        }

        var user = await userManager.FindByIdAsync(staffId);
        if (user is null || user.UserType != UserType.Staff)
        {
            throw AppException.NotFound();
        }

        var profile = await db.StaffProfiles.SingleAsync(p => p.UserId == staffId, cancellationToken);
        ETagHelper.EnsureMatches(expectedVersion, profile.Version);

        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
        {
            await userManager.RemoveFromRolesAsync(user, currentRoles);
        }

        await userManager.AddToRoleAsync(user, request.Role);

        user.Version++;
        profile.Version++;
        await db.SaveChangesAsync(cancellationToken);

        var response = await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken);
        ETagHelper.WriteETag(httpContext.Response, response.Version);

        return ApiResults.Ok(response, correlation);
    }
}
