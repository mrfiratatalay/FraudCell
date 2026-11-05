using System.Security.Cryptography;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Security;

public enum RefreshOutcome
{
    Success,
    Invalid,
    Expired,
    ReuseDetected,
}

public sealed record RefreshRotationResult(
    RefreshOutcome Outcome,
    string? UserId = null,
    string? NewRawToken = null,
    RefreshSession? NewSession = null,
    string? PreviousFamilyId = null);

/// <summary>
/// Refresh token family, rotation ve reuse detection.
///
/// Her rotation eskisini revoke edip ayni family'de yeni bir satir olusturur.
/// Revoke edilmis bir token TEKRAR kullanilirsa (calinti token senaryosu),
/// kullanicinin TUM oturumlari revoke edilir ve caller kullaniciyi tamamen logout
/// etmelidir (security stamp yenileme cagiran katmanin sorumlulugundadir).
/// </summary>
public sealed class RefreshTokenService(IdentityServiceDbContext db, IClock clock, IOptions<JwtSigningOptions> options)
{
    private readonly JwtSigningOptions _options = options.Value;

    public async Task<(string RawToken, RefreshSession Session)> IssueAsync(
        string userId, string? ip, string? userAgent, string? familyId, string? parentSessionId, CancellationToken cancellationToken)
    {
        var raw = GenerateRawToken();
        var now = clock.UtcNow;

        var session = new RefreshSession
        {
            Id = Ulid.NewUlid().ToString(),
            UserId = userId,
            FamilyId = familyId ?? Ulid.NewUlid().ToString(),
            TokenHash = Hash(raw),
            ParentSessionId = parentSessionId,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenLifetimeDays),
            CreatedIp = ip,
            UserAgent = Truncate(userAgent, 512),
        };

        db.RefreshSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return (raw, session);
    }

    /// <summary>
    /// Gelen ham refresh token'i dogrular ve basariliysa rotate eder. TUM
    /// donuslerde <c>SaveChangesAsync</c> bu metot icinde cagrilir; caller ayrica
    /// commit etmek zorunda degildir.
    /// </summary>
    public async Task<RefreshRotationResult> RotateAsync(
        string rawToken, string? ip, string? userAgent, CancellationToken cancellationToken)
    {
        var hash = Hash(rawToken);
        var current = await db.RefreshSessions.SingleOrDefaultAsync(s => s.TokenHash == hash, cancellationToken);

        if (current is null)
        {
            return new RefreshRotationResult(RefreshOutcome.Invalid);
        }

        var now = clock.UtcNow;

        if (current.RevokedAt is not null)
        {
            // A retired token presented again means it was stolen (case §3.2):
            // every session of the user ends, on every device.
            var userSessions = await db.RefreshSessions
                .Where(s => s.UserId == current.UserId && s.RevokedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var member in userSessions)
            {
                member.RevokedAt = now;
                member.RevocationReason = RevocationReasons.ReuseDetected;
            }

            current.ReuseDetectedAt = now;
            await db.SaveChangesAsync(cancellationToken);

            return new RefreshRotationResult(RefreshOutcome.ReuseDetected, current.UserId, PreviousFamilyId: current.FamilyId);
        }

        if (current.ExpiresAt <= now)
        {
            current.RevokedAt = now;
            current.RevocationReason = "EXPIRED";
            await db.SaveChangesAsync(cancellationToken);
            return new RefreshRotationResult(RefreshOutcome.Expired, current.UserId);
        }

        var newRaw = GenerateRawToken();
        var newSession = new RefreshSession
        {
            Id = Ulid.NewUlid().ToString(),
            UserId = current.UserId,
            FamilyId = current.FamilyId,
            TokenHash = Hash(newRaw),
            ParentSessionId = current.Id,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenLifetimeDays),
            CreatedIp = ip,
            UserAgent = Truncate(userAgent, 512),
        };

        current.RevokedAt = now;
        current.RevocationReason = RevocationReasons.Rotated;
        current.ReplacedBySessionId = newSession.Id;
        current.LastUsedAt = now;
        current.LastUsedIp = ip;

        db.RefreshSessions.Add(newSession);
        await db.SaveChangesAsync(cancellationToken);

        return new RefreshRotationResult(RefreshOutcome.Success, current.UserId, newRaw, newSession);
    }

    /// <summary>Logout: yalnizca sunulan oturumu iptal eder, ailenin geri kalanina dokunmaz.</summary>
    public async Task RevokeAsync(string rawToken, string reason, CancellationToken cancellationToken)
    {
        var hash = Hash(rawToken);
        var session = await db.RefreshSessions.SingleOrDefaultAsync(s => s.TokenHash == hash, cancellationToken);

        if (session is null || session.RevokedAt is not null)
        {
            return;
        }

        session.RevokedAt = clock.UtcNow;
        session.RevocationReason = reason;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task RevokeByIdAsync(string sessionId, string reason, CancellationToken cancellationToken)
    {
        var session = await db.RefreshSessions.SingleOrDefaultAsync(s => s.Id == sessionId, cancellationToken);
        if (session is null || session.RevokedAt is not null)
        {
            return;
        }

        session.RevokedAt = clock.UtcNow;
        session.RevocationReason = reason;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Token theft tespitinde veya admin zorlamasinda kullanicinin TUM oturumlarini dusurur.</summary>
    public async Task RevokeAllForUserAsync(string userId, string reason, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await db.RefreshSessions
            .Where(s => s.UserId == userId && s.RevokedAt == null)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(s => s.RevokedAt, now)
                    .SetProperty(s => s.RevocationReason, reason),
                cancellationToken);
    }

    private static string GenerateRawToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static string Hash(string rawToken)
        => Convert.ToHexStringLower(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken)));

    private static string? Truncate(string? value, int maxLength)
        => value is null ? null : (value.Length <= maxLength ? value : value[..maxLength]);
}
