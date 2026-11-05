using System.Security.Cryptography;
using System.Text.Json;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Transaction.Service.Common;
using FraudCell.Transaction.Service.Domain;
using FraudCell.Transaction.Service.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FraudCell.Transaction.Service.Features.Transactions.CreateTransaction;

public sealed record RecipientRequest(string Reference);

public sealed record DeviceRequest(string Fingerprint);

public sealed record LocationRequest(string City, string CountryCode);

public sealed record CreateTransactionRequest(
    decimal Amount,
    string Currency,
    TransactionType TransactionType,
    RecipientRequest Recipient,
    DeviceRequest Device,
    LocationRequest Location,
    DateTimeOffset OccurredAt);

public sealed record CreateTransactionResponse(
    string TransactionId,
    string TransactionNo,
    decimal Amount,
    string Currency,
    string TransactionType,
    string AssessmentStatus,
    decimal? RiskScore,
    string? RiskLevel,
    string DisplayRiskLevel,
    string ScreeningDecision,
    string ControlStatus,
    bool TemporaryBlocked,
    DateTimeOffset CreatedAt);

/// <summary>
/// <c>POST /api/v1/transactions</c> (dokuman `07-API-DESIGN.md` §34,
/// `05-DOMAIN-AND-STATE-MACHINE.md` §45-46). AI sonucunu HTTP request icinde
/// BEKLEMEZ: islem PENDING olarak kaydedilir, event-driven degerlendirme
/// arka planda ilerler (dokuman §14 TRX-009/010/011).
/// </summary>
public static class CreateTransactionEndpoint
{
    private const int FutureToleranceMinutes = 5;

    public static void MapCreateTransaction(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/transactions", HandleAsync)
           .WithName("CreateTransaction")
           .WithTags("Transactions")
           .ProducesApi<CreateTransactionResponse>(StatusCodes.Status201Created)
           .RequireAuthorization(policy => policy.RequireRole(RoleNames.Customer));
    }

    private static async Task<IResult> HandleAsync(
        CreateTransactionRequest request,
        HttpContext httpContext,
        TransactionServiceDbContext db,
        TransactionNumberGenerator numberGenerator,
        OutboxWriter outboxWriter,
        CrossCuttingEventPublisher crossCutting,
        IClock clock,
        CorrelationContext correlation,
        Microsoft.Extensions.Options.IOptions<AssessmentOptions> assessmentOptions,
        CancellationToken cancellationToken)
    {
        var customerId = httpContext.RequireUserId();

        var idempotencyKey = httpContext.Request.Headers["Idempotency-Key"].ToString();
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            throw AppException.Validation("Idempotency-Key header'ı zorunludur.");
        }

        if (idempotencyKey.Length > 100)
        {
            throw AppException.Validation("Idempotency-Key en fazla 100 karakter olabilir.");
        }

        ValidateRequest(request);

        var requestHash = HashRequest(request);
        var existing = await db.IdempotencyRecords.AsNoTracking()
            .SingleOrDefaultAsync(r => r.Scope == "transaction.create" && r.ActorId == customerId && r.IdempotencyKey == idempotencyKey, cancellationToken);

        if (existing is not null)
        {
            if (existing.RequestHash != requestHash)
            {
                throw new AppException(
                    System.Net.HttpStatusCode.Conflict,
                    ErrorCodes.IdempotencyKeyReusedWithDifferentPayload,
                    "Bu Idempotency-Key farklı bir istek gövdesiyle daha önce kullanılmış.");
            }

            httpContext.Response.Headers["Idempotency-Replayed"] = "true";
            httpContext.Response.Headers.Location = $"/api/v1/transactions/{existing.ResourceId}";
            var cachedResponse = JsonSerializer.Deserialize<CreateTransactionResponse>(existing.ResponseBody!, JsonDefaults.Events)
                ?? throw new InvalidOperationException("Cached transaction response could not be deserialized.");

            return Results.Json(
                ApiResponse<CreateTransactionResponse>.Ok(cachedResponse, correlation.CorrelationId),
                statusCode: existing.ResponseStatusCode ?? StatusCodes.Status201Created);
        }

