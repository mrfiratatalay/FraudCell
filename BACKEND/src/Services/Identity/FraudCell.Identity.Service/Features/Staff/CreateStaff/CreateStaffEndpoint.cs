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

namespace FraudCell.Identity.Service.Features.Staff.CreateStaff;

public sealed record CreateStaffRequest(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string Role,
    IReadOnlyCollection<AnalystSpecialty> Specialties,
    IReadOnlyCollection<OperationRegion> Regions,
    bool AssignmentEnabled = true);

/// <summary>
/// <c>POST /api/v1/staff</c>. Yalnizca admin
/// personel hesabi olusturabilir. Sifre politikasi ASP.NET Core Identity
/// validator'lari ile, hash'leme Argon2id ile yapilir.
/// </summary>
public static class CreateStaffEndpoint
{
    public static void MapCreateStaff(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/staff", HandleAsync)
           .WithName("CreateStaff")
           .WithTags("Staff")
           .ProducesApi<StaffResponse>(StatusCodes.Status201Created)
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Admin));
    }

    private static async Task<IResult> HandleAsync(
        CreateStaffRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        IdentityServiceDbContext db,
        OutboxWriter outboxWriter,
        AuditWriter auditWriter,
        IClock clock,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
        {
            throw AppException.Validation("Ad ve soyad zorunludur.");
        }

        if (!RoleNames.StaffRoles.Contains(request.Role, StringComparer.Ordinal))
        {
            throw AppException.Validation("Rol ANALYST, SUPERVISOR veya ADMIN olmalıdır.",
                new Dictionary<string, object?> { ["field"] = "role" });
        }

        // Only analysts are matched to cases by specialty (case §5.3); supervisors and admins may have none.
        if (request.Role == RoleNames.Analyst && request.Specialties.Count == 0)
        {
            throw AppException.Validation("Analist için en az bir uzmanlık alanı atanmalıdır.");
        }

        if (request.Regions.Count == 0)
        {
            throw AppException.Validation("En az bir bölge atanmalıdır.");
        }

        var existing = await userManager.FindByEmailAsync(request.Email.Trim());
        if (existing is not null)
        {
            throw new AppException(System.Net.HttpStatusCode.Conflict, ErrorCodes.EmailAlreadyRegistered,
                "Bu e-posta ile zaten bir hesap mevcut.");
        }

        var adminId = httpContext.User.FindFirstValue("sub") ?? throw AppException.Forbidden();

        var now = clock.UtcNow;
        var user = new ApplicationUser
        {
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            UserType = UserType.Staff,
            CreatedAt = now,
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            throw AppException.Validation("Şifre politikası ihlal edildi.",
                new Dictionary<string, object?>
                {
                    ["violations"] = createResult.Errors.Select(e => e.Code).ToArray(),
                    ["messages"] = createResult.Errors.Select(e => e.Description).ToArray(),
                });
        }

        await userManager.AddToRoleAsync(user, request.Role);

        var specialtyIds = await db.Specialties
            .Where(s => request.Specialties.Contains(s.Code))
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        var regionIds = await db.Regions
            .Where(r => request.Regions.Contains(r.Code))
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);

        var profile = new StaffProfile
        {
            UserId = user.Id,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            CreatedByAdminId = adminId,
            CreatedAt = now,
            AssignmentEnabled = request.AssignmentEnabled,
        };

        foreach (var specialtyId in specialtyIds)
        {
            profile.Specialties.Add(new StaffSpecialty { StaffUserId = user.Id, SpecialtyId = specialtyId, AssignedBy = adminId, AssignedAt = now });
        }

        foreach (var regionId in regionIds)
        {
            profile.Regions.Add(new StaffRegion { StaffUserId = user.Id, RegionId = regionId, AssignedBy = adminId, AssignedAt = now });
        }

        db.StaffProfiles.Add(profile);

        outboxWriter.Enqueue(IdentityEventTypes.StaffCreated, user.Id, new { userId = user.Id, role = request.Role, createdAt = now });
        outboxWriter.Enqueue(IdentityEventTypes.StaffProfileUpdated, user.Id, new
        {
            userId = user.Id,
            isActive = true,
            assignmentEnabled = request.AssignmentEnabled,
            specialties = request.Specialties.Select(s => s.ToString()).ToArray(),
            regions = request.Regions.Select(r => r.ToString()).ToArray(),
            displayName = $"{profile.FirstName} {profile.LastName}",
            updatedAt = now,
        });

        auditWriter.Record(adminId, RoleNames.Admin, AuditActions.StaffCreated, AuditResult.Success, "user", user.Id,
            Common.RefreshCookie.GetClientIp(httpContext), $$"""{"role":"{{request.Role}}"}""");

        await db.SaveChangesAsync(cancellationToken);

        var response = await StaffProjector.ProjectAsync(db, userManager, user, cancellationToken);
        ETagHelper.WriteETag(httpContext.Response, response.Version);

        return ApiResults.Created($"/api/v1/staff/{user.Id}", response, correlation);
    }
}
