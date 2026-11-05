using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Staff.UpdateStaffRegions;

public sealed record UpdateStaffRegionsRequest(IReadOnlyCollection<OperationRegion> Regions);

/// <summary><c>PUT /api/v1/staff/{staffId}/regions</c>. Butun bolge setini replace eder.</summary>
public static class UpdateStaffRegionsEndpoint
{
    public static void MapUpdateStaffRegions(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/v1/staff/{staffId}/regions", HandleAsync)
           .WithName("UpdateStaffRegions")
           .WithTags("Staff")
           .ProducesApi<StaffResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));
    }

    private static async Task<IResult> HandleAsync(
        string staffId,
        UpdateStaffRegionsRequest request,
        HttpContext httpContext,
        IdentityServiceDbContext db,
        UserManager<ApplicationUser> userManager,
        OutboxWriter outboxWriter,
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

        var profile = await db.StaffProfiles.Include(p => p.Regions).SingleAsync(p => p.UserId == staffId, cancellationToken);
        ETagHelper.EnsureMatches(expectedVersion, profile.Version);

        var adminId = httpContext.User.FindFirstValue("sub") ?? throw AppException.Forbidden();
        var now = clock.UtcNow;

        var regionIds = await db.Regions
            .Where(r => request.Regions.Contains(r.Code))
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);

        db.StaffRegions.RemoveRange(profile.Regions);
        foreach (var regionId in regionIds)
        {
            db.StaffRegions.Add(new StaffRegion { StaffUserId = staffId, RegionId = regionId, AssignedBy = adminId, AssignedAt = now });
        }

        profile.UpdatedAt = now;
        profile.Version++;

        var specialtyCodes = await db.StaffSpecialties.Where(s => s.StaffUserId == staffId)
            .Join(db.Specialties, ss => ss.SpecialtyId, s => s.Id, (ss, s) => s.Code.ToString())
            .ToArrayAsync(cancellationToken);

        outboxWriter.Enqueue(IdentityEventTypes.StaffProfileUpdated, staffId, new
        {
            userId = staffId,
            isActive = user.IsActive,
            assignmentEnabled = profile.AssignmentEnabled,
            specialties = specialtyCodes,
            regions = request.Regions.Select(r => r.ToString()).ToArray(),
            displayName = $"{profile.FirstName} {profile.LastName}",
            updatedAt = now,
        });

        await db.SaveChangesAsync(cancellationToken);

        var response = await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken);
        ETagHelper.WriteETag(httpContext.Response, response.Version);

        return ApiResults.Ok(response, correlation);
    }
}
