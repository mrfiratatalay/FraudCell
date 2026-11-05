using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FraudCell.Identity.Service.Persistence;

/// <summary>
/// Uygulama acilisinda referans verilerin (roller, uzmanliklar, bolgeler) var
/// oldugunu garanti eder ve (yalnizca yapilandirma ile acikca istenirse) ilk
/// admin hesabini olusturur.
/// </summary>
public static class IdentitySeed
{
    private static readonly (string Code, string DisplayName)[] RoleSeed =
    [
        (RoleNames.Customer, "Müşteri"),
        (RoleNames.Analyst, "Fraud Analisti"),
        (RoleNames.Supervisor, "Süpervizör"),
        (RoleNames.Admin, "Admin"),
    ];

    private static readonly (AnalystSpecialty Code, string DisplayName)[] SpecialtySeed =
    [
        (AnalystSpecialty.CALINTI_KART, "Çalıntı Kart"),
        (AnalystSpecialty.HESAP_ELE_GECIRME, "Hesap Ele Geçirme"),
        (AnalystSpecialty.PARA_AKLAMA, "Para Aklama"),
        (AnalystSpecialty.SUPHELI_DAVRANIS, "Şüpheli Davranış"),
    ];

    private static readonly (OperationRegion Code, string DisplayName)[] RegionSeed =
    [
        (OperationRegion.MARMARA, "Marmara"),
        (OperationRegion.EGE, "Ege"),
        (OperationRegion.AKDENIZ, "Akdeniz"),
        (OperationRegion.IC_ANADOLU, "Ic Anadolu"),
        (OperationRegion.KARADENIZ, "Karadeniz"),
        (OperationRegion.DOGU_ANADOLU, "Dogu Anadolu"),
        (OperationRegion.GUNEYDOGU_ANADOLU, "Guneydogu Anadolu"),
        (OperationRegion.YURT_DISI, "Yurt Disi"),
    ];

    public static async Task RunAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<ApplicationRole>>();
        var db = services.GetRequiredService<IdentityServiceDbContext>();
        var clock = services.GetRequiredService<IClock>();

        foreach (var (code, displayName) in RoleSeed)
        {
            if (!await roleManager.RoleExistsAsync(code))
            {
                await roleManager.CreateAsync(new ApplicationRole(code, displayName) { CreatedAt = clock.UtcNow });
            }
        }

        foreach (var (code, displayName) in SpecialtySeed)
        {
            var existing = await db.Specialties.SingleOrDefaultAsync(s => s.Code == code);
            if (existing is not null)
            {
                existing.DisplayName = displayName;
            }
            else
            {
                db.Specialties.Add(new Specialty
                {
                    Id = Ulid.NewUlid().ToString(),
                    Code = code,
                    DisplayName = displayName,
                    CreatedAt = clock.UtcNow,
                });
            }
        }

        foreach (var (code, displayName) in RegionSeed)
        {
            var existing = await db.Regions.SingleOrDefaultAsync(r => r.Code == code);
            if (existing is not null)
            {
                existing.DisplayName = displayName;
            }
            else
            {
                db.Regions.Add(new Region
                {
                    Id = Ulid.NewUlid().ToString(),
                    Code = code,
                    DisplayName = displayName,
                    CreatedAt = clock.UtcNow,
                });
            }
        }

        await db.SaveChangesAsync();

        await EnsureSeedAdminAsync(services);
    }

    private static async Task EnsureSeedAdminAsync(IServiceProvider services)
    {
        var configuration = services.GetRequiredService<IConfiguration>();
        var environment = services.GetRequiredService<IHostEnvironment>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("IdentitySeed");

        var adminEmail = configuration["Seed:AdminEmail"];
        var adminPassword = configuration["Seed:AdminPassword"];

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            return;
        }

        if (!environment.IsDevelopment())
        {
            logger.LogWarning("Seed:AdminEmail/Seed:AdminPassword ignored outside Development environment.");
            return;
        }

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        if (await userManager.FindByEmailAsync(adminEmail) is not null)
        {
            return;
        }

        var clock = services.GetRequiredService<IClock>();
        var db = services.GetRequiredService<IdentityServiceDbContext>();

        var admin = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            UserType = UserType.Staff,
            CreatedAt = clock.UtcNow,
        };

        var result = await userManager.CreateAsync(admin, adminPassword);
        if (!result.Succeeded)
        {
            logger.LogError(
                "Failed to seed development admin account: {Errors}",
                string.Join(", ", result.Errors.Select(e => e.Description)));
            return;
        }

        await userManager.AddToRoleAsync(admin, RoleNames.Admin);

        db.StaffProfiles.Add(new StaffProfile
        {
            UserId = admin.Id,
            FirstName = "Seed",
            LastName = "Admin",
            CreatedByAdminId = admin.Id,
            CreatedAt = clock.UtcNow,
            AssignmentEnabled = false,
        });

        await db.SaveChangesAsync();

        logger.LogWarning("Seeded development admin account {Email}. Do not use this in production.", adminEmail);
    }
}
