using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FraudCell.Transaction.Service.Common;

/// <summary>
/// Yillik okunabilir islem numarasi uretir:
/// <c>TRX-{year}-{000000}</c>. <c>ON CONFLICT DO UPDATE</c> ile atomik
/// artis saglar; gaps kabul edilebilir, uniqueness zorunludur.
/// </summary>
public sealed class TransactionNumberGenerator(TransactionServiceDbContext db, IClock clock)
{
    public async Task<string> NextAsync(CancellationToken cancellationToken)
    {
        var year = clock.UtcNow.Year;
        var now = clock.UtcNow;

        await db.Database.OpenConnectionAsync(cancellationToken);
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = """
            INSERT INTO txn.transaction_number_counters (year, last_value, updated_at)
            VALUES (@year, 1, @updated_at)
            ON CONFLICT (year)
            DO UPDATE SET last_value = txn.transaction_number_counters.last_value + 1, updated_at = @updated_at
            RETURNING last_value
            """;

        var yearParameter = command.CreateParameter();
        yearParameter.ParameterName = "year";
        yearParameter.Value = year;
        command.Parameters.Add(yearParameter);

        var updatedAtParameter = command.CreateParameter();
        updatedAtParameter.ParameterName = "updated_at";
        updatedAtParameter.Value = now;
        command.Parameters.Add(updatedAtParameter);

        var result = await command.ExecuteScalarAsync(cancellationToken)
            ?? throw new InvalidOperationException("Transaction number counter did not return a value.");

        var lastValue = Convert.ToInt64(result, System.Globalization.CultureInfo.InvariantCulture);

        return $"TRX-{year}-{lastValue:D6}";
    }
}
