namespace FraudCell.Transaction.Service.Domain;

/// <summary>Islem turleri.</summary>
public enum TransactionType
{
    ODEME,
    TRANSFER,
    FATURA,
    CEKIM,
}

/// <summary><c>TEMIZ</c> AI'in "supheli degil" sinifidir; analist uzmanligi degildir.</summary>
public enum FraudType
{
    CALINTI_KART,
    HESAP_ELE_GECIRME,
    PARA_AKLAMA,
    SUPHELI_DAVRANIS,
    TEMIZ,
}

/// <summary><c>DUSUK/ORTA/YUKSEK/KRITIK</c> eslesmesi §11'de sabittir.</summary>
public enum RiskLevel
{
    DUSUK,
    ORTA,
    YUKSEK,
    KRITIK,
}

/// <summary>Esik kararlari: <c>ONAY/INCELEME/BLOK</c>.</summary>
public enum ScreeningDecision
{
    ONAY,
    INCELEME,
    BLOK,
}

/// <summary>AI degerlendirme durumu.</summary>
public enum AssessmentStatus
{
    PENDING,
    COMPLETED,
    TIMED_OUT,
    FAILED,
}

/// <summary>Transaction'in finansal/operasyonel kontrol durumu.</summary>
public enum ControlStatus
{
    ALLOWED,
    TEMPORARILY_BLOCKED,
    APPROVED,
    BLOCKED,
}

/// <summary>RiskCase state machine.</summary>
public enum CaseStatus
{
    YENI,
    ATANDI,
    INCELENIYOR,
    MUSTERI_DOGRULAMA,
    ONAYLANDI,
    BLOKLANDI,
    KAPANDI,
}

/// <summary>Case state'inden BAGIMSIZ assignment durumu.</summary>
public enum AssignmentStatus
{
    UNASSIGNED,
    QUEUED,
    MANUAL_QUEUE,
    ASSIGNED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED,
}

/// <summary>Assignment kaydinin kendi durumu.</summary>
public enum CaseAssignmentStatus
{
    ASSIGNED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED,
}

public enum AssignmentSource
{
    AI_RECOMMENDATION,
    SYSTEM,
    SUPERVISOR,
    MANUAL_QUEUE,
}

/// <summary>SLA sureleri risk seviyesine gore belirlenir.</summary>
public enum SlaPriority
{
    DUSUK,
    ORTA,
    YUKSEK,
    KRITIK,
}

public enum FinalDecision
{
    APPROVE,
    BLOCK,
}

/// <summary>Gecici blok nedenleri.</summary>
public enum TemporaryBlockReason
{
    AI_CRITICAL_RISK,
    CUSTOMER_NOT_MINE,
    CRITICAL_SLA_BREACH,
    SUPERVISOR_SECURITY_OVERRIDE,
}

public enum VerificationStatus
{
    PENDING,
    ANSWERED,
    EXPIRED,
    CANCELLED,
}

public enum VerificationResponse
{
    MINE,
    NOT_MINE,
    NO_RESPONSE,
}

public enum OverrideType
{
    FRAUD_TYPE,
    RISK_LEVEL,
}

public enum TransitionSource
{
    SYSTEM,
    ANALYST,
    SUPERVISOR,
    CUSTOMER,
}

public enum IdempotencyStatus
{
    PROCESSING,
    COMPLETED,
    FAILED,
}
