using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Staff.ListStaff;

/// <summary><c>GET /api/v1/staff</c>.</summary>
public static class ListStaffEndpoint
{
    public static void MapListStaff(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/staff", HandleAsync)
           .WithName("ListStaff")
           .WithTags("Staff")
           .ProducesApi<CursorPage<StaffResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin, RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        IdentityServiceDbContext db,
        UserManager<ApplicationUser> userManager,
        CorrelationContext correlation,
        CancellationToken cancellationToken,
        int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 100);

        var userIds = await db.StaffProfiles
            .OrderByDescending(p => p.CreatedAt)
            .Take(limit)
            .Select(p => p.UserId)
            .ToListAsync(cancellationToken);

        var items = new List<StaffResponse>(userIds.Count);
        foreach (var userId in userIds)
        {
            var user = await userManager.FindByIdAsync(userId);
            if (user is not null)
            {
                items.Add(await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken));
            }
        }

        var page = new PageInfo(null, false, limit);
        return ApiResults.Ok(new CursorPage<StaffResponse>(items, page), correlation);
    }
}
