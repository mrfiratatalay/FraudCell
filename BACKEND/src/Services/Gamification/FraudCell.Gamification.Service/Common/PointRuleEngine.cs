using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Gamification.Service.Domain;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Gamification.Service.Common;

/// <summary>The customer's answer to a verification request (case §4.5).</summary>
public enum CustomerVerdict
{
    None,
    Mine,
    NotMine,
}

/// <summary>A final case decision as the scoring rules need it.</summary>
public sealed record CaseDecision(
    string SourceEventId, string AnalystId, string CaseId, string? FraudType, string? RiskLevel, bool SlaCompliant,
    DateTimeOffset DecidedAt, DateTimeOffset CaseCreatedAt, bool IsBlock, CustomerVerdict CustomerVerdict = CustomerVerdict.None);

/// <summary>
/// Puan kurallarini uygulayan merkezi motor (dokuman `00-START-HERE.md` §17,
/// `06-DATA-ARCHITECTURE.md` §49-57). Ground-truth tanimi (bir kararin
/// "dogru" sayilmasi) <c>11-GAMIFICATION-DESIGN.md</c> henuz yazilmadigi icin
/// burada belgelenen basit ve tutarli bir yorumla uygulanir: bir karar,
/// aksi musteri geri bildirimiyle (false positive) kanitlanana kadar dogru
/// kabul edilir (bkz. <see cref="ApplyFalsePositivePenaltyAsync"/>).
/// </summary>
public sealed class PointRuleEngine(GamificationServiceDbContext db, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting)
{
    private const int FastDecisionSeconds = 15 * 60;
    private const int MarathonDailyThreshold = 20;
    private const int SharpEyeThreshold = 10;
    private const int CrisisManagerThreshold = 10;
    private const int SpecialistHunterThreshold = 50;
    private const int ZeroErrorThreshold = 50;

    public async Task ApplyCaseDecisionAsync(CaseDecision decision, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var (sourceEventId, analystId, caseId, fraudType, riskLevel, slaCompliant, decidedAt, caseCreatedAt, isBlockDecision, _) = decision;
        var decisionSeconds = Math.Max(0, (decidedAt - caseCreatedAt).TotalSeconds);
        var isFast = decisionSeconds <= FastDecisionSeconds;
        var isCritical = string.Equals(riskLevel, "KRITIK", StringComparison.Ordinal);

        var awarded = new List<(string RuleCode, int Points, string Description)>
        {
            (RuleCodes.CaseDecision, 10, "Vaka karari verildi."),
        };

        if (isFast)
        {
            awarded.Add((RuleCodes.FastDecision, 5, "Karar 15 dakikadan kisa surede verildi."));
        }

        if (isBlockDecision)
        {
            awarded.Add((RuleCodes.ConfirmedFraud, 15, "Dolandiricilik teyit edildi."));
        }

        if (isCritical && slaCompliant)
        {
            awarded.Add((RuleCodes.CriticalWithinSla, 15, "Kritik vaka SLA icinde cozuldu."));
        }

        var totalAwarded = 0;
        foreach (var (ruleCode, points, description) in awarded)
        {
            db.PointLedger.Add(new PointLedgerEntry
            {
                Id = Ulid.NewUlid().ToString(),
                AnalystId = analystId,
                SourceEventId = sourceEventId,
                CaseId = caseId,
                RuleCode = ruleCode,
                Points = points,
                Description = description,
                OccurredAt = decidedAt,
                CreatedAt = now,
            });

            db.RuleEvaluations.Add(new RuleEvaluation
            {
                Id = Ulid.NewUlid().ToString(),
                SourceEventId = sourceEventId,
                AnalystId = analystId,
                CaseId = caseId,
                RuleCode = ruleCode,
                Result = RuleEvaluationResult.APPLIED,
                EvaluatedAt = now,
            });

            totalAwarded += points;
        }

        var summary = await GetOrCreateSummaryAsync(analystId, now, cancellationToken);
        var previousLevel = summary.Level;

        summary.TotalPoints += totalAwarded;
        summary.TotalDecisions += 1;
        summary.Level = LevelThresholds.Calculate(summary.DisplayTotalPoints);
        summary.UpdatedAt = now;
        summary.Version++;

        await UpdatePeriodStatsAsync(analystId, decidedAt, totalAwarded, isFast, isBlockDecision, decisionSeconds, now, cancellationToken);
        await UpdatePerformanceAsync(analystId, decisionSeconds, slaCompliant, now, cancellationToken);

        if (fraudType is not null && fraudType != "TEMIZ")
        {
            await UpdateFraudTypeStatAsync(analystId, fraudType, isBlockDecision, now, cancellationToken);
        }

        outboxWriter.Enqueue(GamificationEventTypes.PointsAwarded, analystId, new
        {
            analystId,
            caseId,
            totalPoints = totalAwarded,
            breakdown = awarded.Select(a => new { ruleCode = a.RuleCode, points = a.Points, description = a.Description }),
            newTotalPoints = summary.DisplayTotalPoints,
            awardedAt = now,
        });

        crossCutting.PublishNotification(analystId, "POINTS_AWARDED", "Puan kazandiniz", $"Bu vaka icin +{totalAwarded} puan kazandiniz.", "CASE", caseId);

        if (summary.Level != previousLevel)
        {
            outboxWriter.Enqueue(GamificationEventTypes.AnalystLevelChanged, analystId, new { analystId, previousLevel = previousLevel.ToString(), newLevel = summary.Level.ToString() });
        }

        await EvaluateBadgesAsync(analystId, sourceEventId, decidedAt, isFast, isCritical && slaCompliant, fraudType, isBlockDecision, now, cancellationToken);
    }

