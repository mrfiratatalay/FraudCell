using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace FraudCell.BuildingBlocks.Messaging.RabbitMq;

/// <summary>
/// Tek, paylasilan RabbitMQ baglantisi.
///
/// Baglanti KASITLI olarak tembeldir. Broker kapaliyken servis ayaga kalkmali,
/// HTTP isteklerini kabul etmeli ve event'leri outbox'ta biriktirmelidir
/// (dokuman §19/§21). Bu yuzden constructor'da baglanti kurulmaz ve baglanti
/// hatasi uygulamayi dusurmez.
/// </summary>
public sealed partial class RabbitMqConnectionProvider : IAsyncDisposable
{
    private readonly RabbitMqOptions _options;
    private readonly ILogger<RabbitMqConnectionProvider> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ConnectionFactory _factory;

    private IConnection? _connection;
    private bool _disposed;

    public RabbitMqConnectionProvider(
        IOptions<RabbitMqOptions> options,
        ILogger<RabbitMqConnectionProvider> logger,
        Outbox.ServiceIdentity serviceIdentity)
    {
        _options = options.Value;
        _logger = logger;

        _factory = new ConnectionFactory
        {
            HostName = _options.Host,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
            // Otomatik kurtarma acik: gecici kopmalarda kanallar ve consumer'lar
            // istemci kutuphanesi tarafindan yeniden kurulur.
            AutomaticRecoveryEnabled = true,
            TopologyRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(_options.ReconnectDelaySeconds),
            // Yonetim arayuzunde hangi servisin bagli oldugu gorunsun.
            ClientProvidedName = $"fraudcell-{serviceIdentity.Name}",
        };
    }

    /// <summary>Acik baglantiyi doner; yoksa kurmayi dener. Broker kapaliysa exception firlatir.</summary>
    public async Task<IConnection> GetConnectionAsync(CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        if (_connection is { IsOpen: true })
        {
            return _connection;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_connection is { IsOpen: true })
            {
                return _connection;
            }

            if (_connection is not null)
            {
                LogConnectionClosed(_logger);
                await SafeDisposeAsync(_connection);
                _connection = null;
            }

            _connection = await _factory.CreateConnectionAsync(cancellationToken);
            LogConnected(_logger, _options.Host, _options.Port);
            return _connection;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Health check icin: baglanti su an acik mi? Yan etkisi yoktur.</summary>
    public bool IsConnected => _connection is { IsOpen: true };

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;

        if (_connection is not null)
        {
            await SafeDisposeAsync(_connection);
            _connection = null;
        }

        _gate.Dispose();
    }

    private async Task SafeDisposeAsync(IConnection connection)
    {
        try
        {
            await connection.CloseAsync();
        }
        catch (Exception ex)
        {
            LogCloseFailed(_logger, ex);
        }
        finally
        {
            await connection.DisposeAsync();
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "RabbitMQ connection was closed; reconnecting.")]
    private static partial void LogConnectionClosed(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Connected to RabbitMQ at {Host}:{Port}")]
    private static partial void LogConnected(ILogger logger, string host, int port);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Ignoring error while closing RabbitMQ connection.")]
    private static partial void LogCloseFailed(ILogger logger, Exception exception);
}
