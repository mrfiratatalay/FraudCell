using System.ComponentModel.DataAnnotations;

namespace FraudCell.BuildingBlocks.Messaging.RabbitMq;

/// <summary>RabbitMQ baglanti ve topoloji ayarlari.</summary>
public sealed class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    [Required] public string Host { get; set; } = "rabbitmq";
    public int Port { get; set; } = 5672;
    [Required] public string UserName { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
    public string VirtualHost { get; set; } = "/";

    /// <summary>Tum domain event'lerinin gectigi ana topic exchange.</summary>
    public string Exchange { get; set; } = "fraudcell.events";

    /// <summary>Gecikmeli yeniden deneme kuyruklarinin bagli oldugu exchange.</summary>
    public string RetryExchange { get; set; } = "fraudcell.retry";

    /// <summary>Retry TTL dolunca mesaji ana kuyruga geri veren exchange.</summary>
    public string RequeueExchange { get; set; } = "fraudcell.requeue";

    /// <summary>Kalici hatali mesajlarin son duragi.</summary>
    public string DeadLetterExchange { get; set; } = "fraudcell.dlq";

    /// <summary>
    /// Consumer basina ayni anda islenmemis mesaj siniri. Dusuk tutulur; tek bir
    /// consumer'in kuyrugu tek basina cekmesini ve adil dagitimi bozmasini onler.
    /// </summary>
    public ushort PrefetchCount { get; set; } = 10;

    /// <summary>
    /// 5sn -> 30sn -> 2dk, sonra DLQ. Liste uzunlugu ayni zamanda
    /// maksimum deneme sayisini belirler.
    /// </summary>
    public int[] RetryDelaysSeconds { get; set; } = [5, 30, 120];

    /// <summary>Broker kapaliyken yeniden baglanma denemeleri arasindaki bekleme.</summary>
    public int ReconnectDelaySeconds { get; set; } = 5;
}
