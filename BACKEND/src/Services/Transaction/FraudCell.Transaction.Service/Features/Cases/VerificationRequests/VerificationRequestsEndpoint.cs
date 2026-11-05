using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.VerificationRequests;

public sealed record RequestVerificationRequest(string? Message);

public sealed record VerificationRequestResponse(
    string VerificationId, string CaseId, string Status, DateTimeOffset RequestedAt, DateTimeOffset ExpiresAt, string CaseStatus, long Version);

/// <summary><c>POST /api/v1/cases/{caseId}/verification-requests</c>. INCELENIYOR -&gt; MUSTERI_DOGRULAMA.</summary>
public static class VerificationRequestsEndpoint
{
    public static void MapVerificationRequests(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/cases/{caseId}/verification-requests", HandleAsync)
           .WithName("RequestCustomerVerification")
           .WithTags("Cases")
           .ProducesApi<VerificationRequestResponse>(StatusCodes.Status201Created)
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, RequestVerificationRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CrossCuttingEventPublisher crossCutting, CaseTransitionRecorder transitions,
        Microsoft.Extensions.Options.IOptions<AssessmentOptions> options, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var expectedVersion = ETagHelper.RequireIfMatch(httpContext.Request);

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();
        if (role == RoleNames.Analyst && riskCase.AssignedAnalystId != userId)
        {
            throw AppException.NotFound();
        }

        ETagHelper.EnsureMatches(expectedVersion, riskCase.Version);

        var alreadyPending = await db.CustomerVerifications.AnyAsync(v => v.CaseId == caseId && v.Status == VerificationStatus.PENDING, cancellationToken);
        if (alreadyPending)
        {
            throw new AppException(System.Net.HttpStatusCode.Conflict, ErrorCodes.CustomerVerificationAlreadyPending, "Bu vaka için zaten bekleyen bir doğrulama var.");
        }

        var now = clock.UtcNow;
        var previousStatus = riskCase.Status;
        var versionBefore = riskCase.Version;

        riskCase.RequestCustomerVerification(now);

        var verification = new CustomerVerification
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = caseId,
            CustomerId = riskCase.CustomerId,
            RequestedBy = userId,
            Message = request.Message,
            RequestedAt = now,
            ExpiresAt = now.AddMinutes(options.Value.CustomerVerificationTimeoutMinutes),
            CreatedAt = now,
        };

        db.CustomerVerifications.Add(verification);
        transitions.Record(riskCase, previousStatus, userId, role, TransitionSource.ANALYST, "Müşteri doğrulaması istendi.", null, versionBefore);

        outboxWriter.Enqueue(TransactionEventTypes.CaseCustomerVerificationRequested, caseId, new
        {
            caseId,
            verificationId = verification.Id,
            customerId = riskCase.CustomerId,
            expiresAt = verification.ExpiresAt,
        });

        crossCutting.PublishNotification(riskCase.CustomerId, "CUSTOMER_VERIFICATION_REQUESTED",
            "İşlem doğrulaması gerekiyor", "Şüpheli görülen işlem için doğrulamanız gerekiyor.", "CASE", caseId);

        await db.SaveChangesAsync(cancellationToken);

        ETagHelper.WriteETag(httpContext.Response, riskCase.Version);
        return Results.Created($"/api/v1/cases/{caseId}/verification-requests/{verification.Id}",
            ApiResponse<VerificationRequestResponse>.Ok(
                new VerificationRequestResponse(verification.Id, caseId, verification.Status.ToString(), verification.RequestedAt, verification.ExpiresAt, riskCase.Status.ToString(), riskCase.Version),
                correlation.CorrelationId));
    }
}
