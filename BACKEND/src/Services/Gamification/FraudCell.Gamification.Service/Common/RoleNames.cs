namespace FraudCell.Gamification.Service.Common;

public static class RoleNames
{
    public const string Customer = "CUSTOMER";
    public const string Analyst = "ANALYST";
    public const string Supervisor = "SUPERVISOR";
    public const string Admin = "ADMIN";

    /// <summary>Gamification is for staff only; customers have no score (case §6).</summary>
    public static readonly string[] Staff = [Analyst, Supervisor, Admin];
}
