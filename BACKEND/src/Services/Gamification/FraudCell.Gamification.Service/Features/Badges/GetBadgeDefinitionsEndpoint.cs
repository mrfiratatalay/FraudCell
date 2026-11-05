using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Gamification.Service.Features.Badges;

public sealed record BadgeDefinitionResponse(string Code, string DisplayName, string Description);

/// <summary><c>GET /api/v1/game/badges</c>. Tum aktif rozet tanimlari.</summary>
public static class GetBadgeDefinitionsEndpoint
{
    public static void MapGetBadgeDefinitions(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/game/badges", HandleAsync)
           .WithName("GetBadgeDefinitions")
           .WithTags("Gamification")
           .ProducesApi<IReadOnlyList<BadgeDefinitionResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Staff));
    }

    private static async Task<IResult> HandleAsync(GamificationServiceDbContext db, HttpContext httpContext, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var items = await db.BadgeDefinitions.AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.DisplayName)
            .Select(b => new BadgeDefinitionResponse(b.Code, b.DisplayName, b.Description))
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.CacheControl = "private, max-age=60";
        return ApiResults.Ok(items, correlation);
    }
}
