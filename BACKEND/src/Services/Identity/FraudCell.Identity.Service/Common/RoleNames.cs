namespace FraudCell.Identity.Service.Common;

/// <summary>
/// dort rolu tanimlar. Roller ortogonal izin degil,
/// birbirini disleyen kullanici siniflaridir; bu yuzden bir kullanicinin tam
/// olarak bir rolu vardir.
/// </summary>
public static class RoleNames
{
    public const string Customer = "CUSTOMER";
    public const string Analyst = "ANALYST";
    public const string Supervisor = "SUPERVISOR";
    public const string Admin = "ADMIN";

    public static readonly IReadOnlyList<string> All = [Customer, Analyst, Supervisor, Admin];

    /// <summary>Personel (staff) sayilan roller; musteri bunlarin disindadir.</summary>
    public static readonly IReadOnlyList<string> StaffRoles = [Analyst, Supervisor, Admin];

    public static bool IsValid(string role) => All.Contains(role, StringComparer.Ordinal);
}
