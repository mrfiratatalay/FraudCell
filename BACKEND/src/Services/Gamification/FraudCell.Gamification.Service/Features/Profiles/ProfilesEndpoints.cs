using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Gamification.Service.Features.Profiles;

public sealed record BadgeSummaryResponse(string Code, string DisplayName, DateTimeOffset EarnedAt);

public sealed record ProfileResponse(
    string AnalystId, string? DisplayName, long TotalPoints, string Level, int? DailyRank, int? WeeklyRank,
    int TotalDecisions, double? AverageDecisionSeconds, decimal AccuracyRate, IReadOnlyList<BadgeSummaryResponse> Badges);

public sealed record PointLedgerItemResponse(string LedgerId, string? CaseId, string RuleCode, int Points, string Description, DateTimeOffset OccurredAt);

/// <summary>
/// <c>GET /api/v1/game/profiles/me</c>, <c>/{analystId}</c>, <c>/{analystId}/points</c>,
/// <c>/{analystId}/badges</c>.
/// </summary>
public static class ProfilesEndpoints
{
    public static void MapProfiles(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/game/profiles/me", GetMineAsync).WithName("GetMyProfile").WithTags("Gamification")
           .ProducesApi<ProfileResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst));

        app.MapGet("/api/v1/game/profiles/{analystId}", GetOneAsync).WithName("GetAnalystProfile").WithTags("Gamification")
           .ProducesApi<ProfileResponse>()
           .RequireAuthorization();

        app.MapGet("/api/v1/game/profiles/{analystId}/points", GetPointsAsync).WithName("GetAnalystPoints").WithTags("Gamification")
           .ProducesApi<IReadOnlyList<PointLedgerItemResponse>>()
           .RequireAuthorization();

        app.MapGet("/api/v1/game/profiles/{analystId}/badges", GetBadgesAsync).WithName("GetAnalystBadges").WithTags("Gamification")
           .ProducesApi<IReadOnlyList<BadgeSummaryResponse>>()
           .RequireAuthorization();
    }

    private static Task<IResult> GetMineAsync(HttpContext httpContext, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
        => BuildProfileAsync(httpContext.User.FindFirstValue("sub")!, db, correlation, cancellationToken);

    private static async Task<IResult> GetOneAsync(
        string analystId, HttpContext httpContext, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        RequireSelfOrPrivileged(httpContext, analystId);
        return await BuildProfileAsync(analystId, db, correlation, cancellationToken);
    }

    private static async Task<IResult> BuildProfileAsync(string analystId, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var profile = await db.AnalystProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.AnalystId == analystId, cancellationToken);
        var summary = await db.ScoreSummaries.AsNoTracking().SingleOrDefaultAsync(s => s.AnalystId == analystId, cancellationToken);
        var performance = await db.PerformanceSummaries.AsNoTracking().SingleOrDefaultAsync(p => p.AnalystId == analystId, cancellationToken);

        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.UtcDateTime);
        var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));

        var dailyRank = await RankAsync(db.DailyStats.AsNoTracking().Where(d => d.StatDate == today), analystId, cancellationToken);
        var weeklyRank = await RankAsync(db.WeeklyStats.AsNoTracking().Where(w => w.WeekStartDate == weekStart), analystId, cancellationToken);

        var badges = await db.EarnedBadges.AsNoTracking()
            .Where(b => b.AnalystId == analystId)
            .Join(db.BadgeDefinitions, b => b.BadgeId, d => d.Id, (b, d) => new { d.Code, d.DisplayName, b.EarnedAt })
            .OrderByDescending(b => b.EarnedAt)
            .Select(b => new BadgeSummaryResponse(b.Code, b.DisplayName, b.EarnedAt))
            .ToListAsync(cancellationToken);

        var response = new ProfileResponse(
            analystId, profile?.DisplayName, summary?.DisplayTotalPoints ?? 0, (summary?.Level ?? Domain.AnalystLevel.BRONZ).ToString(),
            dailyRank, weeklyRank, performance?.TotalDecisions ?? 0, performance?.AverageDecisionSeconds, performance?.AccuracyRate ?? 0.50m, badges);

        return ApiResults.Ok(response, correlation);
    }

    private static async Task<int?> RankAsync<TStat>(IQueryable<TStat> query, string analystId, CancellationToken cancellationToken)
        where TStat : Domain.IPeriodStat
    {
        // Basit ve acik siralama: puanina gore azalan. Buyuk veri setlerinde
        // window function tercih edilebilir; leaderboard olcegi kucuktur.
        var ordered = await query.OrderByDescending(s => s.Points).ToListAsync(cancellationToken);
        var index = ordered.FindIndex(s => s.AnalystId == analystId);
        return index < 0 ? null : index + 1;
    }

    private static async Task<IResult> GetPointsAsync(
        string analystId, HttpContext httpContext, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken, int limit = 20)
    {
        RequireSelfOrPrivileged(httpContext, analystId);
        limit = Math.Clamp(limit, 1, 100);

        var items = await db.PointLedger.AsNoTracking()
            .Where(p => p.AnalystId == analystId)
            .OrderByDescending(p => p.OccurredAt)
            .Take(limit)
            .Select(p => new PointLedgerItemResponse(p.Id, p.CaseId, p.RuleCode, p.Points, p.Description, p.OccurredAt))
            .ToListAsync(cancellationToken);

        return ApiResults.Ok(items, correlation);
    }

    private static async Task<IResult> GetBadgesAsync(
        string analystId, HttpContext httpContext, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        RequireSelfOrPrivileged(httpContext, analystId);

        var badges = await db.EarnedBadges.AsNoTracking()
            .Where(b => b.AnalystId == analystId)
            .Join(db.BadgeDefinitions, b => b.BadgeId, d => d.Id, (b, d) => new { d.Code, d.DisplayName, b.EarnedAt })
            .OrderByDescending(b => b.EarnedAt)
            .Select(b => new BadgeSummaryResponse(b.Code, b.DisplayName, b.EarnedAt))
            .ToListAsync(cancellationToken);

        return ApiResults.Ok(badges, correlation);
    }

    private static void RequireSelfOrPrivileged(HttpContext httpContext, string analystId)
    {
        var role = httpContext.User.FindFirstValue("role");
        var userId = httpContext.User.FindFirstValue("sub");

        var isSelf = string.Equals(userId, analystId, StringComparison.Ordinal);
        var isPrivileged = role is RoleNames.Supervisor or RoleNames.Admin;

        if (!isSelf && !isPrivileged)
        {
            throw AppException.Forbidden();
        }
    }
}
