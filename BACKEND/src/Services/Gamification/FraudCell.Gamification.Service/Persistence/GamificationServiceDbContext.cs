using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Persistence;
using FraudCell.Gamification.Service.Domain;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Gamification.Service.Persistence;

/// <summary>
/// Gamification Service'in TEK veritabani baglantisi:
/// <c>fraudcell_gamification</c> database, <c>game</c> schema).
/// </summary>
public sealed class GamificationServiceDbContext(DbContextOptions<GamificationServiceDbContext> options)
    : DbContext(options), IMessagingDbContext
{
    public const string Schema = "game";

    public DbSet<AnalystProfileProjection> AnalystProfiles => Set<AnalystProfileProjection>();

    public DbSet<PointLedgerEntry> PointLedger => Set<PointLedgerEntry>();

    public DbSet<RuleEvaluation> RuleEvaluations => Set<RuleEvaluation>();

    public DbSet<BadgeDefinition> BadgeDefinitions => Set<BadgeDefinition>();

    public DbSet<EarnedBadge> EarnedBadges => Set<EarnedBadge>();

    public DbSet<AnalystScoreSummary> ScoreSummaries => Set<AnalystScoreSummary>();

    public DbSet<AnalystDailyStat> DailyStats => Set<AnalystDailyStat>();

    public DbSet<AnalystWeeklyStat> WeeklyStats => Set<AnalystWeeklyStat>();

    public DbSet<AnalystPerformanceSummary> PerformanceSummaries => Set<AnalystPerformanceSummary>();

    public DbSet<AnalystFraudTypeStat> FraudTypeStats => Set<AnalystFraudTypeStat>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    DbContext IMessagingDbContext.AsDbContext() => this;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder;
        builder.HasDefaultSchema(Schema);

        builder.Entity<AnalystProfileProjection>(entity =>
        {
            entity.ToTable("analyst_profiles_projection");
            entity.HasKey(e => e.AnalystId);
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.LastSourceEventId).HasMaxLength(26);
        });

        builder.Entity<PointLedgerEntry>(entity =>
        {
            entity.ToTable("point_ledger");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.AnalystId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.SourceEventId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.CaseId).HasMaxLength(26);
            entity.Property(e => e.TransactionId).HasMaxLength(26);
            entity.Property(e => e.RuleCode).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Description).HasColumnType("text").IsRequired();

            entity.HasIndex(e => new { e.SourceEventId, e.RuleCode }).IsUnique().HasDatabaseName("ux_point_ledger_event_rule");
            entity.HasIndex(e => new { e.AnalystId, e.OccurredAt }).HasDatabaseName("ix_point_ledger_analyst_time");
            entity.HasIndex(e => e.CaseId).HasDatabaseName("ix_point_ledger_case").HasFilter("case_id IS NOT NULL");
            entity.HasIndex(e => new { e.OccurredAt, e.AnalystId }).HasDatabaseName("ix_point_ledger_daily");

            entity.ToTable(t => t.HasCheckConstraint("ck_point_ledger_nonzero", "points <> 0"));
        });

        builder.Entity<RuleEvaluation>(entity =>
        {
            entity.ToTable("rule_evaluations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.SourceEventId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26);
            entity.Property(e => e.RuleCode).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Result).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Reason).HasColumnType("text");

            entity.HasIndex(e => new { e.SourceEventId, e.RuleCode }).IsUnique().HasDatabaseName("ux_rule_evaluations_event_rule");
        });

        builder.Entity<BadgeDefinition>(entity =>
        {
            entity.ToTable("badge_definitions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.Code).HasMaxLength(50).IsRequired();
            entity.Property(e => e.DisplayName).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Description).HasColumnType("text").IsRequired();

            entity.HasIndex(e => e.Code).IsUnique().HasDatabaseName("ux_badge_definitions_code");
        });

        builder.Entity<EarnedBadge>(entity =>
        {
            entity.ToTable("earned_badges");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.AnalystId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.BadgeId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.SourceEventId).HasMaxLength(26).IsRequired();

            entity.HasOne<BadgeDefinition>().WithMany().HasForeignKey(e => e.BadgeId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.AnalystId, e.BadgeId }).IsUnique().HasDatabaseName("ux_earned_badges_analyst_badge");
            entity.HasIndex(e => new { e.AnalystId, e.EarnedAt }).HasDatabaseName("ix_earned_badges_analyst_time");
        });

        builder.Entity<AnalystScoreSummary>(entity =>
        {
            entity.ToTable("analyst_score_summaries");
            entity.HasKey(e => e.AnalystId);
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.Level).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Version).IsConcurrencyToken();
            entity.Ignore(e => e.DisplayTotalPoints);

            entity.ToTable(t => t.HasCheckConstraint("ck_score_summary_nonneg", "total_decisions >= 0 AND total_badges >= 0"));
        });

        builder.Entity<AnalystDailyStat>(entity =>
        {
            entity.ToTable("analyst_daily_stats");
            entity.HasKey(e => new { e.AnalystId, e.StatDate });
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => new { e.StatDate, e.Points, e.AnalystId }).HasDatabaseName("ix_daily_stats_date_points");
        });

        builder.Entity<AnalystWeeklyStat>(entity =>
        {
            entity.ToTable("analyst_weekly_stats");
            entity.HasKey(e => new { e.AnalystId, e.WeekStartDate });
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => new { e.WeekStartDate, e.Points, e.AnalystId }).HasDatabaseName("ix_weekly_stats_week_points");
        });

        builder.Entity<AnalystPerformanceSummary>(entity =>
        {
            entity.ToTable("analyst_performance_summaries");
            entity.HasKey(e => e.AnalystId);
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.AccuracyRate).HasColumnType("numeric(6,5)");
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.ToTable(t => t.HasCheckConstraint("ck_perf_summary_range", "total_decisions >= 0 AND correct_decisions >= 0 AND accuracy_rate >= 0 AND accuracy_rate <= 1"));
        });

        builder.Entity<AnalystFraudTypeStat>(entity =>
        {
            entity.ToTable("analyst_fraud_type_stats");
            entity.HasKey(e => new { e.AnalystId, e.FraudType });
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.FraudType).HasMaxLength(40);
            entity.Property(e => e.AccuracyRate).HasColumnType("numeric(6,5)");
            entity.Property(e => e.Version).IsConcurrencyToken();
        });

        builder.ApplyMessagingModel();
        builder.ApplySnakeCaseNaming();
    }
}
