using Microsoft.AspNetCore.Identity;

namespace FraudCell.Identity.Service.Domain;

/// <summary><c>identity.roles</c>. <see cref="IdentityRole{TKey}.Name"/> "code" kolonuna eslenir.</summary>
public sealed class ApplicationRole : IdentityRole<string>
{
    public ApplicationRole()
    {
        Id = Ulid.NewUlid().ToString();
    }

    public ApplicationRole(string code, string displayName) : this()
    {
        Name = code;
        NormalizedName = code.ToUpperInvariant();
        DisplayName = displayName;
    }

    public string DisplayName { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
