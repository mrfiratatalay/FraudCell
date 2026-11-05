using FraudCell.Gamification.Service.Common;
using FraudCell.Gamification.Service.Domain;
using FraudCell.Gamification.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Xunit;

namespace FraudCell.Gamification.Service.Tests;

/// <summary>
/// The point table, badges and leaderboard of case §6, checked on a real
/// PostgreSQL. Each decision is applied and saved in its own scope, the way
/// the <c>case.decision.made</c> consumer does it.
/// </summary>
public sealed class PointRuleEngineTests(GamificationDatabaseFixture fixture) : IClassFixture<GamificationDatabaseFixture>
{
    private static readonly DateTimeOffset DecidedAt = new(2026, 11, 5, 9, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Fast = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Slow = TimeSpan.FromMinutes(20);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // Case §6.1: +10 every decision, +5 under 15 minutes, +15 customer-confirmed
    // block, +15 KRITIK within SLA, -8 block of a legitimate transaction.
    [Theory]
    [InlineData(false, "ORTA", 5, true, CustomerVerdict.None, 15)]
    [InlineData(false, "ORTA", 20, true, CustomerVerdict.None, 10)]
    [InlineData(false, "KRITIK", 5, true, CustomerVerdict.None, 30)]
    [InlineData(false, "KRITIK", 20, false, CustomerVerdict.None, 10)]
    [InlineData(true, "ORTA", 5, true, CustomerVerdict.None, 15)]
    [InlineData(true, "ORTA", 5, true, CustomerVerdict.NotMine, 30)]
    [InlineData(true, "ORTA", 5, true, CustomerVerdict.Mine, 7)]
    [InlineData(true, "KRITIK", 5, true, CustomerVerdict.NotMine, 45)]
    public async Task Decision_scores_follow_the_point_table(
        bool block, string riskLevel, int minutes, bool slaCompliant, CustomerVerdict verdict, int expectedPoints)
    {
        var analystId = NewId();

        await DecideAsync(analystId, block, verdict, riskLevel, TimeSpan.FromMinutes(minutes), slaCompliant);

        (await TotalPointsAsync(analystId)).ShouldBe(expectedPoints);
        (await DailyPointsAsync(analystId)).ShouldBe(expectedPoints);
    }

    [Fact]
    public async Task Block_without_customer_confirmation_gets_no_confirmed_fraud_bonus()
    {
        var analystId = NewId();

        await DecideAsync(analystId, block: true);

        await using var scope = fixture.Services.CreateAsyncScope();
        var db = Db(scope);
        (await db.PointLedger.AnyAsync(p => p.AnalystId == analystId && p.RuleCode == RuleCodes.ConfirmedFraud, Ct)).ShouldBeFalse();
        (await BadgesAsync(analystId)).ShouldNotContain(BadgeCodes.FirstCatch);
    }

    [Fact]
    public async Task First_confirmed_block_earns_first_catch()
    {
        var analystId = NewId();

        await DecideAsync(analystId, block: true, CustomerVerdict.NotMine);

        (await BadgesAsync(analystId)).ShouldBe([BadgeCodes.FirstCatch]);
        await using var scope = fixture.Services.CreateAsyncScope();
        (await Db(scope).ScoreSummaries.SingleAsync(s => s.AnalystId == analystId, Ct)).TotalBadges.ShouldBe(1);
    }

    [Fact]
    public async Task Block_the_customer_owned_counts_as_a_false_positive()
    {
        var analystId = NewId();

        await DecideAsync(analystId, block: true, CustomerVerdict.Mine);

        await using var scope = fixture.Services.CreateAsyncScope();
        var performance = await Db(scope).PerformanceSummaries.SingleAsync(p => p.AnalystId == analystId, Ct);
        performance.FalsePositiveCount.ShouldBe(1);
        performance.CorrectDecisions.ShouldBe(0);
        (await BadgesAsync(analystId)).ShouldNotContain(BadgeCodes.FirstCatch);
    }

    [Fact]
    public async Task Approving_what_the_customer_denied_is_not_a_correct_decision()
    {
        var analystId = NewId();

        await DecideAsync(analystId, block: false, CustomerVerdict.NotMine);

        await using var scope = fixture.Services.CreateAsyncScope();
        var performance = await Db(scope).PerformanceSummaries.SingleAsync(p => p.AnalystId == analystId, Ct);
        performance.TotalDecisions.ShouldBe(1);
        performance.CorrectDecisions.ShouldBe(0);
    }

    [Fact]
    public async Task Sharp_eye_is_earned_on_the_tenth_fast_decision()
    {
        var analystId = NewId();

        for (var i = 0; i < 9; i++)
        {
            await DecideAsync(analystId, block: false);
        }

        (await BadgesAsync(analystId)).ShouldNotContain(BadgeCodes.SharpEye);
        await DecideAsync(analystId, block: false);
        (await BadgesAsync(analystId)).ShouldContain(BadgeCodes.SharpEye);
    }

    [Fact]
    public async Task Marathon_is_earned_on_the_twentieth_decision_of_a_day()
    {
        var analystId = NewId();

        for (var i = 0; i < 19; i++)
        {
            await DecideAsync(analystId, block: false, took: Slow);
        }

        (await BadgesAsync(analystId)).ShouldNotContain(BadgeCodes.Marathon);
        await DecideAsync(analystId, block: false, took: Slow);
        (await BadgesAsync(analystId)).ShouldContain(BadgeCodes.Marathon);
    }

    [Fact]
    public async Task Zero_error_is_earned_on_the_fiftieth_decision_without_a_false_positive()
    {
        var analystId = NewId();

        for (var i = 0; i < 49; i++)
        {
            await DecideAsync(analystId, block: false, took: Slow);
        }

        (await BadgesAsync(analystId)).ShouldNotContain(BadgeCodes.ZeroError);
        await DecideAsync(analystId, block: false, took: Slow);
        (await BadgesAsync(analystId)).ShouldContain(BadgeCodes.ZeroError);
    }

    [Fact]
    public async Task Sla_breach_penalty_also_lowers_the_leaderboard_points()
    {
        var analystId = NewId();
        await DecideAsync(analystId, block: false);

        await using (var scope = fixture.Services.CreateAsyncScope())
        {
            await Engine(scope).ApplySlaBreachPenaltyAsync(NewId(), analystId, NewId(), DecidedAt, DecidedAt, Ct);
            await Db(scope).SaveChangesAsync(Ct);
        }

        (await TotalPointsAsync(analystId)).ShouldBe(10);
        (await DailyPointsAsync(analystId)).ShouldBe(10);
        (await WeeklyPointsAsync(analystId)).ShouldBe(10);
    }

    private async Task DecideAsync(
        string analystId, bool block, CustomerVerdict verdict = CustomerVerdict.None, string riskLevel = "ORTA",
        TimeSpan? took = null, bool slaCompliant = true)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var decision = new CaseDecision(
            NewId(), analystId, NewId(), "CALINTI_KART", riskLevel, slaCompliant, DecidedAt, DecidedAt - (took ?? Fast), block, verdict);

        await Engine(scope).ApplyCaseDecisionAsync(decision, DecidedAt, Ct);
        await Db(scope).SaveChangesAsync(Ct);
    }

