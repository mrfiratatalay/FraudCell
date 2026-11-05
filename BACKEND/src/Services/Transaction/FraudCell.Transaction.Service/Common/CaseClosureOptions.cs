using FraudCell.Transaction.Service.Domain;

namespace FraudCell.Transaction.Service.Common;

/// <summary>
/// When a decided case (ONAYLANDI/BLOKLANDI) becomes KAPANDI. The rule is 48 hours (dokuman §27);
/// the end-to-end tests shorten it so the customer can rate a closed case (case §4.6) within a run.
/// </summary>
public sealed class CaseClosureOptions
{
    public const string SectionName = "CaseClosure";

    public TimeSpan Delay { get; set; } = RiskCase.DefaultClosureDelay;

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromMinutes(5);
}
