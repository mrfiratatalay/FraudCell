namespace FraudCell.Gamification.Service.Common;

/// <summary>Gamification servisinin yayinladigi ve dinledigi event tipleri.</summary>
public static class GamificationEventTypes
{
    // --- Yayinlanan ---
    public const string PointsAwarded = "gamification.points.awarded";
    public const string PointsDeducted = "gamification.points.deducted";
    public const string BadgeEarned = "badge.earned";
    public const string AnalystLevelChanged = "analyst.level.changed";
    public const string LeaderboardUpdated = "leaderboard.updated";
    public const string AnalystPerformanceUpdated = "analyst.performance.updated";
    public const string UserNotificationRequested = "user.notification.requested";
    public const string AuditEntryRequested = "audit.entry.requested";

    // --- Tuketilen ---
    public const string CaseDecisionMade = "case.decision.made";
    public const string CaseSlaBreached = "case.sla.breached";
    public const string CaseClosed = "case.closed";
    public const string CustomerVerificationResponded = "customer.verification.responded";
    public const string CustomerFeedbackSubmitted = "customer.feedback.submitted";
    public const string IdentityStaffCreated = "identity.staff.created";
    public const string IdentityStaffProfileUpdated = "identity.staff.profile.updated";
}
