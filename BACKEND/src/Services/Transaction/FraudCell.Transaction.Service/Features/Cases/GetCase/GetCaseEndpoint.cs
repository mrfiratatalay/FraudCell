using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Cases.GetCase;

/// <summary><c>GET /api/v1/cases/{caseId}</c>. Erisim: case customer'i, atanmis analyst, supervisor/admin.</summary>
public static class GetCaseEndpoint
{
    public static void MapGetCase(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/cases/{caseId}", HandleAsync)
           .WithName("GetCase")
           .WithTags("Cases")
           .ProducesApi<CaseResponse>()
           .RequireAuthorization();
    }

    public static async Task<IResult> HandleAsync(
        string caseId, HttpContext httpContext, TransactionServiceDbContext db, IClock clock,
        CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var riskCase = await db.RiskCases.AsNoTracking().SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken);
        if (riskCase is null)
        {
            throw AppException.NotFound();
        }

        var role = httpContext.RequireRole();
        var userId = httpContext.RequireUserId();

        var authorized = role switch
        {
            RoleNames.Customer => riskCase.CustomerId == userId,
            RoleNames.Analyst => riskCase.AssignedAnalystId == userId,
            RoleNames.Supervisor or RoleNames.Admin => true,
            _ => false,
        };

        if (!authorized)
        {
            throw AppException.NotFound();
        }

        var txn = await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == riskCase.TransactionId, cancellationToken);

        httpContext.Response.Headers.ETag = $"\"{riskCase.Version}\"";
        return ApiResults.Ok(CaseProjector.Project(riskCase, txn, clock), correlation);
    }
}
