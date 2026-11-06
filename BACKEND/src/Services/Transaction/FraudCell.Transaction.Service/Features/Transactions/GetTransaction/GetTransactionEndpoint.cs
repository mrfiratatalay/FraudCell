using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Transactions.GetTransaction;

public sealed record ReasonCodeResponse(string Code, string Label, string Impact);

public sealed record AssessmentResponse(
    string Status, decimal? RiskScore, string? RiskLevel, string? ScreeningDecision,
    string? FraudType, string? ModelVersion, IReadOnlyList<ReasonCodeResponse> ReasonCodes, DateTimeOffset? AssessedAt);

public sealed record TransactionDetailResponse(
    string TransactionId, string TransactionNo, decimal Amount, string Currency, string TransactionType,
    RecipientResponse Recipient, LocationResponse Location, DateTimeOffset OccurredAt,
    AssessmentResponse Assessment, string ControlStatus, string? CaseId, string? CaseStatus, int? FeedbackRating, DateTimeOffset CreatedAt, long Version);

public sealed record RecipientResponse(string Reference);

public sealed record LocationResponse(string City, string CountryCode);

/// <summary><c>GET /api/v1/transactions/{transactionId}</c>. Musteri yalnizca kendi islemini gorur.</summary>
public static class GetTransactionEndpoint
{
    public static void MapGetTransaction(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/transactions/{transactionId}", HandleAsync)
           .WithName("GetTransaction")
           .WithTags("Transactions")
           .ProducesApi<TransactionDetailResponse>()
           .RequireAuthorization();
    }

    private static async Task<IResult> HandleAsync(
        string transactionId, HttpContext httpContext, TransactionServiceDbContext db,
        CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var txn = await db.Transactions.AsNoTracking().SingleOrDefaultAsync(t => t.Id == transactionId, cancellationToken);
        if (txn is null)
        {
            throw AppException.NotFound();
        }

        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();

        var riskCase = await db.RiskCases.AsNoTracking().SingleOrDefaultAsync(c => c.TransactionId == transactionId, cancellationToken);

        // Case §3.3: a customer sees their own transactions, an analyst only the ones
        // whose case is assigned to them. 404, not 403, so the id's existence does not leak.
        var canRead = role switch
        {
            RoleNames.Customer => txn.CustomerId == userId,
            RoleNames.Analyst => riskCase?.AssignedAnalystId == userId,
            RoleNames.Supervisor or RoleNames.Admin => true,
            _ => false,
        };

        if (!canRead)
        {
            throw AppException.NotFound();
        }

        var assessment = await db.AiAssessments.AsNoTracking()
            .Where(a => a.TransactionId == transactionId && a.IsPrimary)
            .SingleOrDefaultAsync(cancellationToken);

        var reasonCodes = assessment is null
            ? []
            : System.Text.Json.JsonSerializer.Deserialize<List<ReasonCodeResponse>>(assessment.ReasonCodesJson, JsonDefaults.Events) ?? [];

        // The customer rates a closed case once (case §4.6); the screen needs to know whether it already did.
        int? feedbackRating = riskCase is null
            ? null
            : await db.CustomerFeedbacks.AsNoTracking()
                .Where(f => f.CaseId == riskCase.Id)
                .Select(f => (int?)f.Rating)
                .SingleOrDefaultAsync(cancellationToken);

        httpContext.Response.Headers.ETag = $"\"{txn.Version}\"";

        var response = new TransactionDetailResponse(
            txn.Id, txn.TransactionNo, txn.Amount, txn.Currency, txn.TransactionType.ToString(),
            new RecipientResponse(txn.RecipientReference), new LocationResponse(txn.City, txn.CountryCode), txn.OccurredAt,
            new AssessmentResponse(
                txn.AssessmentStatus.ToString(), txn.EffectiveRiskScore, txn.EffectiveRiskLevel?.ToString(),
                txn.AssessmentStatus == AssessmentStatus.COMPLETED ? txn.ScreeningDecision.ToString() : null,
                txn.EffectiveFraudType?.ToString(), assessment?.ModelVersion, reasonCodes, assessment?.AssessedAt),
            txn.ControlStatus.ToString(), riskCase?.Id, riskCase?.Status.ToString(), feedbackRating, txn.CreatedAt, txn.Version);

        return ApiResults.Ok(response, correlation);
    }
}
