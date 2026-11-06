using Microsoft.AspNetCore.Identity;

namespace FraudCell.Identity.Service.Domain;

/// <summary><c>user_type</c> alani.</summary>
public enum UserType
{
    Customer,
    Staff,
}

/// <summary>
/// <c>identity.users</c> tablosunun karsiligi. ASP.NET Core
/// Identity'nin User persistence, password validation ve account lockout
/// altyapisini kullanir; GSM+OTP, JWT ve
/// custom kolonlar (user_type, gsm_number, is_active, ...) bunun uzerine eklenir.
///
/// Id kasitli olarak ULID'dir (Guid degil): tum internal
/// kimliklerin ULID olmasini sart kosar.
/// </summary>
public sealed class ApplicationUser : IdentityUser<string>
{
    public ApplicationUser()
    {
        Id = Ulid.NewUlid().ToString();
    }

    public required UserType UserType { get; set; }

    /// <summary>Normalize edilmis E.164 benzeri GSM. Personelde null.</summary>
    public string? GsmNumber { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? LastLoginAt { get; set; }

    /// <summary>Hesap pasif hale getirildiginde (ornegin personel ayrildiginda) login reddedilir.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>API seviyesinde optimistic concurrency icin. Her mutasyonda +1 artar.</summary>
    public long Version { get; set; }

    public CustomerProfile? CustomerProfile { get; set; }

    public StaffProfile? StaffProfile { get; set; }
}
