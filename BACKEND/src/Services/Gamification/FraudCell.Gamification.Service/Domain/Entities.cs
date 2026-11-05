namespace FraudCell.Gamification.Service.Domain;

/// <summary><c>game.analyst_profiles_projection</c> (dokuman §48). Identity Service authoritative sahibidir.</summary>
public sealed class AnalystProfileProjection
{
    public required string AnalystId { get; set; }

    public string? DisplayName { get; set; }

    public bool IsActive { get; set; } = true;

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public string? LastSourceEventId { get; set; }
}

/// <summary><c>game.point_ledger</c> (dokuman §49). Immutable; ayni source_event_id+rule_code ikinci kez puan uretmez.</summary>
public sealed class PointLedgerEntry
{
    public required string Id { get; set; }

    public required string AnalystId { get; set; }

    public required string SourceEventId { get; set; }

    public string? CaseId { get; set; }

    public string? TransactionId { get; set; }

    public required string RuleCode { get; set; }

    public required int Points { get; set; }

    public required string Description { get; set; }

    public required DateTimeOffset OccurredAt { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }
}

/// <summary><c>game.rule_evaluations</c> (dokuman §50). Demo/hata ayiklamada puanin nedenini aciklar.</summary>
public sealed class RuleEvaluation
{
    public required string Id { get; set; }

    public required string SourceEventId { get; set; }

    public string? AnalystId { get; set; }

    public string? CaseId { get; set; }

    public required string RuleCode { get; set; }

    public required RuleEvaluationResult Result { get; set; }

    public string? Reason { get; set; }

    public required DateTimeOffset EvaluatedAt { get; set; }
}

/// <summary><c>game.badge_definitions</c> (dokuman §51).</summary>
public sealed class BadgeDefinition
{
    public required string Id { get; set; }

    public required string Code { get; set; }

    public required string DisplayName { get; set; }

    public required string Description { get; set; }

    public int CriteriaVersion { get; set; } = 1;

    public bool IsActive { get; set; } = true;

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary><c>game.earned_badges</c> (dokuman §52). Bir badge ayni analiste yalnizca bir kez verilir.</summary>
public sealed class EarnedBadge
{
    public required string Id { get; set; }

    public required string AnalystId { get; set; }

    public required string BadgeId { get; set; }

    public required string SourceEventId { get; set; }

    public required DateTimeOffset EarnedAt { get; set; }

    public int CriteriaVersion { get; set; } = 1;

    public required DateTimeOffset CreatedAt { get; set; }
}

/// <summary><c>game.analyst_score_summaries</c> (dokuman §53). <c>total_points</c> minimum 0 gosterilir.</summary>
public sealed class AnalystScoreSummary
{
    public required string AnalystId { get; set; }

    public long TotalPoints { get; set; }

    public AnalystLevel Level { get; set; } = AnalystLevel.BRONZ;

    public int TotalDecisions { get; set; }

    public int TotalBadges { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }

    public long DisplayTotalPoints => Math.Max(TotalPoints, 0);
}

/// <summary>Gunluk/haftalik istatistik tablolarinin ortak sekli; <see cref="Common.PointRuleEngine"/> ikisini de ayni kodla gunceller.</summary>
public interface IPeriodStat
{
    string AnalystId { get; }

    long Points { get; set; }

    int DecisionCount { get; set; }

    int FastDecisionCount { get; set; }

    int ConfirmedFraudCount { get; set; }

    int FalsePositiveCount { get; set; }

    double? AverageDecisionSeconds { get; set; }

    DateTimeOffset UpdatedAt { get; set; }

    long Version { get; set; }
}

/// <summary><c>game.analyst_daily_stats</c> (dokuman §54). Composite key: analyst_id+stat_date.</summary>
public sealed class AnalystDailyStat : IPeriodStat
{
    public required string AnalystId { get; set; }

    public required DateOnly StatDate { get; set; }

    public long Points { get; set; }

    public int DecisionCount { get; set; }

    public int FastDecisionCount { get; set; }

    public int ConfirmedFraudCount { get; set; }

    public int SlaBreachCount { get; set; }

    public int FalsePositiveCount { get; set; }

    public double? AverageDecisionSeconds { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }
}

/// <summary><c>game.analyst_weekly_stats</c> (dokuman §55). Hafta baslangici Pazartesi (Europe/Istanbul).</summary>
public sealed class AnalystWeeklyStat : IPeriodStat
{
    public required string AnalystId { get; set; }

    public required DateOnly WeekStartDate { get; set; }

    public long Points { get; set; }

    public int DecisionCount { get; set; }

    public int FastDecisionCount { get; set; }

    public int ConfirmedFraudCount { get; set; }

    public int SlaBreachCount { get; set; }

    public int FalsePositiveCount { get; set; }

    public double? AverageDecisionSeconds { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }
}

/// <summary><c>game.analyst_performance_summaries</c> (dokuman §56). AI Service'e <c>analyst.performance.updated</c> uretmek icin kullanilir.</summary>
public sealed class AnalystPerformanceSummary
{
    public required string AnalystId { get; set; }

    public int TotalDecisions { get; set; }

    public int CorrectDecisions { get; set; }

    public int FalsePositiveCount { get; set; }

    public int SlaCompliantCount { get; set; }

    public int SlaBreachCount { get; set; }

    public long TotalDecisionSeconds { get; set; }

    public double? AverageDecisionSeconds { get; set; }

    public decimal AccuracyRate { get; set; } = 0.50m;

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }
}

/// <summary><c>game.analyst_fraud_type_stats</c> (dokuman §57). Composite key: analyst_id+fraud_type.</summary>
public sealed class AnalystFraudTypeStat
{
    public required string AnalystId { get; set; }

    public required string FraudType { get; set; }

    public int DecisionCount { get; set; }

    public int ConfirmedFraudCount { get; set; }

    public int CorrectDecisionCount { get; set; }

    public int FalsePositiveCount { get; set; }

    public decimal AccuracyRate { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }
}
