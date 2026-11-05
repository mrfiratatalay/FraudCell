using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shouldly;
using Testcontainers.PostgreSql;
using Xunit;

namespace FraudCell.Identity.Service.Tests;

/// <summary>Refresh token rotation and reuse (case §3.2) on a real PostgreSQL (Docker required).</summary>
public sealed class RefreshTokenServiceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18.4").Build();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync(Ct);
        await using var db = NewDb();
        await db.Database.MigrateAsync(Ct);
    }

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task Rotation_returns_a_new_token_and_retires_the_old_one()
    {
        var userId = await NewUserAsync();
        var (laptop, _) = await IssueAsync(userId);

        var rotated = await RotateAsync(laptop);

        rotated.Outcome.ShouldBe(RefreshOutcome.Success);
        rotated.NewRawToken.ShouldNotBe(laptop);
        (await RotateAsync(rotated.NewRawToken!)).Outcome.ShouldBe(RefreshOutcome.Success);
    }

    [Fact]
    public async Task Reusing_a_rotated_token_ends_every_session_of_the_user()
    {
        var userId = await NewUserAsync();
        var otherUserId = await NewUserAsync();
        var (laptop, _) = await IssueAsync(userId);
        var (phone, _) = await IssueAsync(userId);
        var (someoneElse, _) = await IssueAsync(otherUserId);
        var rotated = await RotateAsync(laptop);

        (await RotateAsync(laptop)).Outcome.ShouldBe(RefreshOutcome.ReuseDetected);

        (await RotateAsync(rotated.NewRawToken!)).Outcome.ShouldBe(RefreshOutcome.ReuseDetected);
        (await RotateAsync(phone)).Outcome.ShouldBe(RefreshOutcome.ReuseDetected);
        (await RotateAsync(someoneElse)).Outcome.ShouldBe(RefreshOutcome.Success);
    }

    private IdentityServiceDbContext NewDb() =>
        new(new DbContextOptionsBuilder<IdentityServiceDbContext>().UseNpgsql(_postgres.GetConnectionString()).Options);

    private static RefreshTokenService NewService(IdentityServiceDbContext db) =>
        new(db, new SystemClock(), Options.Create(new JwtSigningOptions { Issuer = "fraudcell-identity", Audience = "fraudcell-api" }));

    private async Task<string> NewUserAsync()
    {
        await using var db = NewDb();
        var id = Ulid.NewUlid().ToString();
        db.Users.Add(new ApplicationUser
        {
            Id = id,
            UserName = $"{id}@fraudcell.test",
            Email = $"{id}@fraudcell.test",
            UserType = UserType.Staff,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(Ct);
        return id;
    }

    private async Task<(string RawToken, RefreshSession Session)> IssueAsync(string userId)
    {
        await using var db = NewDb();
        return await NewService(db).IssueAsync(userId, "127.0.0.1", "tests", familyId: null, parentSessionId: null, Ct);
    }

    private async Task<RefreshRotationResult> RotateAsync(string rawToken)
    {
        await using var db = NewDb();
        return await NewService(db).RotateAsync(rawToken, "127.0.0.1", "tests", Ct);
    }
}
