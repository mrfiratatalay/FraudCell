using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.Feedback;

public sealed record SubmitFeedbackRequest(int Rating, string? Comment);

public sealed record FeedbackResponse(string FeedbackId, string CaseId, int Rating, string? Comment, DateTimeOffset SubmittedAt);

/// <summary><c>POST /api/v1/cases/{caseId}/feedback</c>. Yalnizca KAPANDI vakada, tek seferlik.</summary>
public static class SubmitFeedbackEndpoint
{
    private const int MaxCommentLength = 1000;

    public static void MapSubmitFeedback(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/cases/{caseId}/feedback", HandleAsync)
           .WithName("SubmitCaseFeedback")
           .WithTags("Cases")
           .ProducesApi<FeedbackResponse>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Customer));
    }

    private static async Task<IResult> HandleAsync(
        string caseId, SubmitFeedbackRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, OutboxWriter outboxWriter, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        if (request.Rating is < 1 or > 5)
        {
            throw AppException.Validation("Puan 1 ile 5 arasında olmalıdır.", new Dictionary<string, object?> { ["field"] = "rating" });
        }

        if (request.Comment is { Length: > MaxCommentLength })
        {
            throw AppException.Validation($"Yorum en fazla {MaxCommentLength} karakter olabilir.");
        }

        var customerId = httpContext.RequireUserId();
        var riskCase = await db.RiskCases.AsNoTracking().SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        if (riskCase.CustomerId != customerId)
        {
            throw AppException.NotFound();
        }

        if (riskCase.Status != CaseStatus.KAPANDI)
        {
            throw AppException.DomainRule(ErrorCodes.FeedbackNotAllowed, "Geri bildirim yalnızca kapanmış vakalarda verilebilir.");
        }

        var alreadySubmitted = await db.CustomerFeedbacks.AnyAsync(f => f.CaseId == caseId, cancellationToken);
        if (alreadySubmitted)
        {
            throw new AppException(System.Net.HttpStatusCode.Conflict, ErrorCodes.FeedbackAlreadySubmitted, "Bu vaka için zaten geri bildirim verilmiş.");
        }

        var now = clock.UtcNow;
        var feedback = new CustomerFeedback
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = caseId,
            TransactionId = riskCase.TransactionId,
            CustomerId = customerId,
            Rating = request.Rating,
            Comment = request.Comment,
            SubmittedAt = now,
        };

        db.CustomerFeedbacks.Add(feedback);

        outboxWriter.Enqueue(TransactionEventTypes.CustomerFeedbackSubmitted, caseId, new
        {
            caseId,
            transactionId = riskCase.TransactionId,
            customerId,
            analystId = riskCase.AssignedAnalystId,
            finalDecision = riskCase.FinalDecision?.ToString(),
            rating = request.Rating,
            submittedAt = now,
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            var raced = await db.CustomerFeedbacks.AsNoTracking().AnyAsync(f => f.CaseId == caseId, cancellationToken);
            if (!raced)
            {
                throw;
            }

            throw new AppException(System.Net.HttpStatusCode.Conflict, ErrorCodes.FeedbackAlreadySubmitted, "Bu vaka için zaten geri bildirim verilmiş.");
        }

        return Results.Created($"/api/v1/cases/{caseId}/feedback/{feedback.Id}",
            ApiResponse<FeedbackResponse>.Ok(new FeedbackResponse(feedback.Id, caseId, feedback.Rating, feedback.Comment, feedback.SubmittedAt), correlation.CorrelationId));
    }
}
