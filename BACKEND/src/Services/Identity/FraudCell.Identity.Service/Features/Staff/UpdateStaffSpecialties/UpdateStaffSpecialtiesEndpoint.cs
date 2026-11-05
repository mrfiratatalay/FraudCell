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

namespace FraudCell.Identity.Service.Features.Staff.UpdateStaffSpecialties;

public sealed record UpdateStaffSpecialtiesRequest(IReadOnlyCollection<AnalystSpecialty> Specialties);

/// <summary>
/// <c>PUT /api/v1/staff/{staffId}/specialties</c>. Bütün uzmanlik
/// setini replace eder ve <c>identity.staff.profile.updated</c> event'i yayinlar
/// (AI Service bunu analyst ranking projection'i icin tuketir).
/// </summary>
public static class UpdateStaffSpecialtiesEndpoint
{
    public static void MapUpdateStaffSpecialties(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/v1/staff/{staffId}/specialties", HandleAsync)
           .WithName("UpdateStaffSpecialties")
           .WithTags("Staff")
           .ProducesApi<StaffResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));
    }

    private static async Task<IResult> HandleAsync(
        string staffId,
        UpdateStaffSpecialtiesRequest request,
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

        var profile = await db.StaffProfiles.Include(p => p.Specialties).SingleAsync(p => p.UserId == staffId, cancellationToken);
        ETagHelper.EnsureMatches(expectedVersion, profile.Version);

        var adminId = httpContext.User.FindFirstValue("sub") ?? throw AppException.Forbidden();
        var now = clock.UtcNow;

        var specialtyIds = await db.Specialties
            .Where(s => request.Specialties.Contains(s.Code))
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        db.StaffSpecialties.RemoveRange(profile.Specialties);
        foreach (var specialtyId in specialtyIds)
        {
            db.StaffSpecialties.Add(new StaffSpecialty { StaffUserId = staffId, SpecialtyId = specialtyId, AssignedBy = adminId, AssignedAt = now });
        }

        profile.UpdatedAt = now;
        profile.Version++;

        var regionCodes = await db.StaffRegions.Where(r => r.StaffUserId == staffId)
            .Join(db.Regions, sr => sr.RegionId, r => r.Id, (sr, r) => r.Code.ToString())
            .ToArrayAsync(cancellationToken);

        outboxWriter.Enqueue(IdentityEventTypes.StaffProfileUpdated, staffId, new
        {
            userId = staffId,
            isActive = user.IsActive,
            assignmentEnabled = profile.AssignmentEnabled,
            specialties = request.Specialties.Select(s => s.ToString()).ToArray(),
            regions = regionCodes,
            displayName = $"{profile.FirstName} {profile.LastName}",
            updatedAt = now,
        });

        await db.SaveChangesAsync(cancellationToken);

        var response = await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken);
        ETagHelper.WriteETag(httpContext.Response, response.Version);

        return ApiResults.Ok(response, correlation);
    }
}
