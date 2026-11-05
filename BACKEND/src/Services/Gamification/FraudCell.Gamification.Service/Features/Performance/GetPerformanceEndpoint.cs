using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Gamification.Service.Features.Performance;

public sealed record FraudTypeStatResponse(string FraudType, int DecisionCount, int ConfirmedFraudCount, decimal AccuracyRate);

public sealed record PerformanceResponse(
    string AnalystId, int TotalDecisions, int CorrectDecisions, int FalsePositiveCount, int SlaCompliantCount, int SlaBreachCount,
    double? AverageDecisionSeconds, decimal AccuracyRate, IReadOnlyList<FraudTypeStatResponse> FraudTypeBreakdown);

/// <summary><c>GET /api/v1/game/performance/{analystId}</c>.</summary>
public static class GetPerformanceEndpoint
{
    public static void MapGetPerformance(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/game/performance/{analystId}", HandleAsync)
           .WithName("GetAnalystPerformance")
           .WithTags("Gamification")
           .ProducesApi<PerformanceResponse>()
           .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        string analystId, HttpContext httpContext, GamificationServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var role = httpContext.User.FindFirstValue("role");
        var userId = httpContext.User.FindFirstValue("sub");
        var isSelf = string.Equals(userId, analystId, StringComparison.Ordinal);

        if (!isSelf && role is not (RoleNames.Supervisor or RoleNames.Admin))
        {
            throw AppException.Forbidden();
        }

        var performance = await db.PerformanceSummaries.AsNoTracking().SingleOrDefaultAsync(p => p.AnalystId == analystId, cancellationToken);
        var fraudTypeStats = await db.FraudTypeStats.AsNoTracking()
            .Where(s => s.AnalystId == analystId)
            .Select(s => new FraudTypeStatResponse(s.FraudType, s.DecisionCount, s.ConfirmedFraudCount, s.AccuracyRate))
            .ToListAsync(cancellationToken);

        var response = new PerformanceResponse(
            analystId,
            performance?.TotalDecisions ?? 0,
            performance?.CorrectDecisions ?? 0,
            performance?.FalsePositiveCount ?? 0,
            performance?.SlaCompliantCount ?? 0,
            performance?.SlaBreachCount ?? 0,
            performance?.AverageDecisionSeconds,
            performance?.AccuracyRate ?? 0.50m,
            fraudTypeStats);

        return ApiResults.Ok(response, correlation);
    }
}
