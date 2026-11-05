using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Staff.UpdateStaff;

public sealed record UpdateStaffRequest(string? FirstName, string? LastName, bool? AssignmentEnabled, bool? IsActive);

/// <summary>
/// <c>PATCH /api/v1/staff/{staffId}</c>. Yalnizca request'te
/// bulunan alanlar degistirilir; sifre bu endpoint uzerinden degismez.
/// </summary>
public static class UpdateStaffEndpoint
{
    public static void MapUpdateStaff(this IEndpointRouteBuilder app)
    {
        app.MapPatch("/api/v1/staff/{staffId}", HandleAsync)
           .WithName("UpdateStaff")
           .WithTags("Staff")
           .ProducesApi<StaffResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));
    }

    private static async Task<IResult> HandleAsync(
        string staffId,
        UpdateStaffRequest request,
        HttpContext httpContext,
        IdentityServiceDbContext db,
        UserManager<ApplicationUser> userManager,
        IClock clock,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        var user = await userManager.FindByIdAsync(staffId);
        if (user is null || user.UserType != UserType.Staff)
        {
            throw AppException.NotFound();
        }

        var profile = await db.StaffProfiles.SingleAsync(p => p.UserId == staffId, cancellationToken);
        ETagHelper.EnsureMatches(expectedVersion, profile.Version);

        if (request.FirstName is not null)
        {
            profile.FirstName = request.FirstName.Trim();
        }

        if (request.LastName is not null)
        {
            profile.LastName = request.LastName.Trim();
        }

        if (request.AssignmentEnabled is not null)
        {
            profile.AssignmentEnabled = request.AssignmentEnabled.Value;
        }

        if (request.IsActive is not null)
        {
            user.IsActive = request.IsActive.Value;
            user.Version++;
        }

        profile.UpdatedAt = clock.UtcNow;
        profile.Version++;

        await db.SaveChangesAsync(cancellationToken);

        var response = await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken);
        ETagHelper.WriteETag(httpContext.Response, response.Version);

        return ApiResults.Ok(response, correlation);
    }
}
