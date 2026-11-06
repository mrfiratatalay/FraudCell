using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Features.Reference;

public sealed record ReferenceItemResponse(string Code, string DisplayName);

/// <summary>
/// Rol/uzmanlik/bolge lookup endpoint'leri.
/// Kisa private cache kullanabilir.
/// </summary>
public static class ReferenceEndpoints
{
    public static void MapReference(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/reference/roles", GetRolesAsync)
           .WithName("GetRoles").WithTags("Reference")
           .ProducesApi<IReadOnlyList<ReferenceItemResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));

        app.MapGet("/api/v1/reference/specialties", GetSpecialtiesAsync)
           .WithName("GetSpecialties").WithTags("Reference")
           .ProducesApi<IReadOnlyList<ReferenceItemResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin, RoleNames.Supervisor));

        app.MapGet("/api/v1/reference/regions", GetRegionsAsync)
           .WithName("GetRegions").WithTags("Reference")
           .ProducesApi<IReadOnlyList<ReferenceItemResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin, RoleNames.Supervisor));
    }

    private static async Task<IResult> GetRolesAsync(
        IdentityServiceDbContext db, HttpContext httpContext, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var items = await db.Roles
            .OrderBy(r => r.Name)
            .Select(r => new ReferenceItemResponse(r.Name!, r.DisplayName))
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.CacheControl = "private, max-age=60";
        return ApiResults.Ok(items, correlation);
    }

    private static async Task<IResult> GetSpecialtiesAsync(
        IdentityServiceDbContext db, HttpContext httpContext, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var items = await db.Specialties
            .Where(s => s.IsActive)
            .OrderBy(s => s.DisplayName)
            .Select(s => new ReferenceItemResponse(s.Code.ToString(), s.DisplayName))
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.CacheControl = "private, max-age=60";
        return ApiResults.Ok(items, correlation);
    }

    private static async Task<IResult> GetRegionsAsync(
        IdentityServiceDbContext db, HttpContext httpContext, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var items = await db.Regions
            .Where(r => r.IsActive)
            .OrderBy(r => r.DisplayName)
            .Select(r => new ReferenceItemResponse(r.Code.ToString(), r.DisplayName))
            .ToListAsync(cancellationToken);

        httpContext.Response.Headers.CacheControl = "private, max-age=60";
        return ApiResults.Ok(items, correlation);
    }
}
