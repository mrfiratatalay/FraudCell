using System.Text.RegularExpressions;

namespace FraudCell.Identity.Service.Common;

/// <summary>
/// Turkcell GSM numaralarini kanonik "90XXXXXXXXXX" formatina cevirir.
/// Farkli girdi bicimlerini (0555..., +90555...,
/// 555...) tek bir unique kolona indirger.
/// </summary>
public static partial class MsisdnNormalizer
{
    /// <returns>Gecerliyse normalize edilmis numara; degilse null.</returns>
    public static string? TryNormalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var digits = NonDigit().Replace(input, string.Empty);

        // 05XXXXXXXXX -> 5XXXXXXXXX
        if (digits.Length == 11 && digits.StartsWith('0'))
        {
            digits = digits[1..];
        }

        // 905XXXXXXXXX -> zaten ulke kodu var
        if (digits.Length == 12 && digits.StartsWith("90", StringComparison.Ordinal))
        {
            digits = digits[2..];
        }

        // Su noktada 5XXXXXXXXX (10 hane, 5 ile baslar) bekleriz.
        if (digits.Length != 10 || !digits.StartsWith('5'))
        {
            return null;
        }

        return "90" + digits;
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigit();
}
