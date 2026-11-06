using FraudCell.BuildingBlocks.Api;

namespace FraudCell.Transaction.Service.Domain;

/// <summary>
/// <c>txn.analyst_eligibility_projection</c>. Identity Service'ten
/// gelen analist aktiflik/uzmanlik/bolge bilgisinin local projection'i.
/// Authoritative degildir; assignment sirasinda kullanilir.
/// </summary>
public sealed class AnalystEligibilityProjection
{
    public required string AnalystId { get; set; }

    public bool IsActive { get; set; }

    public bool AssignmentEnabled { get; set; }

    /// <summary>JSONB string array: <see cref="FraudType"/> degerleri (TEMIZ haric).</summary>
    public required string SpecialtiesJson { get; set; }

    /// <summary>JSONB string array: bolge kodlari.</summary>
    public required string RegionsJson { get; set; }

    public string? DisplayName { get; set; }

    public required string LastSourceEventId { get; set; }

    public required DateTimeOffset SourceUpdatedAt { get; set; }

    public required DateTimeOffset ProjectionUpdatedAt { get; set; }
}

/// <summary>
/// <c>txn.analyst_workloads</c>. Analist basina AUTHORITATIVE
/// aktif vaka sayisi; AI'nin kendi projection'i degil, atamayi kesinlestiren
/// tek gercek kaynak budur.
/// </summary>
public sealed class AnalystWorkload
{
    public const int MaxActiveCases = 10;

    public required string AnalystId { get; set; }

    public int ActiveCaseCount { get; set; }

    public DateTimeOffset? LastAssignedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }

    /// <summary>
    /// Atomik kapasite kontrolu. Caller bu satiri
    /// <c>SELECT ... FOR UPDATE</c> ile kilitledikten sonra cagirmalidir.
    /// </summary>
    public void Increment(DateTimeOffset now)
    {
        if (ActiveCaseCount >= MaxActiveCases)
        {
            throw AppException.DomainRule(ErrorCodes.AnalystCapacityExceeded, "Analistin aktif vaka kapasitesi dolu.");
        }

        ActiveCaseCount++;
        LastAssignedAt = now;
        UpdatedAt = now;
        Version++;
    }

    public void Decrement(DateTimeOffset now)
    {
        ActiveCaseCount = Math.Max(0, ActiveCaseCount - 1);
        UpdatedAt = now;
        Version++;
    }
}
