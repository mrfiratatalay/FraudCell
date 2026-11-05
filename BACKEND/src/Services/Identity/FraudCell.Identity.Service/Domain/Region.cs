using FraudCell.Identity.Service.Common;

namespace FraudCell.Identity.Service.Domain;

/// <summary><c>identity.regions</c>.</summary>
public sealed class Region
{
    public required string Id { get; set; }

    public required OperationRegion Code { get; set; }

    public required string DisplayName { get; set; }

    public bool IsActive { get; set; } = true;

    public required DateTimeOffset CreatedAt { get; set; }
}
