using System.Text.Json;
using System.Text.Json.Serialization;

namespace FraudCell.BuildingBlocks.Messaging;

/// <summary>
/// 'teki standart event zarfi. Tum servisler (Python AI dahil) bu
/// formati uretir ve tuketir; alan adlari sozlesmenin parcasidir.
/// </summary>
public sealed record EventEnvelope
{
    [JsonPropertyOrder(0)] public required string EventId { get; init; }
    [JsonPropertyOrder(1)] public required string EventType { get; init; }
    [JsonPropertyOrder(2)] public required int EventVersion { get; init; }
    [JsonPropertyOrder(3)] public required DateTimeOffset OccurredAt { get; init; }
    [JsonPropertyOrder(4)] public required string Producer { get; init; }
    [JsonPropertyOrder(5)] public required string CorrelationId { get; init; }
    [JsonPropertyOrder(6)] public string? CausationId { get; init; }
    [JsonPropertyOrder(7)] public required string SubjectId { get; init; }
    [JsonPropertyOrder(8)] public required JsonElement Payload { get; init; }

    public T PayloadAs<T>()
        => Payload.Deserialize<T>(JsonDefaultsAccessor.Events)
           ?? throw new InvalidOperationException($"Event {EventType} ({EventId}) payload'i deserialize edilemedi.");
}

/// <summary>
/// Api katmanina bagimlilik yaratmamak icin serializer ayarlarina buradan erisilir.
/// </summary>
internal static class JsonDefaultsAccessor
{
    public static JsonSerializerOptions Events => Api.JsonDefaults.Events;
}
