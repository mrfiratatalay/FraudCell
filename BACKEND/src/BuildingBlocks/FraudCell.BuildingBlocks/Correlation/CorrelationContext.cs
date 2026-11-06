using System.Text.RegularExpressions;

namespace FraudCell.BuildingBlocks.Correlation;

/// <summary>
/// Bir HTTP isteginin veya event isleyisinin ucdan uca kimligi.
/// Scoped kayitlidir; ayni request icindeki her bilesen ayni degeri gorur.
/// </summary>
public sealed class CorrelationContext
{
    public string CorrelationId { get; private set; } = Ulid.NewUlid().ToString();

    /// <summary>Bu islemi doguran ust event/command kimligi. Zincirin kokunde null olur.</summary>
    public string? CausationId { get; private set; }

    public void Set(string correlationId, string? causationId = null)
    {
        CorrelationId = correlationId;
        CausationId = causationId;
    }
}

public static partial class CorrelationId
{
    public const string HeaderName = "X-Correlation-ID";

    private const int MaxLength = 64;

    /// <summary>
    /// Disaridan gelen correlation ID'yi guvenli kabul etmeyiz. Log injection ve
    /// header splitting'i onlemek icin yalnizca kisitli alfabe ve uzunluk gecerlidir;
    /// aksi halde yeni bir ULID uretilir.
    /// </summary>
    public static string Sanitize(string? incoming)
    {
        if (string.IsNullOrWhiteSpace(incoming) ||
            incoming.Length > MaxLength ||
            !SafePattern().IsMatch(incoming))
        {
            return Ulid.NewUlid().ToString();
        }

        return incoming;
    }

    [GeneratedRegex("^[A-Za-z0-9._:-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex SafePattern();
}
