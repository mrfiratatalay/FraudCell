namespace FraudCell.Identity.Service.Domain;

public enum OtpPurpose
{
    CustomerRegister,
    CustomerLogin,
}

public enum OtpStatus
{
    Pending,
    Verified,
    Expired,
    Locked,
    Cancelled,
}

/// <summary>
/// <c>identity.otp_challenges</c>. GSM + OTP dogrulama surecini
/// yonetir. Kod hash'i saklanir, ham deger asla veritabaninda tutulmaz; demo
/// profilinde sabit "1234" kabul edilse bile yalnizca hash saklanir.
/// </summary>
public sealed class OtpChallenge
{
    public required string Id { get; set; }

    public required string GsmNumber { get; set; }

    /// <summary>SHA-256(gsmNumber + purpose + code). Ham OTP asla saklanmaz.</summary>
    public required string CodeHash { get; set; }

    public required OtpPurpose Purpose { get; set; }

    public OtpStatus Status { get; set; } = OtpStatus.Pending;

    public int AttemptCount { get; set; }

    public int MaxAttempts { get; set; } = 5;

    public required DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? VerifiedAt { get; set; }

    public string? CreatedIp { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public long Version { get; set; }
}
