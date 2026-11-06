using FraudCell.Identity.Service.Common;

namespace FraudCell.Identity.Service.Domain;

/// <summary><c>identity.specialties</c>. Fraud turleriyle uyumlu seed degerleri; <c>TEMIZ</c> haric.</summary>
public sealed class Specialty
{
    public required string Id { get; set; }

    public required AnalystSpecialty Code { get; set; }

    public required string DisplayName { get; set; }

    public bool IsActive { get; set; } = true;

    public required DateTimeOffset CreatedAt { get; set; }
}
