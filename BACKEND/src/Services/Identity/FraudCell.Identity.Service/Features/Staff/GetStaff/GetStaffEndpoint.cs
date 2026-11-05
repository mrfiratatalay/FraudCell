using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.AspNetCore.Identity;

namespace FraudCell.Identity.Service.Features.Staff.GetStaff;

/// <summary><c>GET /api/v1/staff/{staffId}</c>.</summary>
public static class GetStaffEndpoint
{
    public static void MapGetStaff(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/staff/{staffId}", HandleAsync)
           .WithName("GetStaff")
           .WithTags("Staff")
           .ProducesApi<StaffResponse>()
           .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        string staffId,
        HttpContext httpContext,
        IdentityServiceDbContext db,
        UserManager<ApplicationUser> userManager,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        var callerId = httpContext.User.FindFirstValue("sub");
        var callerRole = httpContext.User.FindFirstValue("role");

        var isSelf = string.Equals(callerId, staffId, StringComparison.Ordinal);
        var isPrivileged = callerRole is RoleNames.Admin or RoleNames.Supervisor;

        if (!isSelf && !isPrivileged)
        {
            // Kaynak varligini sizdirmamak icin 404.
            throw AppException.NotFound();
        }

        var user = await userManager.FindByIdAsync(staffId);
        if (user is null || user.UserType != UserType.Staff)
        {
            throw AppException.NotFound();
        }

        var response = await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken);
        ETagHelper.WriteETag(httpContext.Response, response.Version);

        return ApiResults.Ok(response, correlation);
    }
}
