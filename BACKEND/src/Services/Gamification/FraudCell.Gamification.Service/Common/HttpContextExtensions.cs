using System.Security.Claims;
using FraudCell.BuildingBlocks.Api;

namespace FraudCell.Gamification.Service.Common;

public static class HttpContextExtensions
{
    public static string RequireUserId(this HttpContext context)
        => context.User.FindFirstValue("sub") ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token geçersiz.");

    public static string RequireRole(this HttpContext context)
        => context.User.FindFirstValue("role") ?? throw AppException.Unauthorized(ErrorCodes.AccessTokenInvalid, "Token geçersiz.");
}
