using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using FraudCell.Identity.Service.Security;

namespace FraudCell.Identity.Service.Common;

/// <summary>
/// Refresh token'in HttpOnly cookie olarak tasinmasi.
/// Token asla response body'sine yazilmaz; boylece XSS ile
/// calinamaz. Cookie adi orneklerindeki <c>fraudcell_refresh</c>
/// ile birebir eslesir.
/// </summary>
public static class RefreshCookie
{
    public const string Name = "fraudcell_refresh";

    public static void Append(HttpResponse response, string rawToken, IOptions<JwtSigningOptions> options)
    {
        response.Cookies.Append(Name, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/api/v1/auth",
            MaxAge = TimeSpan.FromDays(options.Value.RefreshTokenLifetimeDays),
        });
    }

    public static void Clear(HttpResponse response)
    {
        response.Cookies.Delete(Name, new CookieOptions { Path = "/api/v1/auth" });
    }

    public static string? Read(HttpRequest request)
        => request.Cookies.TryGetValue(Name, out var value) ? value : null;

    public static string? GetClientIp(HttpContext context)
        => context.Connection.RemoteIpAddress?.ToString();
}
