using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Security;

namespace FraudCell.Identity.Service.Features.Auth.CustomerOtp;

public sealed record RequestOtpChallengeRequest(string GsmNumber, OtpPurpose Purpose);

public sealed record RequestOtpChallengeResponse(
    string ChallengeId,
    DateTimeOffset ExpiresAt,
    string MaskedGsmNumber,
    string? DemoHint);

/// <summary>
/// <c>POST /api/v1/auth/customer/otp/challenges</c>.
///
/// GSM'nin sistemde kayitli olup olmadigi saldirgana acik edilmez: hem yeni
/// hem mevcut numaralar icin ayni sekil ve statuyle challenge uretilir.
/// </summary>
public static class RequestOtpChallengeEndpoint
{
    public static void MapRequestOtpChallenge(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/auth/customer/otp/challenges", HandleAsync)
           .WithName("RequestCustomerOtp")
           .WithTags("Auth")
           .ProducesApi<RequestOtpChallengeResponse>(StatusCodes.Status202Accepted)
           .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(
        RequestOtpChallengeRequest request,
        OtpService otpService,
        CorrelationContext correlation,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var gsmNumber = MsisdnNormalizer.TryNormalize(request.GsmNumber);
        if (gsmNumber is null)
        {
            throw AppException.Validation(
                "Geçerli bir Turkcell GSM numarası giriniz.",
                new Dictionary<string, object?> { ["field"] = "gsmNumber" });
        }

        var result = await otpService.IssueChallengeAsync(
            gsmNumber, request.Purpose, Common.RefreshCookie.GetClientIp(httpContext), cancellationToken);

        return Results.Accepted(
            value: ApiResponse<RequestOtpChallengeResponse>.Ok(
                new RequestOtpChallengeResponse(result.ChallengeId, result.ExpiresAt, Mask(gsmNumber), result.DemoHint),
                correlation.CorrelationId));
    }

    private static string Mask(string gsmNumber)
        => gsmNumber.Length <= 4 ? gsmNumber : $"+{gsmNumber[..2]}{new string('*', gsmNumber.Length - 6)}{gsmNumber[^4..]}";
}
