using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.Reassignment;

public sealed record ReassignmentRequest(string NewAnalystId, string Reason);

public sealed record ReassignmentResponse(string CaseId, string? PreviousAnalystId, string AssignedAnalystId, DateTimeOffset ReassignedAt, string CaseStatus, long Version);

/// <summary><c>POST /api/v1/cases/{caseId}/reassignments</c>. Case state korunur.</summary>
public static class ReassignmentEndpoint
{
    public static void MapReassignment(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/cases/{caseId}/reassignments", HandleAsync)
           .WithName("ReassignCase")
           .WithTags("Cases")
           .ProducesApi<ReassignmentResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, ReassignmentRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting, CaseTransitionRecorder transitions,
        AssignmentService assignmentService, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        if (string.IsNullOrWhiteSpace(request.NewAnalystId) || string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("newAnalystId ve reason zorunludur.");
        }

        await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();
        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        if (request.NewAnalystId == riskCase.AssignedAnalystId)
        {
            throw AppException.Validation("Yeni analist mevcut analistle ayni olamaz.");
        }

        var supervisorId = httpContext.RequireUserId();
        var now = clock.UtcNow;
        var previousAnalystId = riskCase.AssignedAnalystId;
        var previousStatus = riskCase.Status;
        var versionBefore = riskCase.Version;

        await assignmentService.AssignSpecificAnalystAsync(request.NewAnalystId, now, cancellationToken);

        var oldAssignment = await db.CaseAssignments
            .Where(a => a.CaseId == caseId && (a.Status == CaseAssignmentStatus.ASSIGNED || a.Status == CaseAssignmentStatus.IN_PROGRESS))
            .SingleOrDefaultAsync(cancellationToken);

        if (oldAssignment is not null)
        {
            oldAssignment.Status = CaseAssignmentStatus.CANCELLED;
            oldAssignment.EndedAt = now;
        }

        db.CaseAssignments.Add(new CaseAssignment
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = caseId,
            AnalystId = request.NewAnalystId,
            AssignmentSource = AssignmentSource.SUPERVISOR,
            AssignedBy = supervisorId,
            AssignmentReason = request.Reason,
            AssignedAt = now,
            CreatedAt = now,
        });

        riskCase.Reassign(request.NewAnalystId, now);

        if (previousAnalystId is not null)
        {
            await assignmentService.ReleaseAsync(previousAnalystId, now, cancellationToken);
        }

        transitions.Record(riskCase, previousStatus, supervisorId, RoleNames.Supervisor, TransitionSource.SUPERVISOR, request.Reason, null, versionBefore);
        crossCutting.PublishAudit(supervisorId, RoleNames.Supervisor, AuditActions.Reassignment, "SUCCESS", "risk_case", caseId, httpContext.GetClientIp());

        outboxWriter.Enqueue(TransactionEventTypes.CaseAssigned, caseId, new
        {
            caseId,
            analystId = request.NewAnalystId,
            previousAnalystId,
            assignmentSource = "SUPERVISOR",
            assignedAt = now,
        });

        crossCutting.PublishNotification(request.NewAnalystId, "CASE_ASSIGNED", "Yeni vaka atandı", "Size yeni bir risk vakası atandı.", "CASE", caseId);

        await db.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);
        return ApiResults.Ok(new ReassignmentResponse(caseId, previousAnalystId, request.NewAnalystId, now, riskCase.Status.ToString(), riskCase.Version), correlation);
    }
}
