namespace FraudCell.Identity.Service.Domain;

/// <summary><c>identity.customer_profiles</c>.</summary>
public sealed class CustomerProfile
{
    public required string UserId { get; set; }

    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
