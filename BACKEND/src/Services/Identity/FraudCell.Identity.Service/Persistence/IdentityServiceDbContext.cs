using FraudCell.BuildingBlocks.Messaging.Inbox;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Persistence;
using FraudCell.Identity.Service.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Identity.Service.Persistence;

/// <summary>
/// Identity Service'in TEK veritabani baglantisi:
/// <c>fraudcell_identity</c> database, <c>identity</c> schema). Bu servis
/// disinda hicbir servis bu baglanti dizesine erisemez; network izolasyonu
/// docker-compose seviyesinde ayrica uygulanir.
/// </summary>
public sealed class IdentityServiceDbContext(DbContextOptions<IdentityServiceDbContext> options)
    : IdentityDbContext<ApplicationUser, ApplicationRole, string>(options), IMessagingDbContext
{
    public const string Schema = "identity";

    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();

    public DbSet<StaffProfile> StaffProfiles => Set<StaffProfile>();

    public DbSet<Specialty> Specialties => Set<Specialty>();

    public DbSet<Region> Regions => Set<Region>();

    public DbSet<StaffSpecialty> StaffSpecialties => Set<StaffSpecialty>();

    public DbSet<StaffRegion> StaffRegions => Set<StaffRegion>();

    public DbSet<OtpChallenge> OtpChallenges => Set<OtpChallenge>();

    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();

    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    DbContext IMessagingDbContext.AsDbContext() => this;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.HasDefaultSchema(Schema);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("users");
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.UserType).HasConversion<string>().HasColumnName("user_type").HasMaxLength(16);
            entity.Property(e => e.GsmNumber).HasColumnName("gsm_number").HasMaxLength(20);
            entity.Property(e => e.LockoutEnd).HasColumnName("lockout_end_at");
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => e.GsmNumber).IsUnique().HasDatabaseName("ux_users_gsm_number").HasFilter("gsm_number IS NOT NULL");
            entity.HasIndex(e => e.NormalizedEmail).IsUnique().HasDatabaseName("ux_users_normalized_email").HasFilter("normalized_email IS NOT NULL");
            entity.HasIndex(e => new { e.UserType, e.IsActive }).HasDatabaseName("ix_users_active_type");
            entity.HasIndex(e => e.LockoutEnd).HasDatabaseName("ix_users_lockout").HasFilter("lockout_end_at IS NOT NULL");

            entity.ToTable(t => t.HasCheckConstraint("ck_users_access_failed_count", "access_failed_count >= 0"));
        });

        builder.Entity<ApplicationRole>(entity =>
        {
            entity.ToTable("roles");
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.Name).HasColumnName("code").HasMaxLength(32);
            entity.Property(e => e.DisplayName).HasColumnName("display_name").HasMaxLength(100);
        });

        builder.Entity<IdentityUserRole<string>>(entity =>
        {
            entity.ToTable("user_roles");
            entity.Property(e => e.UserId).HasColumnName("user_id").HasMaxLength(26);
            entity.Property(e => e.RoleId).HasColumnName("role_id").HasMaxLength(26);
        });

        builder.Entity<IdentityUserClaim<string>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<string>>().ToTable("user_tokens");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("role_claims");

        builder.Entity<CustomerProfile>(entity =>
        {
            entity.ToTable("customer_profiles");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.UserId).HasMaxLength(26);
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();

            entity.HasOne(e => e.User)
                  .WithOne(u => u.CustomerProfile)
                  .HasForeignKey<CustomerProfile>(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<StaffProfile>(entity =>
        {
            entity.ToTable("staff_profiles");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.UserId).HasMaxLength(26);
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EmployeeNumber).HasMaxLength(50);
            entity.Property(e => e.CreatedByAdminId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => e.EmployeeNumber).IsUnique().HasDatabaseName("ux_staff_employee_number").HasFilter("employee_number IS NOT NULL");

            entity.HasOne(e => e.User)
                  .WithOne(u => u.StaffProfile)
                  .HasForeignKey<StaffProfile>(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Specialty>(entity =>
        {
            entity.ToTable("specialties");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.Code).HasConversion<string>().HasMaxLength(50);
            entity.Property(e => e.DisplayName).HasMaxLength(100).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique().HasDatabaseName("ux_specialties_code");
        });

        builder.Entity<Region>(entity =>
        {
            entity.ToTable("regions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.Code).HasConversion<string>().HasMaxLength(50);
            entity.Property(e => e.DisplayName).HasMaxLength(100).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique().HasDatabaseName("ux_regions_code");
        });

        builder.Entity<StaffSpecialty>(entity =>
        {
            entity.ToTable("staff_specialties");
            entity.HasKey(e => new { e.StaffUserId, e.SpecialtyId });
            entity.Property(e => e.StaffUserId).HasMaxLength(26);
            entity.Property(e => e.SpecialtyId).HasMaxLength(26);
            entity.Property(e => e.AssignedBy).HasMaxLength(26).IsRequired();

            entity.HasOne(e => e.Specialty).WithMany().HasForeignKey(e => e.SpecialtyId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<StaffProfile>().WithMany(p => p.Specialties).HasForeignKey(e => e.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StaffRegion>(entity =>
        {
            entity.ToTable("staff_regions");
            entity.HasKey(e => new { e.StaffUserId, e.RegionId });
            entity.Property(e => e.StaffUserId).HasMaxLength(26);
            entity.Property(e => e.RegionId).HasMaxLength(26);
            entity.Property(e => e.AssignedBy).HasMaxLength(26).IsRequired();

            entity.HasOne(e => e.Region).WithMany().HasForeignKey(e => e.RegionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<StaffProfile>().WithMany(p => p.Regions).HasForeignKey(e => e.StaffUserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<OtpChallenge>(entity =>
        {
            entity.ToTable("otp_challenges");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.GsmNumber).HasMaxLength(20).IsRequired();
            entity.Property(e => e.CodeHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Purpose).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            // "inet" native tipi yerine varchar kullanilir: Npgsql string->inet donusumu icin
            // deger converter'i gerektirir ve bu proje icin ek karmasikliga degmez.
            entity.Property(e => e.CreatedIp).HasMaxLength(64);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => new { e.GsmNumber, e.CreatedAt })
                  .HasDatabaseName("ix_otp_pending_gsm")
                  .HasFilter("status = 'Pending'");

            entity.ToTable(t => t.HasCheckConstraint("ck_otp_attempt_count", "attempt_count >= 0 AND attempt_count <= max_attempts"));
        });

        builder.Entity<LoginAttempt>(entity =>
        {
            entity.ToTable("login_attempts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.UserId).HasMaxLength(26);
            entity.Property(e => e.LoginIdentifierHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.LoginType).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Result).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.FailureReason).HasMaxLength(100);
            entity.Property(e => e.IpAddress).HasMaxLength(64);
            entity.Property(e => e.UserAgent).HasMaxLength(512);
            entity.Property(e => e.CorrelationId).HasMaxLength(64).IsRequired();

            entity.HasIndex(e => new { e.UserId, e.OccurredAt }).HasDatabaseName("ix_login_attempts_user_time").HasFilter("user_id IS NOT NULL");
            entity.HasIndex(e => new { e.IpAddress, e.OccurredAt }).HasDatabaseName("ix_login_attempts_ip_time");
        });

        builder.Entity<RefreshSession>(entity =>
        {
            entity.ToTable("refresh_sessions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.UserId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.FamilyId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.TokenHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.ParentSessionId).HasMaxLength(26);
            entity.Property(e => e.ReplacedBySessionId).HasMaxLength(26);
            entity.Property(e => e.RevocationReason).HasMaxLength(64);
            entity.Property(e => e.CreatedIp).HasMaxLength(64);
            entity.Property(e => e.LastUsedIp).HasMaxLength(64);
            entity.Property(e => e.UserAgent).HasMaxLength(512);
            entity.Property(e => e.Version).IsConcurrencyToken();

            entity.HasIndex(e => e.TokenHash).IsUnique().HasDatabaseName("ux_refresh_sessions_token_hash");
            entity.HasIndex(e => new { e.UserId, e.ExpiresAt }).HasDatabaseName("ix_refresh_sessions_user_active").HasFilter("revoked_at IS NULL");
            entity.HasIndex(e => new { e.FamilyId, e.CreatedAt }).HasDatabaseName("ix_refresh_sessions_family");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_refresh_sessions_expired");
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(26);
            entity.Property(e => e.SourceEventId).HasMaxLength(26).IsRequired();
            entity.Property(e => e.ActorId).HasMaxLength(26);
            entity.Property(e => e.ActorRole).HasMaxLength(32);
            entity.Property(e => e.Action).HasMaxLength(100).IsRequired();
            entity.Property(e => e.SourceService).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ResourceType).HasMaxLength(64);
            entity.Property(e => e.ResourceId).HasMaxLength(100);
            entity.Property(e => e.IpAddress).HasMaxLength(64);
            entity.Property(e => e.Result).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.CorrelationId).HasMaxLength(64).IsRequired();
            entity.Property(e => e.DetailsJson).HasColumnName("details").HasColumnType("jsonb");

            entity.HasIndex(e => e.SourceEventId).IsUnique().HasDatabaseName("ux_audit_logs_source_event");
            entity.HasIndex(e => new { e.ActorId, e.OccurredAt }).HasDatabaseName("ix_audit_actor_time");
            entity.HasIndex(e => new { e.Action, e.OccurredAt }).HasDatabaseName("ix_audit_action_time");
            entity.HasIndex(e => new { e.ResourceType, e.ResourceId, e.OccurredAt }).HasDatabaseName("ix_audit_resource");
            entity.HasIndex(e => e.CorrelationId).HasDatabaseName("ix_audit_correlation");

            // Append-only: runtime user icin UPDATE/DELETE verilmez.
            // Bu, veritabani GRANT script'lerinde (migration disinda) uygulanir.
        });

        builder.ApplyMessagingModel();
        builder.ApplySnakeCaseNaming();
    }
}