    public async Task ApplySlaBreachPenaltyAsync(string sourceEventId, string analystId, string caseId, DateTimeOffset breachedAt, DateTimeOffset now, CancellationToken cancellationToken)
    {
        const int penalty = -5;

        db.PointLedger.Add(new PointLedgerEntry
        {
            Id = Ulid.NewUlid().ToString(),
            AnalystId = analystId,
            SourceEventId = sourceEventId,
            CaseId = caseId,
            RuleCode = RuleCodes.SlaBreach,
            Points = penalty,
            Description = "SLA suresi asildi.",
            OccurredAt = breachedAt,
            CreatedAt = now,
        });

        var summary = await GetOrCreateSummaryAsync(analystId, now, cancellationToken);
        summary.TotalPoints += penalty;
        summary.Level = LevelThresholds.Calculate(summary.DisplayTotalPoints);
        summary.UpdatedAt = now;
        summary.Version++;

        var performance = await GetOrCreatePerformanceAsync(analystId, now, cancellationToken);
        performance.SlaBreachCount++;
        performance.UpdatedAt = now;
        performance.Version++;

        outboxWriter.Enqueue(GamificationEventTypes.PointsDeducted, analystId, new { analystId, caseId, points = penalty, ruleCode = RuleCodes.SlaBreach, deductedAt = now });
    }

    /// <summary>
    /// Musteri "bu benim islemim degildi ama analist onaylamis" gibi dusuk puanli
    /// geri bildirim verdiginde false positive cezasi uygular (bkz. sinif ust yorumu).
    /// </summary>
    public async Task ApplyFalsePositivePenaltyAsync(string sourceEventId, string analystId, string caseId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        const int penalty = -8;

        var alreadyApplied = await db.PointLedger.AnyAsync(p => p.SourceEventId == sourceEventId && p.RuleCode == RuleCodes.FalsePositive, cancellationToken);
        if (alreadyApplied)
        {
            return;
        }

        db.PointLedger.Add(new PointLedgerEntry
        {
            Id = Ulid.NewUlid().ToString(),
            AnalystId = analystId,
            SourceEventId = sourceEventId,
            CaseId = caseId,
            RuleCode = RuleCodes.FalsePositive,
            Points = penalty,
            Description = "Musteri geri bildirimine gore yanlis pozitif.",
            OccurredAt = now,
            CreatedAt = now,
        });

        var summary = await GetOrCreateSummaryAsync(analystId, now, cancellationToken);
        summary.TotalPoints += penalty;
        summary.Level = LevelThresholds.Calculate(summary.DisplayTotalPoints);
        summary.UpdatedAt = now;
        summary.Version++;

        var performance = await GetOrCreatePerformanceAsync(analystId, now, cancellationToken);
        performance.FalsePositiveCount++;
        performance.CorrectDecisions = Math.Max(0, performance.CorrectDecisions - 1);
        performance.AccuracyRate = performance.TotalDecisions > 0 ? (decimal)performance.CorrectDecisions / performance.TotalDecisions : 0.50m;
        performance.UpdatedAt = now;
        performance.Version++;

        outboxWriter.Enqueue(GamificationEventTypes.PointsDeducted, analystId, new { analystId, caseId, points = penalty, ruleCode = RuleCodes.FalsePositive, deductedAt = now });
    }

