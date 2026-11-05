using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;

namespace FraudCell.Transaction.Service.Common;

/// <summary>Her case state degisikligini append-only gecmise yazar.</summary>
public sealed class CaseTransitionRecorder(TransactionServiceDbContext db, IClock clock, CorrelationContext correlation)
{
    public void Record(
        RiskCase riskCase, CaseStatus previousStatus, string? actorId, string? actorRole,
        TransitionSource source, string? reason, string? sourceEventId, long versionBefore)
    {
        db.CaseTransitions.Add(new CaseTransition
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = riskCase.Id,
            PreviousStatus = previousStatus,
            NewStatus = riskCase.Status,
            ActorId = actorId,
            ActorRole = actorRole,
            TransitionSource = source,
            Reason = reason,
            CorrelationId = correlation.CorrelationId,
            CausationId = correlation.CausationId,
            SourceEventId = sourceEventId,
            CaseVersionBefore = versionBefore,
            CaseVersionAfter = riskCase.Version,
            OccurredAt = clock.UtcNow,
        });
    }
}
