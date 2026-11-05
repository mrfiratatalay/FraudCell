using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.Assignment;

public sealed record ManualAssignmentRequest(string AnalystId, string Reason);

public sealed record ManualAssignmentResponse(
    string CaseId, string AssignedAnalystId, string AssignmentStatus, string CaseStatus,
    DateTimeOffset AssignedAt, string AssignmentSource, long Version);

/// <summary><c>PUT /api/v1/cases/{caseId}/assignment</c> (dokuman §48, Supervisor).</summary>
public static class ManualAssignmentEndpoint
{
    public static void MapManualAssignment(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/v1/cases/{caseId}/assignment", HandleAsync)
           .WithName("ManualAssignCase")
           .WithTags("Cases")
           .ProducesApi<ManualAssignmentResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, ManualAssignmentRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting, CaseTransitionRecorder transitions,
        AssignmentService assignmentService, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        if (string.IsNullOrWhiteSpace(request.AnalystId) || string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("analystId ve reason zorunludur.");
        }

        await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();
        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        var supervisorId = httpContext.RequireUserId();
        var now = clock.UtcNow;
        var previousStatus = riskCase.Status;
        var previousAnalystId = riskCase.AssignedAnalystId;
        var versionBefore = riskCase.Version;

        await assignmentService.AssignSpecificAnalystAsync(request.AnalystId, now, cancellationToken);

        if (riskCase.Status == CaseStatus.YENI)
        {
            riskCase.Assign(request.AnalystId, now);
        }
        else
        {
            riskCase.Reassign(request.AnalystId, now);
        }

        db.CaseAssignments.Add(new CaseAssignment
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = caseId,
            AnalystId = request.AnalystId,
            AssignmentSource = AssignmentSource.SUPERVISOR,
            AssignedBy = supervisorId,
            AssignmentReason = request.Reason,
            AssignedAt = now,
            CreatedAt = now,
        });

        if (previousAnalystId is not null && previousAnalystId != request.AnalystId)
        {
            await assignmentService.ReleaseAsync(previousAnalystId, now, cancellationToken);
        }

        transitions.Record(riskCase, previousStatus, supervisorId, RoleNames.Supervisor, TransitionSource.SUPERVISOR, request.Reason, null, versionBefore);

        crossCutting.PublishAudit(supervisorId, RoleNames.Supervisor, AuditActions.ManualAssignment, "SUCCESS", "risk_case", caseId, httpContext.GetClientIp());

        outboxWriter.Enqueue(TransactionEventTypes.CaseAssigned, caseId, new
        {
            caseId,
            analystId = request.AnalystId,
            assignmentSource = "SUPERVISOR",
            assignedAt = now,
        });

        crossCutting.PublishNotification(request.AnalystId, "CASE_ASSIGNED", "Yeni vaka atandı", "Size yeni bir risk vakası atandı.", "CASE", caseId);

        await db.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);
        return ApiResults.Ok(new ManualAssignmentResponse(
            caseId, request.AnalystId, riskCase.AssignmentStatus.ToString(), riskCase.Status.ToString(), now, "SUPERVISOR", riskCase.Version), correlation);
    }
}
