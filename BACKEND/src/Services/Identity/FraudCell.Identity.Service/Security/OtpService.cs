using System.Security.Cryptography;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Security;

public sealed class OtpOptions
{
    public const string SectionName = "Otp";

    public int ExpiryMinutes { get; set; } = 5;

    public int MaxAttempts { get; set; } = 5;

    /// <summary>Dokuman `07-API-DESIGN.md` §23: demo profilinde <c>demoHint</c> alani ve sabit kod doner.</summary>
    public bool UseFixedDemoCode { get; set; }

    public string FixedDemoCode { get; set; } = "1234";
}

public enum OtpVerifyOutcome
{
    Verified,
    NotFound,
    Expired,
    Locked,
    AlreadyVerified,
    CodeMismatch,
}

public sealed record OtpChallengeResult(string ChallengeId, DateTimeOffset ExpiresAt, string? DemoHint);

/// <summary>
/// GSM + OTP dogrulama akisi (dokuman `06-DATA-ARCHITECTURE.md` §15,
/// `07-API-DESIGN.md` §23-24). Gercek bir SMS gateway'i bu case kapsaminda
/// yok; kod "gonderilmis" gibi loglanir ve demo profilinde sabit deger kabul
/// edilir.
/// </summary>
public sealed partial class OtpService(
    IdentityServiceDbContext db,
    IClock clock,
    IOptions<OtpOptions> options,
    IHostEnvironment environment,
    ILogger<OtpService> logger)
{
    private readonly OtpOptions _options = options.Value;

    public async Task<OtpChallengeResult> IssueChallengeAsync(
        string gsmNumber, OtpPurpose purpose, string? ip, CancellationToken cancellationToken)
    {
        var code = _options.UseFixedDemoCode
            ? _options.FixedDemoCode
            : RandomNumberGenerator.GetInt32(0, 10_000).ToString("D4", System.Globalization.CultureInfo.InvariantCulture);

        var now = clock.UtcNow;
        var challenge = new OtpChallenge
        {
            Id = Ulid.NewUlid().ToString(),
            GsmNumber = gsmNumber,
            Purpose = purpose,
            CodeHash = Hash(gsmNumber, purpose, code),
            MaxAttempts = _options.MaxAttempts,
            CreatedIp = ip,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(_options.ExpiryMinutes),
        };

        db.OtpChallenges.Add(challenge);
        await db.SaveChangesAsync(cancellationToken);

        // SMS entegrasyonu case kapsami disinda; demo/dogrulama amacli loglanir.
        // Kodun kendisi yalnizca demo modda ve sabit oldugu icin log'a yazilmaz.
        LogChallengeIssued(logger, gsmNumber[^4..], purpose, challenge.ExpiresAt);

        var demoHint = environment.IsDevelopment() && _options.UseFixedDemoCode
            ? $"Demo ortaminda OTP: {_options.FixedDemoCode}"
            : null;

        return new OtpChallengeResult(challenge.Id, challenge.ExpiresAt, demoHint);
    }

    public async Task<(OtpVerifyOutcome Outcome, OtpChallenge? Challenge)> VerifyAsync(
        string challengeId, string providedCode, CancellationToken cancellationToken)
    {
        var challenge = await db.OtpChallenges.SingleOrDefaultAsync(c => c.Id == challengeId, cancellationToken);

        if (challenge is null)
        {
            return (OtpVerifyOutcome.NotFound, null);
        }

        if (challenge.Status == OtpStatus.Verified)
        {
            return (OtpVerifyOutcome.AlreadyVerified, challenge);
        }

        var now = clock.UtcNow;
        if (challenge.Status is OtpStatus.Expired or OtpStatus.Cancelled || challenge.ExpiresAt <= now)
        {
            challenge.Status = OtpStatus.Expired;
            await db.SaveChangesAsync(cancellationToken);
            return (OtpVerifyOutcome.Expired, challenge);
        }

        if (challenge.Status == OtpStatus.Locked || challenge.AttemptCount >= challenge.MaxAttempts)
        {
            challenge.Status = OtpStatus.Locked;
            await db.SaveChangesAsync(cancellationToken);
            return (OtpVerifyOutcome.Locked, challenge);
        }

        challenge.AttemptCount++;

        var expectedHash = Hash(challenge.GsmNumber, challenge.Purpose, providedCode);
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(expectedHash),
                System.Text.Encoding.UTF8.GetBytes(challenge.CodeHash)))
        {
            if (challenge.AttemptCount >= challenge.MaxAttempts)
            {
                challenge.Status = OtpStatus.Locked;
            }

            await db.SaveChangesAsync(cancellationToken);
            return (OtpVerifyOutcome.CodeMismatch, challenge);
        }

        challenge.Status = OtpStatus.Verified;
        challenge.VerifiedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        return (OtpVerifyOutcome.Verified, challenge);
    }

    private static string Hash(string gsmNumber, OtpPurpose purpose, string code)
        => Convert.ToHexStringLower(SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"{gsmNumber}:{purpose}:{code}")));

    [LoggerMessage(Level = LogLevel.Information, Message = "OTP challenge issued for gsm ending {GsmSuffix} (purpose {Purpose}), expires at {ExpiresAt}.")]
    private static partial void LogChallengeIssued(ILogger logger, string gsmSuffix, OtpPurpose purpose, DateTimeOffset expiresAt);
}
