using System.Text.Json.Serialization;

namespace FraudCell.BuildingBlocks.Api;

/// <summary>
/// 'deki standart cevap zarfi. Frontend'in
/// <c>ApiEnvelope&lt;T&gt;</c> tipiyle birebir eslesir; alan adlari degistirilemez.
/// </summary>
public sealed record ApiResponse<T>
{
    [JsonPropertyOrder(0)]
    public required bool Success { get; init; }

    [JsonPropertyOrder(1)]
    public T? Data { get; init; }

    [JsonPropertyOrder(2)]
    public ApiError? Error { get; init; }

    [JsonPropertyOrder(3)]
    public required ApiMeta Meta { get; init; }

    // CA1000 (generic tipte static uye olmasin) burada kasitli goz ardi edilir:
    // "ApiResponse<T>.Ok(...)" cagri yerinde T zaten cikarsanabildigi icin en
    // okunabilir factory bicimidir; ayri bir non-generic factory sinifi gereksiz
    // dolayli katman ekler.
#pragma warning disable CA1000
    public static ApiResponse<T> Ok(T data, string traceId, PageInfo? page = null, DateTimeOffset? generatedAt = null) => new()
#pragma warning restore CA1000
    {
        Success = true,
        Data = data,
        Error = null,
        Meta = new ApiMeta(traceId, page, generatedAt),
    };
}

/// <summary>Data tasimayan basarili cevaplar icin.</summary>
public sealed record ApiResponse
{
    [JsonPropertyOrder(0)]
    public required bool Success { get; init; }

    [JsonPropertyOrder(1)]
    public object? Data { get; init; }

    [JsonPropertyOrder(2)]
    public ApiError? Error { get; init; }

    [JsonPropertyOrder(3)]
    public required ApiMeta Meta { get; init; }

    public static ApiResponse Failure(ApiError error, string traceId) => new()
    {
        Success = false,
        Data = null,
        Error = error,
        Meta = new ApiMeta(traceId),
    };
}

public sealed record ApiError(
    string Code,
    string Message,
    IReadOnlyDictionary<string, object?>? Details = null);

/// <summary>
/// <c>meta.pagination</c> 'de tanimlanir; yalnizca liste
/// response'larinda doldurulur. <c>generatedAt</c> yalnizca rapor/dashboard
/// response'larinda kullanilir.
/// </summary>
public sealed record ApiMeta(string TraceId, PageInfo? Pagination = null, DateTimeOffset? GeneratedAt = null);

/// <summary>Cursor/keyset pagination zarfi.</summary>
public sealed record PageInfo(string? NextCursor, bool HasMore, int Limit);

/// <summary>Liste endpoint'lerinin <c>data</c> alani icin standart sekil: <c>{ items, page }</c>.</summary>
public sealed record CursorPage<T>(IReadOnlyList<T> Items, PageInfo Page);
