using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.RiskLevelOverride;

public sealed record RiskLevelOverrideRequest(RiskLevel RiskLevel, string Reason);

public sealed record RiskLevelOverrideSlaResponse(string Priority, DateTimeOffset StartedAt, DateTimeOffset DeadlineAt, DateTimeOffset? BreachedAt);

public sealed record RiskLevelOverrideResponse(
    string CaseId, string PreviousRiskLevel, string EffectiveRiskLevel, RiskLevelOverrideSlaResponse Sla, string TransactionControlStatus, long Version);

/// <summary><c>PATCH /api/v1/cases/{caseId}/risk-level</c> (dokuman §47, yalnizca Supervisor).</summary>
public static class RiskLevelOverrideEndpoint
{
    public static void MapRiskLevelOverride(this IEndpointRouteBuilder app)
    {
        app.MapPatch("/api/v1/cases/{caseId}/risk-level", HandleAsync)
           .WithName("OverrideRiskLevel")
           .WithTags("Cases")
           .ProducesApi<RiskLevelOverrideResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, RiskLevelOverrideRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("Override nedeni zorunludur.");
        }

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();
        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        if (riskCase.EffectiveRiskLevel == request.RiskLevel)
        {
            throw AppException.Validation("Yeni risk seviyesi mevcut değerden farklı olmalıdır.");
        }

        var transaction = await db.Transactions.SingleAsync(t => t.Id == riskCase.TransactionId, cancellationToken);
        var supervisorId = httpContext.RequireUserId();
        var now = clock.UtcNow;
        var previousValue = riskCase.EffectiveRiskLevel?.ToString() ?? "null";

        riskCase.OverrideRiskLevel(request.RiskLevel, now);
        transaction.EffectiveRiskLevel = request.RiskLevel;
        transaction.UpdatedAt = now;
        transaction.Version++;

        db.CaseOverrides.Add(new CaseOverride
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = caseId,
            OverrideType = OverrideType.RISK_LEVEL,
            PreviousValue = previousValue,
            NewValue = request.RiskLevel.ToString(),
            Reason = request.Reason,
            ActorId = supervisorId,
            ActorRole = RoleNames.Supervisor,
            OccurredAt = now,
        });

        outboxWriter.Enqueue(TransactionEventTypes.CaseRiskLevelOverridden, caseId, new
        {
            caseId,
            transactionId = transaction.Id,
            previousRiskLevel = previousValue,
            newRiskLevel = request.RiskLevel.ToString(),
            overriddenBy = supervisorId,
            overriddenAt = now,
        });

        await db.SaveChangesAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);
        return ApiResults.Ok(new RiskLevelOverrideResponse(
            caseId, previousValue, request.RiskLevel.ToString(),
            new RiskLevelOverrideSlaResponse(riskCase.SlaPriority.ToString(), riskCase.SlaStartedAt, riskCase.SlaDeadlineAt, riskCase.SlaBreachedAt),
            transaction.ControlStatus.ToString(), riskCase.Version), correlation);
    }
}
