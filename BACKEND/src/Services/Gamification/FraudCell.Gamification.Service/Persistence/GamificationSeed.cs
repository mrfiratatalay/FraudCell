using FraudCell.BuildingBlocks.Time;
using FraudCell.Gamification.Service.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FraudCell.Gamification.Service.Persistence;

/// <summary>Seed rozet tanimlari.</summary>
public static class GamificationSeed
{
    private static readonly (string Code, string DisplayName, string Description)[] Badges =
    [
        (BadgeCodes.FirstCatch, "İlk Yakalama", "İlk dolandırıcılık vakasını çözdünüz."),
        (BadgeCodes.SharpEye, "Keskin Göz", "15 dakikanın altında 10 karar verdiniz."),
        (BadgeCodes.ZeroError, "Sıfır Hata", "50 vakada yanlış pozitif olmadan karar verdiniz."),
        (BadgeCodes.Marathon, "Maratoncu", "Bir günde 20 vaka kararı verdiniz."),
        (BadgeCodes.CrisisManager, "Kriz Yöneticisi", "10 kritik vakayı SLA içinde çözdünüz."),
        (BadgeCodes.SpecialistHunter, "Uzman Avcı", "Tek fraud türünde 50 dolandırıcılık yakaladınız."),
    ];

    public static async Task RunAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<GamificationServiceDbContext>();
        var clock = services.GetRequiredService<IClock>();
        var now = clock.UtcNow;

        foreach (var (code, displayName, description) in Badges)
        {
            var existing = await db.BadgeDefinitions.SingleOrDefaultAsync(b => b.Code == code);
            if (existing is not null)
            {
                // Keep the wording current on databases seeded by an older version.
                existing.DisplayName = displayName;
                existing.Description = description;
            }
            else
            {
                db.BadgeDefinitions.Add(new BadgeDefinition
                {
                    Id = Ulid.NewUlid().ToString(),
                    Code = code,
                    DisplayName = displayName,
                    Description = description,
                    CreatedAt = now,
                });
            }
        }

        await db.SaveChangesAsync();
    }
}
