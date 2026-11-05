using System.Net;

namespace FraudCell.BuildingBlocks.Api;

/// <summary>
/// Domain ve uygulama hatalarinin tek tasiyicisi. HTTP statusu hatanin
/// kendisi belirler; controller/endpoint katmani status esleme yapmaz.
/// </summary>
public class AppException : Exception
{
    public AppException(
        HttpStatusCode statusCode,
        string code,
        string message,
        IReadOnlyDictionary<string, object?>? details = null)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
        Details = details;
    }

    public HttpStatusCode StatusCode { get; }

    public string Code { get; }

    public IReadOnlyDictionary<string, object?>? Details { get; }

    // --- Fabrikalar: cagri yerinde status/kod eslesmesi tekrar edilmesin diye ---

    public static AppException Validation(string message, IReadOnlyDictionary<string, object?>? details = null)
        => new(HttpStatusCode.BadRequest, ErrorCodes.ValidationFailed, message, details);

    /// <summary>
    /// Ownership ihlallerinde de bunu kullaniriz: kaynagin varligini sizdirmamak
    /// icin 403 yerine 404 doneriz (dokuman §7).
    /// </summary>
    public static AppException NotFound(string message = "Kayıt bulunamadı.")
        => new(HttpStatusCode.NotFound, ErrorCodes.NotFound, message);

    public static AppException Forbidden(string message = "Bu işlem için yetkiniz yok.")
        => new(HttpStatusCode.Forbidden, ErrorCodes.Forbidden, message);

    public static AppException Unauthorized(string code, string message, IReadOnlyDictionary<string, object?>? details = null)
        => new(HttpStatusCode.Unauthorized, code, message, details);

    public static AppException Conflict(string code, string message, IReadOnlyDictionary<string, object?>? details = null)
        => new(HttpStatusCode.Conflict, code, message, details);

    /// <summary>Domain/state machine kurali ihlali — 422 (dokuman §19).</summary>
    public static AppException DomainRule(string code, string message, IReadOnlyDictionary<string, object?>? details = null)
        => new(HttpStatusCode.UnprocessableEntity, code, message, details);

    public static AppException Unavailable(string message)
        => new(HttpStatusCode.ServiceUnavailable, ErrorCodes.ServiceTemporarilyUnavailable, message);

    /// <summary>Kritik state-changing endpoint'te <c>If-Match</c> header'i eksik (dokuman §15.1).</summary>
    public static AppException PreconditionRequired(string message = "Bu işlem için If-Match header'ı zorunludur.")
        => new((HttpStatusCode)428, ErrorCodes.PreconditionRequired, message);

    /// <summary>
    /// <c>If-Match</c> header'i mevcut kaynak versiyonuyla eslesmiyor (dokuman §15.2).
    /// Canonical status 412'dir; genel <see cref="ConcurrencyConflict"/> (409) ile karistirilmaz.
    /// </summary>
    public static AppException PreconditionFailed(long expectedVersion, long currentVersion)
        => new(
            HttpStatusCode.PreconditionFailed,
            ErrorCodes.ResourceVersionMismatch,
            "Kaynak başka bir kullanıcı veya işlem tarafından güncellendi.",
            new Dictionary<string, object?> { ["expectedVersion"] = expectedVersion, ["currentVersion"] = currentVersion });

    public static AppException ConcurrencyConflict(string message = "Aynı kaynak üzerinde eşzamanlı bir işlem zaten uygulandı.")
        => new(HttpStatusCode.Conflict, ErrorCodes.ConcurrencyConflict, message);
}
