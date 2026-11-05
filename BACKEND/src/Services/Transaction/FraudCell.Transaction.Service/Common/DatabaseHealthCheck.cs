using FraudCell.Transaction.Service.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FraudCell.Transaction.Service.Common;

/// <summary>Readiness yalnizca bu servisin KENDI veritabanina baglanabildigini dogrular.</summary>
public sealed class DatabaseHealthCheck(TransactionServiceDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            return canConnect ? HealthCheckResult.Healthy("PostgreSQL connection OK.") : HealthCheckResult.Unhealthy("PostgreSQL connection failed.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("PostgreSQL connection threw an exception.", ex);
        }
    }
}
