using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.StartReview;

public sealed record StartReviewResponse(string CaseId, string PreviousStatus, string Status, DateTimeOffset? ReviewStartedAt, long Version);

/// <summary><c>POST /api/v1/cases/{caseId}/review</c>. ATANDI -&gt; INCELENIYOR.</summary>
public static class StartReviewEndpoint
{
    public static void MapStartReview(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/cases/{caseId}/review", HandleAsync)
           .WithName("StartCaseReview")
           .WithTags("Cases")
           .ProducesApi<StartReviewResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, HttpContext httpContext, TransactionServiceDbContext db, IClock clock,
        OutboxWriter outboxWriter, CaseTransitionRecorder transitions, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();
        var isSupervisor = role == RoleNames.Supervisor;

        if (role == RoleNames.Analyst && riskCase.AssignedAnalystId != userId)
        {
            throw AppException.NotFound();
        }

        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        var previousStatus = riskCase.Status;
        var versionBefore = riskCase.Version;
        var now = clock.UtcNow;

        riskCase.StartReview(userId, isSupervisor, now);

        if (riskCase.Status != previousStatus)
        {
            transitions.Record(riskCase, previousStatus, userId, role, TransitionSource.ANALYST, null, null, versionBefore);
            outboxWriter.Enqueue(TransactionEventTypes.CaseReviewStarted, riskCase.Id, new { caseId = riskCase.Id, analystId = userId, reviewStartedAt = now });
        }

        await db.SaveChangesAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);
        return ApiResults.Ok(new StartReviewResponse(riskCase.Id, previousStatus.ToString(), riskCase.Status.ToString(), riskCase.ReviewStartedAt, riskCase.Version), correlation);
    }
}
