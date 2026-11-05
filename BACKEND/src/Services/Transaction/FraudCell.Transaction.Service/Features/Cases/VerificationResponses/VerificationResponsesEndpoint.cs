using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.VerificationResponses;

public sealed record SubmitVerificationResponseRequest(string VerificationId, VerificationResponse Response);

public sealed record SubmitVerificationResponseResult(
    string VerificationId, string CaseId, string Response, DateTimeOffset RespondedAt, string CaseStatus, string TransactionControlStatus);

public sealed record PendingVerificationResponse(
    string VerificationId, string CaseId, string TransactionId, string TransactionNo, decimal Amount, string Currency,
    string TransactionType, string City, string CountryCode, DateTimeOffset OccurredAt, DateTimeOffset RequestedAt, DateTimeOffset ExpiresAt);

/// <summary>
/// <c>POST /api/v1/cases/{caseId}/verification-responses</c> (dokuman §43) ve
/// <c>GET /api/v1/customer/verifications/pending</c> (dokuman §42).
/// </summary>
public static class VerificationResponsesEndpoint
{
    public static void MapVerificationResponses(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/cases/{caseId}/verification-responses", SubmitAsync)
           .WithName("SubmitCustomerVerification").WithTags("Cases")
           .ProducesApi<SubmitVerificationResponseResult>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Customer));

        app.MapGet("/api/v1/customer/verifications/pending", ListPendingAsync)
           .WithName("GetPendingVerifications").WithTags("Cases")
           .ProducesApi<IReadOnlyList<PendingVerificationResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Customer));
    }

    private static async Task<IResult> SubmitAsync(
        string caseId, SubmitVerificationResponseRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CaseTransitionRecorder transitions, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var customerId = httpContext.RequireUserId();

        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();
        if (riskCase.CustomerId != customerId)
        {
            throw AppException.NotFound();
        }

        var verification = await db.CustomerVerifications.SingleOrDefaultAsync(v => v.Id == request.VerificationId && v.CaseId == caseId, cancellationToken)
            ?? throw AppException.NotFound();

        if (verification.Status != VerificationStatus.PENDING)
        {
            throw new AppException(System.Net.HttpStatusCode.Conflict, ErrorCodes.VerificationNotPending, "Bu doğrulama zaten cevaplanmış veya süresi dolmuş.");
        }

        var now = clock.UtcNow;
        var transaction = await db.Transactions.SingleAsync(t => t.Id == riskCase.TransactionId, cancellationToken);

        verification.Status = VerificationStatus.ANSWERED;
        verification.Response = request.Response;
        verification.RespondedAt = now;

        var previousStatus = riskCase.Status;
        var versionBefore = riskCase.Version;
        riskCase.ResumeReviewAfterVerification(now);

        if (request.Response == VerificationResponse.NOT_MINE)
        {
            riskCase.EscalateToCriticalFromCustomerDenial(riskCase.CreatedAt, now);
            transaction.MarkTemporarilyBlocked(now);

            db.TemporaryBlocks.Add(new Domain.TemporaryBlock
            {
                Id = Ulid.NewUlid().ToString(),
                TransactionId = transaction.Id,
                Reason = TemporaryBlockReason.CUSTOMER_NOT_MINE,
                AppliedBy = customerId,
                AppliedAt = now,
                CreatedAt = now,
            });
        }

        transitions.Record(riskCase, previousStatus, customerId, RoleNames.Customer, TransitionSource.CUSTOMER,
            $"Müşteri cevabı: {request.Response}", null, versionBefore);

        outboxWriter.Enqueue(TransactionEventTypes.CustomerVerificationResponded, caseId, new
        {
            caseId,
            verificationId = verification.Id,
            transactionId = transaction.Id,
            response = request.Response.ToString(),
            respondedAt = now,
        });

        await db.SaveChangesAsync(cancellationToken);

        return ApiResults.Ok(new SubmitVerificationResponseResult(
            verification.Id, caseId, request.Response.ToString(), now, riskCase.Status.ToString(), transaction.ControlStatus.ToString()), correlation);
    }

    private static async Task<IResult> ListPendingAsync(
        HttpContext httpContext, TransactionServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var customerId = httpContext.RequireUserId();

        var items = await db.CustomerVerifications.AsNoTracking()
            .Where(v => v.CustomerId == customerId && v.Status == VerificationStatus.PENDING)
            .Join(db.RiskCases, v => v.CaseId, c => c.Id, (v, c) => new { v, c })
            .Join(db.Transactions, x => x.c.TransactionId, t => t.Id, (x, t) => new PendingVerificationResponse(
                x.v.Id, x.c.Id, t.Id, t.TransactionNo, t.Amount, t.Currency, t.TransactionType.ToString(),
                t.City, t.CountryCode, t.OccurredAt, x.v.RequestedAt, x.v.ExpiresAt))
            .ToListAsync(cancellationToken);

        return ApiResults.Ok(items, correlation);
    }
}
