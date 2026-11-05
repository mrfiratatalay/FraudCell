namespace FraudCell.Gamification.Service.Domain;

/// <summary>Puan kurali kodlari; puan defterinde (point_ledger) satir basina tutulur.</summary>
public static class RuleCodes
{
    public const string CaseDecision = "CASE_DECISION";
    public const string FastDecision = "FAST_DECISION";
    public const string ConfirmedFraud = "CONFIRMED_FRAUD";
    public const string CriticalWithinSla = "CRITICAL_WITHIN_SLA";
    public const string SlaBreach = "SLA_BREACH";
    public const string FalsePositive = "FALSE_POSITIVE";
}

public enum RuleEvaluationResult
{
    APPLIED,
    NOT_APPLICABLE,
    ALREADY_APPLIED,
    DEFERRED,
}

/// <summary>Seviye siniri: BRONZ 0-499, GUMUS 500-1499, ALTIN 1500-2999, PLATIN 3000+.</summary>
public enum AnalystLevel
{
    BRONZ,
    GUMUS,
    ALTIN,
    PLATIN,
}

public static class LevelThresholds
{
    public static AnalystLevel Calculate(long totalPoints) => totalPoints switch
    {
        >= 3000 => AnalystLevel.PLATIN,
        >= 1500 => AnalystLevel.ALTIN,
        >= 500 => AnalystLevel.GUMUS,
        _ => AnalystLevel.BRONZ,
    };
}

/// <summary>Seed badge kodlari.</summary>
public static class BadgeCodes
{
    public const string FirstCatch = "FIRST_CATCH";
    public const string SharpEye = "SHARP_EYE";
    public const string ZeroError = "ZERO_ERROR";
    public const string Marathon = "MARATHON";
    public const string CrisisManager = "CRISIS_MANAGER";
    public const string SpecialistHunter = "SPECIALIST_HUNTER";
}
