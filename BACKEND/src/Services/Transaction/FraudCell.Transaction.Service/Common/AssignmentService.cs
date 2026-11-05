using FraudCell.BuildingBlocks.Api;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Common;

/// <summary>
/// AI'nin sundugu aday listesini kapasiteye gore kesinlestirir (dokuman
/// `05-DOMAIN-AND-STATE-MACHINE.md` §33, `04-SERVICE-BOUNDARIES.md` §8.9).
/// AI yalnizca ONERIR; kapasiteyi authoritative olarak bu servis dogrular.
///
/// Caller bu metodu ACIK bir transaction icinde cagirmalidir (dokuman §60.2);
/// aksi halde <c>FOR UPDATE</c> kilidi SELECT sonrasinda hemen serbest kalir
/// ve yaris korumasi saglamaz.
/// </summary>
public sealed class AssignmentService(TransactionServiceDbContext db)
{
    public async Task<string?> TryAssignFirstEligibleAsync(
        IReadOnlyList<AnalystCandidate> candidates, DateTimeOffset now, CancellationToken cancellationToken)
    {
        foreach (var candidate in candidates.OrderBy(c => c.Rank))
        {
            var eligible = await db.AnalystEligibilityProjections.AsNoTracking()
                .SingleOrDefaultAsync(p => p.AnalystId == candidate.AnalystId, cancellationToken);

            if (eligible is null || !eligible.IsActive || !eligible.AssignmentEnabled)
            {
                continue;
            }

            await db.Database.ExecuteSqlAsync(
                $"""
                 INSERT INTO txn.analyst_workloads (analyst_id, active_case_count, updated_at, version)
                 VALUES ({candidate.AnalystId}, 0, {now}, 0)
                 ON CONFLICT (analyst_id) DO NOTHING
                 """,
                cancellationToken);

            var workload = await db.AnalystWorkloads
                .FromSql($"SELECT * FROM txn.analyst_workloads WHERE analyst_id = {candidate.AnalystId} FOR UPDATE")
                .SingleAsync(cancellationToken);

            if (workload.ActiveCaseCount >= AnalystWorkload.MaxActiveCases)
            {
                continue;
            }

            workload.Increment(now);
            return candidate.AnalystId;
        }

        return null;
    }

    /// <summary>Manuel/supervisor atamasinda tek bir analyst icin kapasite kontrolu (dokuman §48 ANALYST_CAPACITY_EXCEEDED).</summary>
    public async Task AssignSpecificAnalystAsync(string analystId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // The supervisor screen only offers active analysts open to assignment; the API holds the same line.
        var eligible = await db.AnalystEligibilityProjections.AsNoTracking()
            .SingleOrDefaultAsync(p => p.AnalystId == analystId, cancellationToken);
        if (eligible is null || !eligible.IsActive || !eligible.AssignmentEnabled)
        {
            throw AppException.DomainRule(ErrorCodes.AnalystNotAssignable, "Analist aktif degil ya da atamaya kapali.");
        }

        await db.Database.ExecuteSqlAsync(
            $"""
             INSERT INTO txn.analyst_workloads (analyst_id, active_case_count, updated_at, version)
             VALUES ({analystId}, 0, {now}, 0)
             ON CONFLICT (analyst_id) DO NOTHING
             """,
            cancellationToken);

        var workload = await db.AnalystWorkloads
            .FromSql($"SELECT * FROM txn.analyst_workloads WHERE analyst_id = {analystId} FOR UPDATE")
            .SingleAsync(cancellationToken);

        workload.Increment(now);
    }

    public async Task ReleaseAsync(string analystId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var workload = await db.AnalystWorkloads
            .FromSql($"SELECT * FROM txn.analyst_workloads WHERE analyst_id = {analystId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        workload?.Decrement(now);
    }
}