    private async Task<AnalystScoreSummary> GetOrCreateSummaryAsync(string analystId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // FindAsync also sees rows added earlier in this unit of work.
        var summary = await db.ScoreSummaries.FindAsync([analystId], cancellationToken);
        if (summary is null)
        {
            summary = new AnalystScoreSummary { AnalystId = analystId, UpdatedAt = now };
            db.ScoreSummaries.Add(summary);
        }

        return summary;
    }

    private async Task<AnalystPerformanceSummary> GetOrCreatePerformanceAsync(string analystId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var performance = await db.PerformanceSummaries.FindAsync([analystId], cancellationToken);
        if (performance is null)
        {
            performance = new AnalystPerformanceSummary { AnalystId = analystId, UpdatedAt = now };
            db.PerformanceSummaries.Add(performance);
        }

        return performance;
    }

    private async Task UpdatePeriodStatsAsync(
        string analystId, DateTimeOffset decidedAt, int totalAwarded, bool isFast, bool isConfirmedFraud, double decisionSeconds, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var statDate = DateOnly.FromDateTime(decidedAt.UtcDateTime);
        var weekStart = StartOfIsoWeek(statDate);

        var daily = await db.DailyStats.FindAsync([analystId, statDate], cancellationToken);
        if (daily is null)
        {
            daily = new AnalystDailyStat { AnalystId = analystId, StatDate = statDate, UpdatedAt = now };
            db.DailyStats.Add(daily);
        }

        ApplyStatIncrement(daily, totalAwarded, isFast, isConfirmedFraud, decisionSeconds, now);

        var weekly = await db.WeeklyStats.FindAsync([analystId, weekStart], cancellationToken);
        if (weekly is null)
        {
            weekly = new AnalystWeeklyStat { AnalystId = analystId, WeekStartDate = weekStart, UpdatedAt = now };
            db.WeeklyStats.Add(weekly);
        }

        ApplyStatIncrement(weekly, totalAwarded, isFast, isConfirmedFraud, decisionSeconds, now);
    }

    private static void ApplyStatIncrement(IPeriodStat stat, int totalAwarded, bool isFast, bool isConfirmedFraud, double decisionSeconds, DateTimeOffset now)
    {
        var previousCount = stat.DecisionCount;
        var previousAverage = stat.AverageDecisionSeconds ?? 0;

        stat.Points += totalAwarded;
        stat.DecisionCount = previousCount + 1;
        stat.FastDecisionCount += isFast ? 1 : 0;
        stat.ConfirmedFraudCount += isConfirmedFraud ? 1 : 0;
        stat.AverageDecisionSeconds = ((previousAverage * previousCount) + decisionSeconds) / (previousCount + 1);
        stat.UpdatedAt = now;
        stat.Version += 1;
    }

    private static DateOnly StartOfIsoWeek(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return date.AddDays(-diff);
    }

    private async Task UpdatePerformanceAsync(string analystId, double decisionSeconds, bool slaCompliant, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var performance = await GetOrCreatePerformanceAsync(analystId, now, cancellationToken);

        performance.TotalDecisions++;
        performance.CorrectDecisions++; // Optimistic: false positive feedback'i sonradan azaltir.
        performance.SlaCompliantCount += slaCompliant ? 1 : 0;
        performance.TotalDecisionSeconds += (long)decisionSeconds;
        performance.AverageDecisionSeconds = performance.TotalDecisions > 0 ? (double)performance.TotalDecisionSeconds / performance.TotalDecisions : null;
        performance.AccuracyRate = performance.TotalDecisions > 0 ? (decimal)performance.CorrectDecisions / performance.TotalDecisions : 0.50m;
        performance.UpdatedAt = now;
        performance.Version++;

        outboxWriter.Enqueue(GamificationEventTypes.AnalystPerformanceUpdated, analystId, new
        {
            analystId,
            totalDecisions = performance.TotalDecisions,
            correctDecisions = performance.CorrectDecisions,
            falsePositiveCount = performance.FalsePositiveCount,
            slaCompliantCount = performance.SlaCompliantCount,
            averageDecisionSeconds = performance.AverageDecisionSeconds,
            accuracyRate = performance.AccuracyRate,
            updatedAt = now,
        });
    }

    private async Task UpdateFraudTypeStatAsync(string analystId, string fraudType, bool isConfirmedFraud, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var stat = await db.FraudTypeStats.FindAsync([analystId, fraudType], cancellationToken);
        if (stat is null)
        {
            stat = new AnalystFraudTypeStat { AnalystId = analystId, FraudType = fraudType, UpdatedAt = now };
            db.FraudTypeStats.Add(stat);
        }

        stat.DecisionCount++;
        stat.ConfirmedFraudCount += isConfirmedFraud ? 1 : 0;
        stat.CorrectDecisionCount++;
        stat.AccuracyRate = stat.DecisionCount > 0 ? (decimal)stat.CorrectDecisionCount / stat.DecisionCount : 0m;
        stat.UpdatedAt = now;
        stat.Version++;
    }

