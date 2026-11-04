using System.Security.Cryptography;
using Microsoft.Extensions.Logging;

namespace FraudCell.Transaction.Service.Security;

public sealed class JwtValidationOptions
{
    public const string SectionName = "Jwt";

    public required string Issuer { get; set; }

    public required string Audience { get; set; }

    /// <summary>PEM formatinda RSA PUBLIC key. Bu servis token URETMEZ, yalnizca dogrular (dokuman §27).</summary>
    public required string PublicKeyPath { get; set; }
}

/// <summary>
/// Identity Service'in imzaladigi token'lari dogrulamak icin yalnizca public
/// key'i yukler. Private key bu servise ASLA verilmez (dokuman §27: "Token
/// dogrulayabilen servis token uretemez").
/// </summary>
public sealed partial class RsaPublicKeyProvider
{
    private readonly Lazy<RSA> _rsa;

    public RsaPublicKeyProvider(Microsoft.Extensions.Options.IOptions<JwtValidationOptions> options, ILogger<RsaPublicKeyProvider> logger)
    {
        _rsa = new Lazy<RSA>(() =>
        {
            var path = options.Value.PublicKeyPath;
            if (!File.Exists(path))
            {
                throw new InvalidOperationException(
                    $"RSA public key not found at '{path}'. Identity Service must generate the shared key pair first.");
            }

            var rsa = RSA.Create();
            rsa.ImportFromPem(File.ReadAllText(path));
            LogPublicKeyLoaded(logger, path);
            return rsa;
        });
    }

    public RSA Rsa => _rsa.Value;

    [LoggerMessage(Level = LogLevel.Information, Message = "Loaded RSA public key from {Path}.")]
    private static partial void LogPublicKeyLoaded(ILogger logger, string path);
}
