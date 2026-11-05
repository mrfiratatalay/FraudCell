using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace FraudCell.BuildingBlocks.Api;

/// <summary>
/// Kritik mutable kaynaklarda (RiskCase, Staff profile, Assignment, ...) ETag/If-Match
/// tabanli optimistic concurrency sozlesmesi (dokuman §15). Version body icinde degil,
/// header'da tasinir; bu sinif cagri yerlerinde tekrar eden parse/format kodunu onler.
/// </summary>
public static class ETagHelper
{
    /// <summary>
    /// <c>If-Match</c> header'ini okur ve beklenen versiyonu doner. Header
    /// eksikse veya sayisal degilse uygun <see cref="AppException"/> firlatir.
    /// </summary>
    public static long RequireIfMatch(HttpRequest request)
    {
        var raw = request.Headers.IfMatch.ToString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw AppException.PreconditionRequired();
        }

        // "*" veya birden fazla deger baseline'da desteklenmez; tek somut versiyon beklenir.
        var value = raw.Trim().Trim('"');
        if (!long.TryParse(value, out var version) || version < 0)
        {
            throw AppException.Validation("If-Match header'ı geçerli bir kaynak versiyonu içermelidir.");
        }

        return version;
    }

    /// <summary>Beklenen versiyonu gercek versiyonla karsilastirir; uyusmuyorsa 412 firlatir.</summary>
    public static void EnsureMatches(long expectedVersion, long currentVersion)
    {
        if (expectedVersion != currentVersion)
        {
            throw AppException.PreconditionFailed(expectedVersion, currentVersion);
        }
    }

    /// <summary>Response'a <c>ETag: "N"</c> header'ini yazar (dokuman §15).</summary>
    public static void WriteETag(HttpResponse response, long version)
    {
        response.Headers.ETag = new EntityTagHeaderValue($"\"{version}\"").ToString();
    }
}
