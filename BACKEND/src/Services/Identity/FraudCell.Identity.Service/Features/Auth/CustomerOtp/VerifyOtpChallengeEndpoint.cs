using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Features.Auth.CustomerOtp;

public sealed record VerifyOtpChallengeCustomerInfo(string FirstName, string LastName, string? Email);

public sealed record VerifyOtpChallengeRequest(string ChallengeId, string Code, VerifyOtpChallengeCustomerInfo? Customer);

public sealed record VerifiedUserResponse(string Id, string Role, string? FirstName, string? LastName, string GsmNumberMasked);

public sealed record VerifyOtpChallengeResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, VerifiedUserResponse User);

/// <summary>
/// <c>POST /api/v1/auth/customer/otp/verifications</c> (dokuman `07-API-DESIGN.md` §24).
/// <c>customer</c> alani yalnizca <c>CUSTOMER_REGISTER</c> challenge'i icin gereklidir.
/// </summary>
public static class VerifyOtpChallengeEndpoint
{
    public static void MapVerifyOtpChallenge(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/auth/customer/otp/verifications", HandleAsync)
           .WithName("VerifyCustomerOtp")
           .WithTags("Auth")
           .ProducesApi<VerifyOtpChallengeResponse>()
           .AllowAnonymous();
    }

    private static async Task<IResult> HandleAsync(
        VerifyOtpChallengeRequest request,
        OtpService otpService,
        IdentityServiceDbContext db,
        UserManager<ApplicationUser> userManager,
        SessionIssuer sessionIssuer,
        AuditWriter auditWriter,
        OutboxWriter outboxWriter,
        IClock clock,
        IOptions<JwtSigningOptions> jwtOptions,
        HttpContext httpContext,
        CorrelationContext correlation,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ChallengeId) || string.IsNullOrWhiteSpace(request.Code))
        {
            throw AppException.Validation("challengeId ve code zorunludur.");
        }

        var ip = Common.RefreshCookie.GetClientIp(httpContext);
        var (outcome, challenge) = await otpService.VerifyAsync(request.ChallengeId, request.Code.Trim(), cancellationToken);

        if (outcome != OtpVerifyOutcome.Verified || challenge is null)
        {
            var (code, message) = outcome switch
            {
                OtpVerifyOutcome.Expired => (ErrorCodes.OtpChallengeExpired, "OTP kodunun süresi dolmuş."),
                OtpVerifyOutcome.Locked => (ErrorCodes.OtpChallengeLocked, "Maksimum deneme sayısı aşıldı. Yeni bir kod isteyin."),
                OtpVerifyOutcome.AlreadyVerified => (ErrorCodes.OtpAlreadyVerified, "Bu OTP kodu zaten kullanılmış."),
                OtpVerifyOutcome.NotFound => (ErrorCodes.OtpChallengeNotFound, "Aktif bir OTP isteği bulunamadı."),
                _ => (ErrorCodes.OtpCodeInvalid, "OTP kodu hatalı."),
            };

            auditWriter.Record(null, null, AuditActions.LoginFailed, AuditResult.Failure, "otp_challenge", request.ChallengeId, ip);
            await db.SaveChangesAsync(cancellationToken);

            throw AppException.Unauthorized(code, message);
        }

        var gsmNumber = challenge.GsmNumber;
        var user = await db.Users.SingleOrDefaultAsync(u => u.GsmNumber == gsmNumber, cancellationToken);

        if (challenge.Purpose == OtpPurpose.CustomerRegister)
        {
            if (user is not null)
            {
                throw new AppException(
                    System.Net.HttpStatusCode.Conflict, ErrorCodes.GsmNumberAlreadyRegistered,
                    "Bu GSM numarasiyla zaten bir hesap mevcut.");
            }

            if (request.Customer is null || string.IsNullOrWhiteSpace(request.Customer.FirstName) || string.IsNullOrWhiteSpace(request.Customer.LastName))
            {
                throw AppException.Validation("Kayıt için müşteri ad/soyad bilgisi zorunludur.");
            }

            var now = clock.UtcNow;
            user = new ApplicationUser
            {
                UserName = gsmNumber,
                GsmNumber = gsmNumber,
                UserType = UserType.Customer,
                CreatedAt = now,
            };

            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                throw AppException.Validation("Kayıt oluşturulamadı.",
                    new Dictionary<string, object?> { ["errors"] = createResult.Errors.Select(e => e.Description).ToArray() });
            }

            await userManager.AddToRoleAsync(user, RoleNames.Customer);

            db.CustomerProfiles.Add(new CustomerProfile
            {
                UserId = user.Id,
                FirstName = request.Customer.FirstName.Trim(),
                LastName = request.Customer.LastName.Trim(),
                CreatedAt = now,
            });

            outboxWriter.Enqueue(IdentityEventTypes.CustomerRegistered, user.Id, new { userId = user.Id, gsmNumber, registeredAt = now });
            auditWriter.Record(user.Id, RoleNames.Customer, AuditActions.CustomerRegistered, AuditResult.Success, "user", user.Id, ip);
        }
        else if (user is null)
        {
            // Musteri henuz kayitli degil; enumeration onlemi icin genel OTP hatasi donulur.
            auditWriter.Record(null, null, AuditActions.LoginFailed, AuditResult.Failure, "user", null, ip);
            await db.SaveChangesAsync(cancellationToken);
            throw AppException.Unauthorized(ErrorCodes.OtpCodeInvalid, "OTP kodu hatalı.");
        }

        if (!user.IsActive)
        {
            throw AppException.Forbidden("Hesap pasif durumda.");
        }

        var profile = await db.CustomerProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);

        user.LastLoginAt = clock.UtcNow;
        user.Version++;

        var session = await sessionIssuer.IssueAsync(
            user, ip, httpContext.Request.Headers.UserAgent.ToString(), existingFamilyId: null, cancellationToken);

        auditWriter.Record(user.Id, RoleNames.Customer, AuditActions.LoginSucceeded, AuditResult.Success, "user", user.Id, ip);
        await db.SaveChangesAsync(cancellationToken);

        RefreshCookie.Append(httpContext.Response, session.RefreshToken, jwtOptions);
        httpContext.Response.Headers.CacheControl = "no-store";

        return ApiResults.Ok(
            new VerifyOtpChallengeResponse(
                session.AccessToken, session.AccessTokenExpiresAt,
                new VerifiedUserResponse(user.Id, session.Role, profile?.FirstName, profile?.LastName, MaskGsm(gsmNumber))),
            correlation);
    }

    private static string MaskGsm(string gsmNumber)
        => gsmNumber.Length <= 4 ? gsmNumber : $"+{gsmNumber[..2]}{new string('*', gsmNumber.Length - 6)}{gsmNumber[^4..]}";
}
