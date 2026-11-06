using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.ListCases;

public sealed record AssignmentQueueItemResponse(
    string CaseId, string TransactionNo, string AssignmentStatus, string? ManualReviewReason,
    string DisplayRiskLevel, string SlaPriority, DateTimeOffset SlaDeadlineAt, DateTimeOffset CreatedAt, long Version);

/// <summary>
/// <c>GET /api/v1/cases</c> (Supervisor/Admin), <c>GET /api/v1/cases/assigned</c>
/// (Analyst) ve <c>GET /api/v1/cases/assignment-queue</c> (Supervisor) — 
/// </summary>
public static class ListCasesEndpoints
{
    public static void MapListCases(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/cases", ListAllAsync)
           .WithName("ListCases").WithTags("Cases")
           .ProducesApi<CursorPage<CaseResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Supervisor, RoleNames.Admin));

        app.MapGet("/api/v1/cases/assigned", ListAssignedAsync)
           .WithName("ListAssignedCases").WithTags("Cases")
           .ProducesApi<CursorPage<CaseResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst));

        app.MapGet("/api/v1/cases/assignment-queue", ListAssignmentQueueAsync)
           .WithName("GetAssignmentQueue").WithTags("Cases")
           .ProducesApi<CursorPage<AssignmentQueueItemResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Supervisor, RoleNames.Admin));
    }

    private static async Task<IResult> ListAllAsync(
        HttpContext httpContext, TransactionServiceDbContext db, IClock clock, CorrelationContext correlation,
        CancellationToken cancellationToken, string? status = null, string? riskLevel = null, string? cursor = null, int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 100);
        var query = db.RiskCases.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<CaseStatus>(status, out var parsedStatus))
            {
                throw AppException.Validation("Geçersiz status.");
            }

            query = query.Where(c => c.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(riskLevel))
        {
            if (!Enum.TryParse<RiskLevel>(riskLevel, out var parsedLevel))
            {
                throw AppException.Validation("Geçersiz riskLevel.");
            }

            query = query.Where(c => c.EffectiveRiskLevel == parsedLevel);
        }

        var cursorTime = CursorCodec.TryDecode(cursor);
        if (cursorTime is not null)
        {
            query = query.Where(c => c.CreatedAt < cursorTime);
        }

        var cases = await query.OrderByDescending(c => c.CreatedAt).Take(limit + 1).ToListAsync(cancellationToken);
        return await BuildPageAsync(cases, limit, db, clock, correlation, cancellationToken);
    }

    private static async Task<IResult> ListAssignedAsync(
        HttpContext httpContext, TransactionServiceDbContext db, IClock clock, CorrelationContext correlation,
        CancellationToken cancellationToken, string? status = null, int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 100);
        var analystId = httpContext.RequireUserId();

        var query = db.RiskCases.AsNoTracking().Where(c => c.AssignedAnalystId == analystId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<CaseStatus>(status, out var parsedStatus))
            {
                throw AppException.Validation("Geçersiz status.");
            }

            query = query.Where(c => c.Status == parsedStatus);
        }
        else
        {
            query = query.Where(c => c.Status != CaseStatus.KAPANDI);
        }

        // Case §11.2: the analyst works the riskiest case first; a breached SLA (KRITIK on top, §4.4) jumps the line.
        var cases = await query
            .OrderByDescending(c => c.SlaBreachedAt != null)
            .ThenByDescending(c => c.EffectiveRiskScore ?? 0m)
            .ThenBy(c => c.SlaDeadlineAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
        return await BuildPageAsync(cases, limit, db, clock, correlation, cancellationToken);
    }

    private static async Task<IResult> ListAssignmentQueueAsync(
        TransactionServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken,
        string queueType = "ALL", int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 100);

        // Case §7: the waiting queue holds both BELIRSIZ cases (AI down → MANUAL_QUEUE)
        // and cases waiting for analyst capacity (QUEUED); ALL shows them together.
        AssignmentStatus[] statuses = queueType switch
        {
            "ALL" => [AssignmentStatus.QUEUED, AssignmentStatus.MANUAL_QUEUE],
            nameof(AssignmentStatus.QUEUED) => [AssignmentStatus.QUEUED],
            nameof(AssignmentStatus.MANUAL_QUEUE) => [AssignmentStatus.MANUAL_QUEUE],
            _ => throw AppException.Validation("queueType ALL, QUEUED veya MANUAL_QUEUE olmalıdır."),
        };

        var cases = await db.RiskCases.AsNoTracking()
            .Where(c => statuses.Contains(c.AssignmentStatus))
            .OrderBy(c => c.SlaDeadlineAt)
            .Take(limit)
            .Join(db.Transactions, c => c.TransactionId, t => t.Id, (c, t) => new AssignmentQueueItemResponse(
                c.Id, t.TransactionNo, c.AssignmentStatus.ToString(), t.ManualReviewReason,
                c.EffectiveRiskLevel != null ? c.EffectiveRiskLevel.ToString()! : "BELIRSIZ",
                c.SlaPriority.ToString(), c.SlaDeadlineAt, c.CreatedAt, c.Version))
            .ToListAsync(cancellationToken);

        return ApiResults.Ok(new CursorPage<AssignmentQueueItemResponse>(cases, new PageInfo(null, false, limit)), correlation);
    }

    private static async Task<IResult> BuildPageAsync(
        List<RiskCase> cases, int limit, TransactionServiceDbContext db, IClock clock, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var hasMore = cases.Count > limit;
        var page = cases.Take(limit).ToList();

        var transactionIds = page.Select(c => c.TransactionId).ToList();
        var transactions = await db.Transactions.AsNoTracking()
            .Where(t => transactionIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        var items = page.Select(c => CaseProjector.Project(c, transactions[c.TransactionId], clock)).ToList();
        var nextCursor = hasMore ? CursorCodec.Encode(page[^1].CreatedAt) : null;

        return ApiResults.Ok(new CursorPage<CaseResponse>(items, new PageInfo(nextCursor, hasMore, limit)), correlation);
    }
}
