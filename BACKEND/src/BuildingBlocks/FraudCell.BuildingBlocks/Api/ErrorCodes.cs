namespace FraudCell.BuildingBlocks.Api;

/// <summary>
/// Sistem genelinde kullanilan hata kodlari (
/// katalogla birebir eslesir). Frontend bu kodlara gore davranis degistirdigi
/// icin (ornegin ACCOUNT_LOCKED ekrani) string'ler sabittir.
/// </summary>
public static class ErrorCodes
{
    // --- Genel ---
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string InvalidEnumValue = "INVALID_ENUM_VALUE";
    public const string PayloadTooLarge = "PAYLOAD_TOO_LARGE";
    public const string UnsupportedFilter = "UNSUPPORTED_FILTER";
    public const string UnsupportedSort = "UNSUPPORTED_SORT";
    public const string InvalidCursor = "INVALID_CURSOR";
    public const string NotFound = "NOT_FOUND";
    public const string Forbidden = "FORBIDDEN";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Conflict = "CONFLICT";
    public const string RateLimitExceeded = "RATE_LIMIT_EXCEEDED";
    public const string InternalError = "INTERNAL_ERROR";
    public const string InternalOperationFailed = "INTERNAL_OPERATION_FAILED";
    public const string ServiceTemporarilyUnavailable = "SERVICE_TEMPORARILY_UNAVAILABLE";
    public const string DependencyUnavailable = "SERVICE_TEMPORARILY_UNAVAILABLE";
    public const string DatabaseUnavailable = "DATABASE_UNAVAILABLE";

    // --- Authentication ---
    public const string AuthenticationRequired = "AUTHENTICATION_REQUIRED";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string AccountLocked = "ACCOUNT_LOCKED";
    public const string PasswordPolicyViolation = "PASSWORD_POLICY_VIOLATION";
    public const string OtpChallengeNotFound = "OTP_CHALLENGE_NOT_FOUND";
    public const string OtpChallengeExpired = "OTP_CHALLENGE_EXPIRED";
    public const string OtpChallengeLocked = "OTP_CHALLENGE_LOCKED";
    public const string OtpCodeInvalid = "OTP_CODE_INVALID";
    public const string OtpAlreadyVerified = "OTP_ALREADY_VERIFIED";
    public const string AccessTokenExpired = "ACCESS_TOKEN_EXPIRED";
    public const string AccessTokenInvalid = "ACCESS_TOKEN_INVALID";
    public const string RefreshTokenInvalid = "REFRESH_TOKEN_INVALID";
    public const string RefreshTokenExpired = "REFRESH_TOKEN_EXPIRED";
    public const string RefreshTokenReuseDetected = "REFRESH_TOKEN_REUSE_DETECTED";
    public const string GsmNumberAlreadyRegistered = "GSM_NUMBER_ALREADY_REGISTERED";
    public const string EmailAlreadyRegistered = "EMAIL_ALREADY_REGISTERED";

    // --- Authorization ---
    public const string ResourceAccessDenied = "RESOURCE_ACCESS_DENIED";
    public const string RoleNotAllowed = "ROLE_NOT_ALLOWED";
    public const string CaseNotAssignedToActor = "CASE_NOT_ASSIGNED_TO_ACTOR";
    public const string CustomerNotOwner = "CUSTOMER_NOT_OWNER";

    // --- Transaction ---
    public const string TransactionNotFound = "TRANSACTION_NOT_FOUND";
    public const string InvalidTransactionAmount = "INVALID_TRANSACTION_AMOUNT";
    public const string UnsupportedCurrency = "UNSUPPORTED_CURRENCY";
    public const string IdempotencyKeyRequired = "IDEMPOTENCY_KEY_REQUIRED";
    public const string IdempotencyKeyReusedWithDifferentPayload = "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD";

    // --- Case ---
    public const string CaseNotFound = "CASE_NOT_FOUND";
    public const string InvalidCaseTransition = "INVALID_CASE_TRANSITION";
    public const string CaseAlreadyDecided = "CASE_ALREADY_DECIDED";
    public const string CaseAlreadyClosed = "CASE_ALREADY_CLOSED";
    public const string DecisionNoteRequired = "DECISION_NOTE_REQUIRED";
    public const string CustomerVerificationAlreadyPending = "CUSTOMER_VERIFICATION_ALREADY_PENDING";
    public const string AnalystCapacityExceeded = "ANALYST_CAPACITY_EXCEEDED";
    public const string AnalystNotAssignable = "ANALYST_NOT_ASSIGNABLE";
    public const string VerificationNotPending = "VERIFICATION_NOT_PENDING";
    public const string FeedbackNotAllowed = "FEEDBACK_NOT_ALLOWED";
    public const string FeedbackAlreadySubmitted = "FEEDBACK_ALREADY_SUBMITTED";
    public const string AssessmentAlreadyApplied = "ASSESSMENT_ALREADY_APPLIED";

    // --- Concurrency ---
    public const string PreconditionRequired = "PRECONDITION_REQUIRED";
    public const string ResourceVersionMismatch = "RESOURCE_VERSION_MISMATCH";
    public const string ConcurrencyConflict = "CONCURRENCY_CONFLICT";
    public const string IdempotencyConflict = "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD";
}
