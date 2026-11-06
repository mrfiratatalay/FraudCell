namespace FraudCell.Transaction.Service.Common;

/// <summary>Transaction Service'in yayinladigi/tukettigi event tipleri.</summary>
public static class TransactionEventTypes
{
    // --- Yayinlanan ---
    public const string TransactionCreated = "transaction.created";
    public const string TransactionAssessmentTimedOut = "transaction.assessment.timed_out";
    public const string TransactionTemporarilyBlocked = "transaction.temporarily.blocked";
    public const string TransactionApproved = "transaction.approved";

    public const string CaseCreated = "case.created";
    public const string CaseAssigned = "case.assigned";
    public const string CaseAssignmentQueued = "case.assignment.queued";
    public const string CaseReviewStarted = "case.review.started";
    public const string CaseCustomerVerificationRequested = "case.customer_verification.requested";
    public const string CustomerVerificationResponded = "customer.verification.responded";
    public const string CaseDecisionMade = "case.decision.made";
    public const string CaseFraudTypeOverridden = "case.fraud_type.overridden";
    public const string CaseRiskLevelOverridden = "case.risk_level.overridden";
    public const string CaseSlaBreached = "case.sla.breached";
    public const string CaseClosed = "case.closed";

    public const string CustomerFeedbackSubmitted = "customer.feedback.submitted";

    public const string AuditEntryRequested = "audit.entry.requested";
    public const string UserNotificationRequested = "user.notification.requested";

    // --- Tuketilen ---
    public const string AiAssessmentCompleted = "ai.assessment.completed";
    public const string AiAssessmentFailed = "ai.assessment.failed";
    public const string IdentityStaffProfileUpdated = "identity.staff.profile.updated";
}

public static class AuditActions
{
    public const string TransactionCreated = "TRANSACTION_CREATED";
    public const string CaseAssigned = "CASE_ASSIGNED";
    public const string CaseReviewStarted = "CASE_REVIEW_STARTED";
    public const string CaseApproved = "CASE_APPROVED";
    public const string CaseBlocked = "CASE_BLOCKED";
    public const string FraudTypeOverridden = "FRAUD_TYPE_OVERRIDDEN";
    public const string RiskLevelOverridden = "RISK_LEVEL_OVERRIDDEN";
    public const string ManualAssignment = "MANUAL_ASSIGNMENT";
    public const string Reassignment = "REASSIGNMENT";
    public const string SlaBreached = "SLA_BREACHED";
}
