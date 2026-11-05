using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;

namespace FraudCell.Transaction.Service.Common;

public static class HttpContextExtensions
{
    public static string RequireUserId(this HttpContext context)
        => context.User.FindFirstValue("sub") ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token geçersiz.");

    public static string RequireRole(this HttpContext context)
        => context.User.FindFirstValue("role") ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token geçersiz.");

    public static string[] GetSpecialties(this HttpContext context)
        => context.User.FindAll("specialties").Select(c => c.Value).ToArray();

    public static string[] GetRegions(this HttpContext context)
        => context.User.FindAll("regions").Select(c => c.Value).ToArray();

    public static string? GetClientIp(this HttpContext context)
        => context.Connection.RemoteIpAddress?.ToString();

    public static bool IsInRole(this HttpContext context, string role)
        => string.Equals(context.RequireRole(), role, StringComparison.Ordinal);
}
