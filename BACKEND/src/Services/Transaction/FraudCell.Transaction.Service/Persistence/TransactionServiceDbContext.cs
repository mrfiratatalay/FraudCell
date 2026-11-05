using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Persistence;
using FraudCell.Transaction.Service.Domain;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Persistence;

/// <summary>
/// Transaction Service'in TEK veritabani baglantisi:
/// <c>fraudcell_transaction</c> database, <c>txn</c> schema).
/// </summary>
public sealed class TransactionServiceDbContext(DbContextOptions<TransactionServiceDbContext> options)
    : DbContext(options), IMessagingDbContext
{
    public const string Schema = "txn";

    public DbSet<TransactionNumberCounter> TransactionNumberCounters => Set<TransactionNumberCounter>();

    public DbSet<Domain.FraudTransaction> Transactions => Set<Domain.FraudTransaction>();

    public DbSet<AiAssessment> AiAssessments => Set<AiAssessment>();

    public DbSet<RiskCase> RiskCases => Set<RiskCase>();

    public DbSet<CaseAssignment> CaseAssignments => Set<CaseAssignment>();

    public DbSet<AnalystEligibilityProjection> AnalystEligibilityProjections => Set<AnalystEligibilityProjection>();

    public DbSet<AnalystWorkload> AnalystWorkloads => Set<AnalystWorkload>();

    public DbSet<CaseTransition> CaseTransitions => Set<CaseTransition>();

    public DbSet<CaseOverride> CaseOverrides => Set<CaseOverride>();

    public DbSet<AnalystNote> AnalystNotes => Set<AnalystNote>();

    public DbSet<CustomerVerification> CustomerVerifications => Set<CustomerVerification>();

    public DbSet<TemporaryBlock> TemporaryBlocks => Set<TemporaryBlock>();

    public DbSet<CustomerFeedback> CustomerFeedbacks => Set<CustomerFeedback>();

    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    DbContext IMessagingDbContext.AsDbContext() => this;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder;
        builder.HasDefaultSchema(Schema);

        builder.Entity<TransactionNumberCounter>(entity =>
        {
            entity.ToTable("transaction_number_counters");
            entity.HasKey(e => e.Year);
            entity.ToTable(t => t.HasCheckConstraint("ck_txn_counter_year", "year >= 2020"));
            entity.ToTable(t => t.HasCheckConstraint("ck_txn_counter_value", "last_value >= 0"));
        });

        builder.Entity<Domain.FraudTransaction>(entity =>
        {
            entity.ToTable("transactions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.TransactionNo).HasMaxLength(32).IsRequired();
            entity.Property(e => e.CustomerId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.Amount).HasColumnType("numeric(18,2)");
            entity.Property(e => e.Currency).HasMaxLength(3).IsFixedLength();
            entity.Property(e => e.TransactionType).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.RecipientReference).HasMaxLength(256).IsRequired();
            entity.Property(e => e.DeviceFingerprintHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.City).HasMaxLength(100).IsRequired();
            entity.Property(e => e.CountryCode).HasMaxLength(2).IsFixedLength();
            entity.Property(e => e.AssessmentStatus).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.EffectiveRiskScore).HasColumnType("numeric(6,5)");
            entity.Property(e => e.EffectiveRiskLevel).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.EffectiveFraudType).HasConversion<string>().HasMaxLength(40);
            entity.Property(e => e.ScreeningDecision).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.ControlStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.ManualReviewReason).HasMaxLength(64);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => e.TransactionNo).IsUnique().HasDatabaseName("ux_transactions_no");
            entity.HasIndex(e => new { e.CustomerId, e.OccurredAt }).HasDatabaseName("ix_transactions_customer_time");
            entity.HasIndex(e => e.AssessmentDeadlineAt).HasDatabaseName("ix_transactions_assessment_pending").HasFilter("assessment_status = 'PENDING'");
            entity.HasIndex(e => new { e.ControlStatus, e.CreatedAt }).HasDatabaseName("ix_transactions_control_status");

            entity.ToTable(t => t.HasCheckConstraint("ck_transactions_amount", "amount > 0"));
        });

        builder.Entity<AiAssessment>(entity =>
        {
            entity.ToTable("ai_assessments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.ExternalAssessmentId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.TransactionId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.SourceEventId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.RiskScore).HasColumnType("numeric(6,5)");
            entity.Property(e => e.RiskLevel).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Decision).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.FraudType).HasConversion<string>().HasMaxLength(40);
            entity.Property(e => e.ModelVersion).HasMaxLength(100).IsRequired();
            entity.Property(e => e.ReasonCodesJson).HasColumnName("reason_codes").HasColumnType("jsonb");
            entity.Property(e => e.AnalystCandidatesJson).HasColumnName("analyst_candidates").HasColumnType("jsonb");
            entity.Property(e => e.PayloadHash).HasMaxLength(128).IsRequired();

            entity.HasOne<Domain.FraudTransaction>().WithMany().HasForeignKey(e => e.TransactionId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.SourceEventId).IsUnique().HasDatabaseName("ux_ai_assessments_source_event");
            entity.HasIndex(e => e.ExternalAssessmentId).IsUnique().HasDatabaseName("ux_ai_assessments_external");
            entity.HasIndex(e => e.TransactionId).IsUnique().HasDatabaseName("ux_ai_assessments_primary").HasFilter("is_primary = true");
            entity.HasIndex(e => new { e.TransactionId, e.ReceivedAt }).HasDatabaseName("ix_ai_assessments_transaction_time");
        });

        ConfigureRiskCase(builder);
        ConfigureCaseAssignment(builder);
        ConfigureProjectionsAndWorkload(builder);
        ConfigureHistoryTables(builder);
        ConfigureVerificationAndFeedback(builder);
        ConfigureIdempotency(builder);

        builder.ApplyMessagingModel();
        builder.ApplySnakeCaseNaming();
    }

    private static void ConfigureRiskCase(ModelBuilder builder)
    {
        builder.Entity<RiskCase>(entity =>
        {
            entity.ToTable("risk_cases");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.TransactionId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.CustomerId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.PrimaryAssessmentId).HasMaxLength(26);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.AssignmentStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.AssignedAnalystId).HasMaxLength(26);
            entity.Property(e => e.EffectiveRiskScore).HasColumnType("numeric(6,5)");
            entity.Property(e => e.EffectiveRiskLevel).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.EffectiveFraudType).HasConversion<string>().HasMaxLength(40);
            entity.Property(e => e.SlaPriority).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.FinalDecision).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.DecisionNote).HasColumnType("text");
            entity.Property(e => e.DecidedBy).HasMaxLength(26);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasOne<Domain.FraudTransaction>().WithMany().HasForeignKey(e => e.TransactionId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.TransactionId).IsUnique().HasDatabaseName("ux_risk_cases_transaction");
            entity.HasIndex(e => e.CreatedAt).HasDatabaseName("ix_cases_manual_queue").HasFilter("assignment_status = 'MANUAL_QUEUE'");
            entity.HasIndex(e => new { e.SlaPriority, e.SlaDeadlineAt }).HasDatabaseName("ix_cases_assignment_queue").HasFilter("assignment_status = 'QUEUED'");
            entity.HasIndex(e => new { e.AssignedAnalystId, e.SlaPriority, e.SlaDeadlineAt })
                  .HasDatabaseName("ix_cases_assigned_analyst")
                  .HasFilter("status IN ('ATANDI', 'INCELENIYOR', 'MUSTERI_DOGRULAMA')");
            entity.HasIndex(e => e.SlaDeadlineAt).HasDatabaseName("ix_cases_sla_due").HasFilter("sla_breached_at IS NULL AND final_decision IS NULL");
            entity.HasIndex(e => e.ClosureDueAt).HasDatabaseName("ix_cases_closure_due").HasFilter("status IN ('ONAYLANDI', 'BLOKLANDI') AND closed_at IS NULL");
            entity.HasIndex(e => new { e.EffectiveRiskLevel, e.Status, e.CreatedAt }).HasDatabaseName("ix_cases_risk_status_time");

            entity.ToTable(t => t.HasCheckConstraint(
                "ck_risk_cases_final_decision",
                "(status IN ('ONAYLANDI','BLOKLANDI','KAPANDI') AND final_decision IS NOT NULL AND decided_at IS NOT NULL) OR (status NOT IN ('ONAYLANDI','BLOKLANDI','KAPANDI'))"));
            entity.ToTable(t => t.HasCheckConstraint(
                "ck_risk_cases_block_note",
                "final_decision <> 'BLOCK' OR (decision_note IS NOT NULL AND char_length(trim(decision_note)) > 0)"));
            entity.ToTable(t => t.HasCheckConstraint("ck_risk_cases_closed", "status <> 'KAPANDI' OR closed_at IS NOT NULL"));
        });
    }

    private static void ConfigureCaseAssignment(ModelBuilder builder)
    {
        builder.Entity<CaseAssignment>(entity =>
        {
            entity.ToTable("case_assignments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.AnalystId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.AssignmentSource).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.AssignedBy).HasMaxLength(26);
            entity.Property(e => e.AssignmentReason).HasColumnType("text");
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasOne<RiskCase>().WithMany().HasForeignKey(e => e.CaseId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CaseId).IsUnique().HasDatabaseName("ux_case_assignments_active_case").HasFilter("status IN ('ASSIGNED', 'IN_PROGRESS')");
            entity.HasIndex(e => new { e.AnalystId, e.AssignedAt }).HasDatabaseName("ix_case_assignments_analyst_active").HasFilter("status IN ('ASSIGNED', 'IN_PROGRESS')");
        });
    }

    private static void ConfigureProjectionsAndWorkload(ModelBuilder builder)
    {
        builder.Entity<AnalystEligibilityProjection>(entity =>
        {
            entity.ToTable("analyst_eligibility_projection");
            entity.HasKey(e => e.AnalystId);
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.SpecialtiesJson).HasColumnName("specialties").HasColumnType("jsonb");
            entity.Property(e => e.RegionsJson).HasColumnName("regions").HasColumnType("jsonb");
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.LastSourceEventId).HasMaxLength(26);
        });

        builder.Entity<AnalystWorkload>(entity =>
        {
            entity.ToTable("analyst_workloads");
            entity.HasKey(e => e.AnalystId);
            entity.Property(e => e.AnalystId).HasMaxLength(26);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.ToTable(t => t.HasCheckConstraint("ck_analyst_workloads_range", "active_case_count >= 0 AND active_case_count <= 10"));
        });
    }

    private static void ConfigureHistoryTables(ModelBuilder builder)
    {
        builder.Entity<CaseTransition>(entity =>
        {
            entity.ToTable("case_transitions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.PreviousStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.NewStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.ActorId).HasMaxLength(26);
            entity.Property(e => e.ActorRole).HasMaxLength(32);
            entity.Property(e => e.TransitionSource).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Reason).HasColumnType("text");
            entity.Property(e => e.CorrelationId).HasMaxLength(64).IsRequired();
            entity.Property(e => e.CausationId).HasMaxLength(64);
            entity.Property(e => e.SourceEventId).HasMaxLength(26);

            entity.HasOne<RiskCase>().WithMany().HasForeignKey(e => e.CaseId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.CaseId, e.OccurredAt }).HasDatabaseName("ix_case_transitions_case_time");
            entity.HasIndex(e => new { e.ActorId, e.OccurredAt }).HasDatabaseName("ix_case_transitions_actor_time").HasFilter("actor_id IS NOT NULL");
        });

        builder.Entity<CaseOverride>(entity =>
        {
            entity.ToTable("case_overrides");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.OverrideType).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.PreviousValue).HasMaxLength(40).IsRequired();
            entity.Property(e => e.NewValue).HasMaxLength(40).IsRequired();
            entity.Property(e => e.Reason).HasColumnType("text").IsRequired();
            entity.Property(e => e.ActorId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.ActorRole).HasMaxLength(32).IsRequired();
            entity.Property(e => e.SourceEventId).HasMaxLength(26);

            entity.HasOne<RiskCase>().WithMany().HasForeignKey(e => e.CaseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => new { e.CaseId, e.OccurredAt }).HasDatabaseName("ix_case_overrides_case_time");
        });

        builder.Entity<AnalystNote>(entity =>
        {
            entity.ToTable("analyst_notes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.AuthorId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.AuthorRole).HasMaxLength(32).IsRequired();
            entity.Property(e => e.NoteText).HasColumnType("text").IsRequired();
            entity.Property(e => e.ParentNoteId).HasMaxLength(26);

            entity.HasOne<RiskCase>().WithMany().HasForeignKey(e => e.CaseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => new { e.CaseId, e.CreatedAt }).HasDatabaseName("ix_analyst_notes_case_time");
        });
    }

    private static void ConfigureVerificationAndFeedback(ModelBuilder builder)
    {
        builder.Entity<CustomerVerification>(entity =>
        {
            entity.ToTable("customer_verifications");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.CustomerId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.RequestedBy).HasMaxLength(26).IsRequired();
            entity.Property(e => e.Message).HasColumnType("text");
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Response).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasOne<RiskCase>().WithMany().HasForeignKey(e => e.CaseId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CaseId).IsUnique().HasDatabaseName("ux_verifications_pending_case").HasFilter("status = 'PENDING'");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_verifications_expiry").HasFilter("status = 'PENDING'");
            entity.ToTable(t => t.HasCheckConstraint("ck_verifications_expiry", "expires_at > requested_at"));
        });

        builder.Entity<TemporaryBlock>(entity =>
        {
            entity.ToTable("temporary_blocks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.TransactionId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.Reason).HasConversion<string>().HasMaxLength(40);
            entity.Property(e => e.AppliedBy).HasMaxLength(26);
            entity.Property(e => e.SourceEventId).HasMaxLength(26);
            entity.Property(e => e.ReleaseReason).HasColumnType("text");

            entity.HasOne<Domain.FraudTransaction>().WithMany().HasForeignKey(e => e.TransactionId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TransactionId, e.Reason }).IsUnique().HasDatabaseName("ux_temp_blocks_active_reason").HasFilter("released_at IS NULL");
            entity.HasIndex(e => e.TransactionId).HasDatabaseName("ix_temp_blocks_active_transaction").HasFilter("released_at IS NULL");
        });

        builder.Entity<CustomerFeedback>(entity =>
        {
            entity.ToTable("customer_feedback");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.CaseId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.TransactionId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.CustomerId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.Comment).HasColumnType("text");
            entity.Property(e => e.SourceEventId).HasMaxLength(26);

            entity.HasOne<RiskCase>().WithMany().HasForeignKey(e => e.CaseId).OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CaseId).IsUnique().HasDatabaseName("ux_customer_feedback_case");
            entity.ToTable(t => t.HasCheckConstraint("ck_customer_feedback_rating", "rating >= 1 AND rating <= 5"));
        });
    }

    private static void ConfigureIdempotency(ModelBuilder builder)
    {
        builder.Entity<IdempotencyRecord>(entity =>
        {
            entity.ToTable("idempotency_records");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.Scope).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ActorId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.IdempotencyKey).HasMaxLength(100).IsRequired();
            entity.Property(e => e.RequestHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.ResponseBody).HasColumnType("jsonb");
            entity.Property(e => e.ResourceId).HasMaxLength(26);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => new { e.Scope, e.ActorId, e.IdempotencyKey }).IsUnique().HasDatabaseName("ux_idempotency_scope_actor_key");
        });
    }
}
