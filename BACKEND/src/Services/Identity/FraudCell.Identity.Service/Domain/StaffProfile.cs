namespace FraudCell.Identity.Service.Domain;

/// <summary>
/// <c>identity.staff_profiles</c>. Uzmanlik ve bolge coktan-coge
/// iliskilerdir; AI Service bunlari <c>identity.staff.profile.updated</c>
/// event'iyle projection olarak alir.
/// </summary>
public sealed class StaffProfile
{
    public required string UserId { get; set; }

    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    public string? EmployeeNumber { get; set; }

    /// <summary>Yalnizca ANALYST rolundeki personeller icin anlamlidir.</summary>
    public bool AssignmentEnabled { get; set; } = true;

    public required string CreatedByAdminId { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>API ETag/If-Match sozlesmesinin kaynagi.</summary>
    public long Version { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public List<StaffSpecialty> Specialties { get; set; } = [];

    public List<StaffRegion> Regions { get; set; } = [];
}

/// <summary><c>identity.staff_specialties</c>.</summary>
public sealed class StaffSpecialty
{
    public required string StaffUserId { get; set; }

    public required string SpecialtyId { get; set; }

    public required string AssignedBy { get; set; }

    public required DateTimeOffset AssignedAt { get; set; }

    public Specialty Specialty { get; set; } = null!;
}

/// <summary><c>identity.staff_regions</c>.</summary>
public sealed class StaffRegion
{
    public required string StaffUserId { get; set; }

    public required string RegionId { get; set; }

    public required string AssignedBy { get; set; }

    public required DateTimeOffset AssignedAt { get; set; }

    public Region Region { get; set; } = null!;
}
