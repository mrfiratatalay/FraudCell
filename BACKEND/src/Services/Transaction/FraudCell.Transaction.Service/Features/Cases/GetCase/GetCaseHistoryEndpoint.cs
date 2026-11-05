using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.GetCase;

public sealed record CaseTransitionResponse(
    string Id, string PreviousStatus, string NewStatus, string? ActorId, string? ActorRole,
    string TransitionSource, string? Reason, DateTimeOffset OccurredAt);

/// <summary><c>GET /api/v1/cases/{caseId}/history</c>.</summary>
public static class GetCaseHistoryEndpoint
{
    public static void MapGetCaseHistory(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/cases/{caseId}/history", HandleAsync)
           .WithName("GetCaseHistory")
           .WithTags("Cases")
           .ProducesApi<IReadOnlyList<CaseTransitionResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor, RoleNames.Admin));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, HttpContext httpContext, TransactionServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var riskCase = await db.RiskCases.AsNoTracking().SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        var role = httpContext.RequireRole();
        if (role == RoleNames.Analyst && riskCase.AssignedAnalystId != httpContext.RequireUserId())
        {
            throw AppException.NotFound();
        }

        var history = await db.CaseTransitions.AsNoTracking()
            .Where(t => t.CaseId == caseId)
            .OrderBy(t => t.OccurredAt)
            .Select(t => new CaseTransitionResponse(
                t.Id, t.PreviousStatus.ToString(), t.NewStatus.ToString(), t.ActorId, t.ActorRole,
                t.TransitionSource.ToString(), t.Reason, t.OccurredAt))
            .ToListAsync(cancellationToken);

        return ApiResults.Ok(history, correlation);
    }
}