    private async Task<long> TotalPointsAsync(string analystId)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        return (await Db(scope).ScoreSummaries.SingleAsync(s => s.AnalystId == analystId, Ct)).TotalPoints;
    }

    private async Task<long> DailyPointsAsync(string analystId)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        return (await Db(scope).DailyStats.SingleAsync(d => d.AnalystId == analystId, Ct)).Points;
    }

    private async Task<long> WeeklyPointsAsync(string analystId)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        return (await Db(scope).WeeklyStats.SingleAsync(w => w.AnalystId == analystId, Ct)).Points;
    }

    private async Task<List<string>> BadgesAsync(string analystId)
    {
        await using var scope = fixture.Services.CreateAsyncScope();
        var db = Db(scope);
        return await db.EarnedBadges
            .Where(e => e.AnalystId == analystId)
            .Join(db.BadgeDefinitions, e => e.BadgeId, b => b.Id, (_, b) => b.Code)
            .ToListAsync(Ct);
    }

    private static GamificationServiceDbContext Db(AsyncServiceScope scope) => scope.ServiceProvider.GetRequiredService<GamificationServiceDbContext>();

    private static PointRuleEngine Engine(AsyncServiceScope scope) => scope.ServiceProvider.GetRequiredService<PointRuleEngine>();

    private static string NewId() => Ulid.NewUlid().ToString();
}
