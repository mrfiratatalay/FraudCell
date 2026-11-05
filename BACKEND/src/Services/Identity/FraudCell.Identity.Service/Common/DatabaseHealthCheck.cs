using FraudCell.Identity.Service.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FraudCell.Identity.Service.Common;

/// <summary>
/// Readiness kontrolu yalnizca bu servisin KENDI veritabanina baglanabildigini
/// dogrular; RabbitMQ veya diger servislerin durumu readiness'i
/// etkilemez.
/// </summary>
public sealed class DatabaseHealthCheck(IdentityServiceDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy("PostgreSQL connection OK.")
                : HealthCheckResult.Unhealthy("PostgreSQL connection failed.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("PostgreSQL connection threw an exception.", ex);
        }
    }
}
