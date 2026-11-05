namespace FraudCell.Transaction.Service.Domain;

/// <summary><c>txn.analyst_notes</c>. Plain text, hard delete yok; duzenleme yeni revision uretir.</summary>
public sealed class AnalystNote
{
    public required string Id { get; set; }

    public required string CaseId { get; set; }

    public required string AuthorId { get; set; }

    public required string AuthorRole { get; set; }

    public required string NoteText { get; set; }

    public string? ParentNoteId { get; set; }

    public int RevisionNumber { get; set; } = 1;

    public required DateTimeOffset CreatedAt { get; set; }
}
