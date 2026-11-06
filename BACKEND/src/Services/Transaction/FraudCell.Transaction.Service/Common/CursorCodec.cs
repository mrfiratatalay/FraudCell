using System.Text;

namespace FraudCell.Transaction.Service.Common;

/// <summary>
/// Opaque keyset cursor: <c>base64url(ISO-8601 timestamp)</c> (dokuman.
/// Client bunu parse etmeye calismamalidir.
/// </summary>
public static class CursorCodec
{
    public static string Encode(DateTimeOffset value)
        => Convert.ToBase64String(Encoding.UTF8.GetBytes(value.ToString("O"))).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    public static DateTimeOffset? TryDecode(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return null;
        }

        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + ((4 - (padded.Length % 4)) % 4), '=');
            var bytes = Convert.FromBase64String(padded);
            return DateTimeOffset.Parse(Encoding.UTF8.GetString(bytes), System.Globalization.CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