        var now = clock.UtcNow;
        var transactionId = Ulid.NewUlid().ToString();
        var transactionNo = await numberGenerator.NextAsync(cancellationToken);
        var deviceFingerprintHash = Convert.ToHexStringLower(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(request.Device.Fingerprint)));

        var fraudTransaction = new FraudTransaction
        {
            Id = transactionId,
            TransactionNo = transactionNo,
            CustomerId = customerId,
            Amount = request.Amount,
            Currency = request.Currency,
            TransactionType = request.TransactionType,
            RecipientReference = request.Recipient.Reference,
            DeviceFingerprintHash = deviceFingerprintHash,
            City = request.Location.City,
            CountryCode = request.Location.CountryCode.ToUpperInvariant(),
            OccurredAt = request.OccurredAt,
            AssessmentDeadlineAt = now.AddSeconds(assessmentOptions.Value.DeadlineSeconds),
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Transactions.Add(fraudTransaction);

        outboxWriter.Enqueue(TransactionEventTypes.TransactionCreated, transactionId, new
        {
            transactionId,
            transactionNo,
            customerId,
            amount = request.Amount,
            currency = request.Currency,
            transactionType = request.TransactionType.ToString(),
            recipientReference = request.Recipient.Reference,
            deviceFingerprintHash,
            city = request.Location.City,
            countryCode = fraudTransaction.CountryCode,
            occurredAt = request.OccurredAt,
            createdAt = now,
        });

        crossCutting.PublishAudit(customerId, RoleNames.Customer, AuditActions.TransactionCreated, "SUCCESS",
            "transaction", transactionId, httpContext.GetClientIp());

        var response = new CreateTransactionResponse(
            transactionId, transactionNo, request.Amount, request.Currency, request.TransactionType.ToString(),
            fraudTransaction.AssessmentStatus.ToString(), null, null, fraudTransaction.DisplayRiskLevel,
            fraudTransaction.ScreeningDecision.ToString(), fraudTransaction.ControlStatus.ToString(), false, now);

        var responseBody = JsonSerializer.Serialize(response, JsonDefaults.Events);

        db.IdempotencyRecords.Add(new IdempotencyRecord
        {
            Id = Ulid.NewUlid().ToString(),
            Scope = "transaction.create",
            ActorId = customerId,
            IdempotencyKey = idempotencyKey,
            RequestHash = requestHash,
            Status = IdempotencyStatus.COMPLETED,
            ResponseStatusCode = StatusCodes.Status201Created,
            ResponseBody = responseBody,
            ResourceId = transactionId,
            CreatedAt = now,
            ExpiresAt = now.AddHours(24),
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Paralel istek ayni key ile yaristi; unique constraint ikinci INSERT'i reddetti (dokuman §46.3).
            var raced = await db.IdempotencyRecords.AsNoTracking().AnyAsync(
                r => r.Scope == "transaction.create" && r.ActorId == customerId && r.IdempotencyKey == idempotencyKey, cancellationToken);

            if (!raced)
            {
                throw;
            }

            throw new AppException(System.Net.HttpStatusCode.Conflict, ErrorCodes.IdempotencyConflict, "Aynı istek paralel olarak zaten işleniyor.");
        }

        return ApiResults.Created($"/api/v1/transactions/{transactionId}", response, correlation);
    }

    private static void ValidateRequest(CreateTransactionRequest request)
    {
        if (request.Amount <= 0)
        {
            throw AppException.Validation("Tutar sıfırdan büyük olmalıdır.",
                new Dictionary<string, object?> { ["field"] = "amount", ["code"] = "MUST_BE_GREATER_THAN_ZERO" });
        }

        if (string.IsNullOrWhiteSpace(request.Currency) || request.Currency.Length != 3)
        {
            throw AppException.Validation("Desteklenmeyen para birimi.", new Dictionary<string, object?> { ["field"] = "currency" });
        }

        if (string.IsNullOrWhiteSpace(request.Recipient?.Reference))
        {
            throw AppException.Validation("Alici bilgisi zorunludur.", new Dictionary<string, object?> { ["field"] = "recipient.reference" });
        }

        if (string.IsNullOrWhiteSpace(request.Device?.Fingerprint))
        {
            throw AppException.Validation("Cihaz bilgisi zorunludur.", new Dictionary<string, object?> { ["field"] = "device.fingerprint" });
        }

        if (string.IsNullOrWhiteSpace(request.Location?.City) || string.IsNullOrWhiteSpace(request.Location?.CountryCode))
        {
            throw AppException.Validation("Konum bilgisi zorunludur.", new Dictionary<string, object?> { ["field"] = "location" });
        }

        if (request.OccurredAt > DateTimeOffset.UtcNow.AddMinutes(FutureToleranceMinutes))
        {
            throw AppException.Validation("İşlem zamanı gelecekte olamaz.", new Dictionary<string, object?> { ["field"] = "occurredAt" });
        }
    }

    private static string HashRequest(CreateTransactionRequest request)
        => Convert.ToHexStringLower(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(request, JsonDefaults.Events)));
}
