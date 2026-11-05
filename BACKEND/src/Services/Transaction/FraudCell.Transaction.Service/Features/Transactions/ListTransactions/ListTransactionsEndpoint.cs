using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Transactions.ListTransactions;

public sealed record TransactionListItemResponse(
    string TransactionId, string TransactionNo, decimal Amount, string Currency, string TransactionType,
    string AssessmentStatus, string DisplayRiskLevel, string ScreeningDecision, string ControlStatus, DateTimeOffset CreatedAt);

/// <summary><c>GET /api/v1/transactions</c> (dokuman §36). Musteri yalnizca kendi islemlerini gorur.</summary>
public static class ListTransactionsEndpoint
{
    public static void MapListTransactions(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/transactions", HandleAsync)
           .WithName("ListTransactions")
           .WithTags("Transactions")
           .ProducesApi<CursorPage<TransactionListItemResponse>>()
           .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext,
        TransactionServiceDbContext db,
        CorrelationContext correlation,
        CancellationToken cancellationToken,
        string? customerId = null,
        string? assessmentStatus = null,
        string? riskLevel = null,
        string? cursor = null,
        int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 100);
        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();

        var query = db.Transactions.AsNoTracking().AsQueryable();

        if (role == RoleNames.Customer)
        {
            query = query.Where(t => t.CustomerId == userId);
        }
        else if (role is RoleNames.Supervisor or RoleNames.Admin)
        {
            if (!string.IsNullOrWhiteSpace(customerId))
            {
                query = query.Where(t => t.CustomerId == customerId);
            }
        }
        else
        {
            throw AppException.Forbidden();
        }

        if (!string.IsNullOrWhiteSpace(assessmentStatus))
        {
            if (!Enum.TryParse<AssessmentStatus>(assessmentStatus, out var parsedStatus))
            {
                throw AppException.Validation("Geçersiz assessmentStatus.", new Dictionary<string, object?> { ["field"] = "assessmentStatus" });
            }

            query = query.Where(t => t.AssessmentStatus == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(riskLevel))
        {
            if (!Enum.TryParse<RiskLevel>(riskLevel, out var parsedLevel))
            {
                throw AppException.Validation("Geçersiz riskLevel.", new Dictionary<string, object?> { ["field"] = "riskLevel" });
            }

            query = query.Where(t => t.EffectiveRiskLevel == parsedLevel);
        }

        var cursorTime = CursorCodec.TryDecode(cursor);
        if (cursorTime is not null)
        {
            query = query.Where(t => t.CreatedAt < cursorTime);
        }

        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit + 1)
            .Select(t => new TransactionListItemResponse(
                t.Id, t.TransactionNo, t.Amount, t.Currency, t.TransactionType.ToString(),
                t.AssessmentStatus.ToString(), t.EffectiveRiskLevel != null ? t.EffectiveRiskLevel.ToString()! : "BELIRSIZ",
                t.ScreeningDecision.ToString(), t.ControlStatus.ToString(), t.CreatedAt))
            .ToListAsync(cancellationToken);

        var hasMore = items.Count > limit;
        var page = items.Take(limit).ToList();
        var nextCursor = hasMore ? CursorCodec.Encode(page[^1].CreatedAt) : null;

        return ApiResults.Ok(new CursorPage<TransactionListItemResponse>(page, new PageInfo(nextCursor, hasMore, limit)), correlation);
    }
}
