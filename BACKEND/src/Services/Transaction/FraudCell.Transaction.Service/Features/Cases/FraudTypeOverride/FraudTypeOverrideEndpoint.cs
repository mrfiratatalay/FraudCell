using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.FraudTypeOverride;

public sealed record FraudTypeOverrideRequest(FraudType FraudType, string Reason);

public sealed record FraudTypeOverrideResponse(
    string CaseId, string? AiFraudType, string PreviousEffectiveFraudType, string EffectiveFraudType,
    string OverriddenBy, DateTimeOffset OverriddenAt, long Version);

/// <summary><c>PATCH /api/v1/cases/{caseId}/fraud-type</c>.</summary>
public static class FraudTypeOverrideEndpoint
{
    public static void MapFraudTypeOverride(this IEndpointRouteBuilder app)
    {
        app.MapPatch("/api/v1/cases/{caseId}/fraud-type", HandleAsync)
           .WithName("OverrideFraudType")
           .WithTags("Cases")
           .ProducesApi<FraudTypeOverrideResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, FraudTypeOverrideRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("Override nedeni zorunludur.");
        }

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();
        if (role == RoleNames.Analyst && riskCase.AssignedAnalystId != userId)
        {
            throw AppException.NotFound();
        }

        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        if (riskCase.EffectiveFraudType == request.FraudType)
        {
            throw AppException.Validation("Yeni fraud türü mevcut değerden farklı olmalıdır.");
        }

        var transaction = await db.Transactions.SingleAsync(t => t.Id == riskCase.TransactionId, cancellationToken);
        var primaryAssessment = await db.AiAssessments.AsNoTracking()
            .SingleOrDefaultAsync(a => a.TransactionId == riskCase.TransactionId && a.IsPrimary, cancellationToken);
        var now = clock.UtcNow;
        var previousValue = riskCase.EffectiveFraudType?.ToString() ?? "null";

        riskCase.OverrideFraudType(request.FraudType, now);
        transaction.EffectiveFraudType = request.FraudType;
        transaction.UpdatedAt = now;
        transaction.Version++;

        db.CaseOverrides.Add(new CaseOverride
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = caseId,
            OverrideType = OverrideType.FRAUD_TYPE,
            PreviousValue = previousValue,
            NewValue = request.FraudType.ToString(),
            Reason = request.Reason,
            ActorId = userId,
            ActorRole = role,
            OccurredAt = now,
        });

        outboxWriter.Enqueue(TransactionEventTypes.CaseFraudTypeOverridden, caseId, new
        {
            caseId,
            transactionId = transaction.Id,
            previousFraudType = previousValue,
            newFraudType = request.FraudType.ToString(),
            overriddenBy = userId,
            overriddenAt = now,
        });

        await db.SaveChangesAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);
        return ApiResults.Ok(new FraudTypeOverrideResponse(
            caseId, primaryAssessment?.FraudType.ToString(), previousValue, request.FraudType.ToString(), userId, now, riskCase.Version), correlation);
    }
}
