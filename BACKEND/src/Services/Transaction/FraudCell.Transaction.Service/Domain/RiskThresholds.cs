namespace FraudCell.Transaction.Service.Domain;

/// <summary>
/// Risk skoru esikleri 'de
/// KESIN olarak sabitlenmistir. AI Service bir <c>decision</c>/<c>riskLevel</c>
/// alani gonderse bile, nihai iş kararının otoritesi Transaction Service'tir;
/// bu yuzden skor burada BAGIMSIZ
/// olarak yeniden esiklenir.
/// </summary>
public static class RiskThresholds
{
    public static ScreeningDecision MapDecision(decimal riskScore) => riskScore switch
    {
        < 0.40m => ScreeningDecision.ONAY,
        <= 0.90m => ScreeningDecision.INCELEME,
        _ => ScreeningDecision.BLOK,
    };

    public static RiskLevel MapRiskLevel(decimal riskScore) => riskScore switch
    {
        < 0.40m => RiskLevel.DUSUK,
        < 0.70m => RiskLevel.ORTA,
        <= 0.90m => RiskLevel.YUKSEK,
        _ => RiskLevel.KRITIK,
    };

    public static SlaPriority MapSlaPriority(RiskLevel level) => level switch
    {
        RiskLevel.KRITIK => SlaPriority.KRITIK,
        RiskLevel.YUKSEK => SlaPriority.YUKSEK,
        RiskLevel.ORTA => SlaPriority.ORTA,
        _ => SlaPriority.DUSUK,
    };
}