    /// <summary>
    /// Case §6.2 badges. Runs before the decision is saved, so every count below
    /// includes this decision (tracked rows), not only what is in the database.
    /// </summary>
    private async Task EvaluateBadgesAsync(
        string analystId, string sourceEventId, DateTimeOffset decidedAt, bool isFast, bool isCriticalWithinSla, string? fraudType, bool isConfirmedFraud,
        DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (isConfirmedFraud)
        {
            await TryAwardBadgeAsync(analystId, BadgeCodes.FirstCatch, sourceEventId, now, cancellationToken);
        }

        if (isFast && await CountRuleAsync(analystId, RuleCodes.FastDecision, cancellationToken) >= SharpEyeThreshold)
        {
            await TryAwardBadgeAsync(analystId, BadgeCodes.SharpEye, sourceEventId, now, cancellationToken);
        }

        var performance = await GetOrCreatePerformanceAsync(analystId, now, cancellationToken);
        if (performance is { TotalDecisions: >= ZeroErrorThreshold, FalsePositiveCount: 0 })
        {
            await TryAwardBadgeAsync(analystId, BadgeCodes.ZeroError, sourceEventId, now, cancellationToken);
        }

        var daily = await db.DailyStats.FindAsync([analystId, DateOnly.FromDateTime(decidedAt.UtcDateTime)], cancellationToken);
        if (daily is { DecisionCount: >= MarathonDailyThreshold })
        {
            await TryAwardBadgeAsync(analystId, BadgeCodes.Marathon, sourceEventId, now, cancellationToken);
        }

        if (isCriticalWithinSla && await CountRuleAsync(analystId, RuleCodes.CriticalWithinSla, cancellationToken) >= CrisisManagerThreshold)
        {
            await TryAwardBadgeAsync(analystId, BadgeCodes.CrisisManager, sourceEventId, now, cancellationToken);
        }

        if (fraudType is not null && fraudType != "TEMIZ" && isConfirmedFraud)
        {
            var typeStat = await db.FraudTypeStats.FindAsync([analystId, fraudType], cancellationToken);
            if (typeStat is not null && typeStat.ConfirmedFraudCount >= SpecialistHunterThreshold)
            {
                await TryAwardBadgeAsync(analystId, BadgeCodes.SpecialistHunter, sourceEventId, now, cancellationToken);
            }
        }
    }

    /// <summary>Ledger rows for a rule, saved ones plus the ones this decision just added.</summary>
    private async Task<int> CountRuleAsync(string analystId, string ruleCode, CancellationToken cancellationToken) =>
        await db.PointLedger.CountAsync(p => p.AnalystId == analystId && p.RuleCode == ruleCode, cancellationToken)
        + db.PointLedger.Local.Count(p => p.AnalystId == analystId && p.RuleCode == ruleCode && db.Entry(p).State == EntityState.Added);

    private async Task TryAwardBadgeAsync(string analystId, string badgeCode, string sourceEventId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var badge = await db.BadgeDefinitions.SingleOrDefaultAsync(b => b.Code == badgeCode, cancellationToken);
        if (badge is null)
        {
            return;
        }

        var alreadyEarned = await db.EarnedBadges.AnyAsync(b => b.AnalystId == analystId && b.BadgeId == badge.Id, cancellationToken);
        if (alreadyEarned)
        {
            return;
        }

        var earnedBadge = new EarnedBadge
        {
            Id = Ulid.NewUlid().ToString(),
            AnalystId = analystId,
            BadgeId = badge.Id,
            SourceEventId = sourceEventId,
            EarnedAt = now,
            CreatedAt = now,
        };

        db.EarnedBadges.Add(earnedBadge);

        var summary = await GetOrCreateSummaryAsync(analystId, now, cancellationToken);
        summary.TotalBadges++;
        summary.UpdatedAt = now;
        summary.Version++;

        outboxWriter.Enqueue(GamificationEventTypes.BadgeEarned, analystId, new { analystId, badgeCode, displayName = badge.DisplayName, earnedAt = now });
        crossCutting.PublishNotification(analystId, "BADGE_EARNED", "Yeni rozet kazandiniz", $"{badge.DisplayName} rozetini kazandiniz.", "BADGE", badge.Code);
    }
}
