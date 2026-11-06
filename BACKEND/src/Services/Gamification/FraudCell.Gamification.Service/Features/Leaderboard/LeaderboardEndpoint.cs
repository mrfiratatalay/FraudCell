using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Gamification.Service.Features.Leaderboard;

public sealed record LeaderboardItemResponse(int Rank, string AnalystId, string? DisplayName, long Points, string Level, int DecisionCount, int BadgeCount);

public sealed record LeaderboardResponse(string Period, DateTimeOffset PeriodStart, DateTimeOffset PeriodEnd, IReadOnlyList<LeaderboardItemResponse> Items);

/// <summary><c>GET /api/v1/game/leaderboard?period=daily|weekly</c>. Maksimum limit 10.</summary>
public static class LeaderboardEndpoint
{
    private const int MaxLimit = 10;

    public static void MapLeaderboard(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/game/leaderboard", HandleAsync)
           .WithName("GetLeaderboard")
           .WithTags("Gamification")
           .ProducesApi<LeaderboardResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Staff));
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken,
        string period = "daily", int limit = 10)
    {
        limit = Math.Clamp(limit, 1, MaxLimit);

        if (period is not ("daily" or "weekly"))
        {
            throw AppException.Validation("period 'daily' veya 'weekly' olmalıdır.");
        }

        var now = DateTimeOffset.UtcNow;
        List<LeaderboardItemResponse> items;
        DateTimeOffset periodStart;
        DateTimeOffset periodEnd;

        if (period == "daily")
        {
            var today = DateOnly.FromDateTime(now.UtcDateTime);
            periodStart = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            periodEnd = periodStart.AddDays(1);

            var stats = await db.DailyStats.AsNoTracking()
                .Where(d => d.StatDate == today)
                .OrderByDescending(d => d.Points)
                .Take(limit)
                .ToListAsync(cancellationToken);

            items = await ProjectAsync(db, stats.Select(s => (s.AnalystId, s.Points, s.DecisionCount)), cancellationToken);
        }
        else
        {
            var today = DateOnly.FromDateTime(now.UtcDateTime);
            var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
            periodStart = weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            periodEnd = periodStart.AddDays(7);

            var stats = await db.WeeklyStats.AsNoTracking()
                .Where(w => w.WeekStartDate == weekStart)
                .OrderByDescending(w => w.Points)
                .Take(limit)
                .ToListAsync(cancellationToken);

            items = await ProjectAsync(db, stats.Select(s => (s.AnalystId, s.Points, s.DecisionCount)), cancellationToken);
        }

        return ApiResults.Ok(new LeaderboardResponse(period, periodStart, periodEnd, items), correlation);
    }

    private static async Task<List<LeaderboardItemResponse>> ProjectAsync(
        GamificationServiceDbContext db, IEnumerable<(string AnalystId, long Points, int DecisionCount)> stats, CancellationToken cancellationToken)
    {
        var list = stats.ToList();
        var analystIds = list.Select(s => s.AnalystId).ToList();

        var profiles = await db.AnalystProfiles.AsNoTracking().Where(p => analystIds.Contains(p.AnalystId)).ToDictionaryAsync(p => p.AnalystId, cancellationToken);
        var summaries = await db.ScoreSummaries.AsNoTracking().Where(s => analystIds.Contains(s.AnalystId)).ToDictionaryAsync(s => s.AnalystId, cancellationToken);
        var badgeCounts = await db.EarnedBadges.AsNoTracking().Where(b => analystIds.Contains(b.AnalystId))
            .GroupBy(b => b.AnalystId).Select(g => new { AnalystId = g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.AnalystId, g => g.Count, cancellationToken);

        var result = new List<LeaderboardItemResponse>(list.Count);
        for (var i = 0; i < list.Count; i++)
        {
            var (analystId, points, decisionCount) = list[i];
            profiles.TryGetValue(analystId, out var profile);
            summaries.TryGetValue(analystId, out var summary);
            badgeCounts.TryGetValue(analystId, out var badgeCount);

            result.Add(new LeaderboardItemResponse(
                i + 1, analystId, profile?.DisplayName, points, (summary?.Level ?? Domain.AnalystLevel.BRONZ).ToString(), decisionCount, badgeCount));
        }

        return result;
    }
}
