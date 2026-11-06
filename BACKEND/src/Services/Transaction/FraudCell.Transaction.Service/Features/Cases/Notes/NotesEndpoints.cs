using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using Microsoft.EntityFrameworkCore;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;

namespace FraudCell.Transaction.Service.Features.Cases.Notes;

public sealed record AddNoteRequest(string Text);

public sealed record NoteResponse(string NoteId, string CaseId, string AuthorId, string Text, DateTimeOffset CreatedAt);

/// <summary><c>GET/POST /api/v1/cases/{caseId}/notes</c>.</summary>
public static class NotesEndpoints
{
    private const int MaxNoteLength = 4000;

    public static void MapNotes(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/cases/{caseId}/notes", ListAsync)
           .WithName("GetCaseNotes").WithTags("Cases")
           .ProducesApi<IReadOnlyList<NoteResponse>>()
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor));

        app.MapPost("/api/v1/cases/{caseId}/notes", AddAsync)
           .WithName("AddCaseNote").WithTags("Cases")
           .ProducesApi<NoteResponse>(StatusCodes.Status201Created)
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Analyst, RoleNames.Supervisor));
    }

    private static async Task<IResult> ListAsync(
        string caseId, HttpContext httpContext, TransactionServiceDbContext db, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        var riskCase = await RequireOwnedCaseAsync(caseId, httpContext, db, cancellationToken);

        var notes = await db.AnalystNotes.AsNoTracking()
            .Where(n => n.CaseId == riskCase.Id)
            .OrderBy(n => n.CreatedAt)
            .Select(n => new NoteResponse(n.Id, n.CaseId, n.AuthorId, n.NoteText, n.CreatedAt))
            .ToListAsync(cancellationToken);

        return ApiResults.Ok(notes, correlation);
    }

    private static async Task<IResult> AddAsync(
        string caseId, AddNoteRequest request, HttpContext httpContext, TransactionServiceDbContext db,
        IClock clock, CorrelationContext correlation, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            throw AppException.Validation("Not boş olamaz.");
        }

        if (request.Text.Length > MaxNoteLength)
        {
            throw AppException.Validation($"Not en fazla {MaxNoteLength} karakter olabilir.");
        }

        var riskCase = await RequireOwnedCaseAsync(caseId, httpContext, db, cancellationToken);
        var now = clock.UtcNow;

        var note = new AnalystNote
        {
            Id = Ulid.NewUlid().ToString(),
            CaseId = riskCase.Id,
            AuthorId = httpContext.RequireUserId(),
            AuthorRole = httpContext.RequireRole(),
            NoteText = request.Text.Trim(),
            CreatedAt = now,
        };

        db.AnalystNotes.Add(note);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/v1/cases/{caseId}/notes/{note.Id}",
            ApiResponse<NoteResponse>.Ok(new NoteResponse(note.Id, note.CaseId, note.AuthorId, note.NoteText, note.CreatedAt), correlation.CorrelationId));
    }

    private static async Task<Domain.RiskCase> RequireOwnedCaseAsync(
        string caseId, HttpContext httpContext, TransactionServiceDbContext db, CancellationToken cancellationToken)
    {
        var riskCase = await db.RiskCases.SingleOrDefaultAsync(c => c.Id == caseId, cancellationToken) ?? throw AppException.NotFound();

        var role = httpContext.RequireRole();
        if (role == RoleNames.Analyst && riskCase.AssignedAnalystId != httpContext.RequireUserId())
        {
            throw AppException.NotFound();
        }

        return riskCase;
    }
}
