using System.Security.Cryptography;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FraudCell.Identity.Service.Security;

public sealed class JwtSigningOptions
{
    public const string SectionName = "Jwt";

    public required string Issuer { get; set; }

    public required string Audience { get; set; }

    public int AccessTokenLifetimeMinutes { get; set; } = 15;

    public int RefreshTokenLifetimeDays { get; set; } = 7;

    /// <summary>PEM formatinda RSA private key dosya yolu. Repository'ye girmez (dokuman §20/SEC-011).</summary>
    public string? PrivateKeyPath { get; set; }

    /// <summary>PEM formatinda RSA public key dosya yolu; Gateway ve diger servisler bunu okur.</summary>
    public string? PublicKeyPath { get; set; }
}

/// <summary>
/// RSA anahtar ciftini saglar (dokuman §6/§27). Private key yalnizca Identity
/// Service'te bulunur; Gateway ve diger servisler yalnizca public key'e sahiptir.
///
/// Development/demo ortaminda dosya bulunmazsa gecici bir anahtar ciftinin
/// uretilip diske yazilmasina izin verilir; bu SEC-011'i ihlal etmez cunku
/// uretilen anahtar repository disindaki bir volume'a yazilir ve .gitignore
/// kapsamindadir. Production'da dosyalarin onceden var olmasi zorunludur.
/// </summary>
public sealed partial class RsaKeyProvider
{
    private readonly Lazy<RSA> _rsa;

    public RsaKeyProvider(IOptions<JwtSigningOptions> options, IHostEnvironment environment, ILogger<RsaKeyProvider> logger)
    {
        _rsa = new Lazy<RSA>(() => LoadOrGenerate(options.Value, environment, logger));
    }

    public RSA Rsa => _rsa.Value;

    private static RSA LoadOrGenerate(JwtSigningOptions options, IHostEnvironment environment, ILogger logger)
    {
        if (!string.IsNullOrWhiteSpace(options.PrivateKeyPath) && File.Exists(options.PrivateKeyPath))
        {
            var rsa = RSA.Create();
            rsa.ImportFromPem(File.ReadAllText(options.PrivateKeyPath));
            LogSigningKeyLoaded(logger, options.PrivateKeyPath);
            return rsa;
        }

        if (!environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                $"RSA private key not found at '{options.PrivateKeyPath}'. " +
                "Production/demo ortaminda anahtar onceden 'scripts/generate-dev-keys' ile uretilmis olmalidir.");
        }

        LogGeneratingEphemeralKey(logger);

        var generated = RSA.Create(2048);

        if (!string.IsNullOrWhiteSpace(options.PrivateKeyPath))
        {
            PersistKeyPair(generated, options.PrivateKeyPath, options.PublicKeyPath, logger);
        }

        return generated;
    }

    private static void PersistKeyPair(RSA rsa, string privateKeyPath, string? publicKeyPath, ILogger logger)
    {
        try
        {
            var directory = Path.GetDirectoryName(privateKeyPath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            File.WriteAllText(privateKeyPath, rsa.ExportPkcs8PrivateKeyPem());

            if (!string.IsNullOrWhiteSpace(publicKeyPath))
            {
                var publicDirectory = Path.GetDirectoryName(publicKeyPath);
                if (!string.IsNullOrEmpty(publicDirectory))
                {
                    Directory.CreateDirectory(publicDirectory);
                }

                File.WriteAllText(publicKeyPath, rsa.ExportSubjectPublicKeyInfoPem());
            }

            LogKeyPairPersisted(logger, privateKeyPath);
        }
        catch (IOException ex)
        {
            // Anahtar diske yazilamasa bile process icinde imzalama calismaya devam eder;
            // sadece diger servisler public key'i bu instance'tan okuyamaz.
            LogKeyPairPersistFailed(logger, ex);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Loaded RSA signing key from {Path}.")]
    private static partial void LogSigningKeyLoaded(ILogger logger, string? path);

    [LoggerMessage(Level = LogLevel.Warning, Message = "RSA private key not found; generating an EPHEMERAL development key pair. This must never happen outside local development.")]
    private static partial void LogGeneratingEphemeralKey(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Persisted generated development RSA key pair to {PrivateKeyPath}.")]
    private static partial void LogKeyPairPersisted(ILogger logger, string privateKeyPath);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not persist generated RSA key pair; continuing with in-memory key only.")]
    private static partial void LogKeyPairPersistFailed(ILogger logger, Exception exception);
}
