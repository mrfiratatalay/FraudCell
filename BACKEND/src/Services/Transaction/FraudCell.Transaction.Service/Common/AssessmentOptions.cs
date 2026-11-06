namespace FraudCell.Transaction.Service.Common;

/// <summary><c>AI_ASSESSMENT_DEADLINE_SECONDS</c>.</summary>
public sealed class AssessmentOptions
{
    public const string SectionName = "Assessment";

    /// <summary>
    /// How long a transaction waits for the AI before it falls back to manual review.
    /// The round trip is outbox poll + AI scoring + AI outbox poll + consumer, about
    /// 1-1.5 s with 500 ms polling; 5 s leaves headroom for cold starts.
    /// </summary>
    public int DeadlineSeconds { get; set; } = 5;

    /// <summary>Muşteri dogrulama timeout'u.</summary>
    public int CustomerVerificationTimeoutMinutes { get; set; } = 10;
}
