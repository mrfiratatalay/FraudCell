using System.Security.Cryptography;
using Konscious.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace FraudCell.Identity.Service.Security;

/// <summary>
/// ASP.NET Core Identity'nin varsayilan PBKDF2 hasher'inin yerini alir.
/// Parametreler hash'in kendisiyle birlikte saklanir; boylece ileride
/// maliyet artirilirsa eski kullanicilar basarili login sonrasi rehash edilebilir.
/// </summary>
public sealed class Argon2idPasswordHasher : IPasswordHasher<Domain.ApplicationUser>
{
    // OWASP Argon2id minimum onerisi: m>=19MiB, t>=2, p=1. Demo makinesinde
    // saniyenin cok altinda kalir, ancak brute-force maliyetini anlamli sekilde artirir.
    private const int MemoryKib = 19456;
    private const int Iterations = 2;
    private const int Parallelism = 1;
    private const int SaltLength = 16;
    private const int HashLength = 32;

    public string HashPassword(Domain.ApplicationUser user, string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var hash = ComputeHash(password, salt, MemoryKib, Iterations, Parallelism, HashLength);

        return Encode(MemoryKib, Iterations, Parallelism, salt, hash);
    }

    public PasswordVerificationResult VerifyHashedPassword(
        Domain.ApplicationUser user, string hashedPassword, string providedPassword)
    {
        if (!TryDecode(hashedPassword, out var memoryKib, out var iterations, out var parallelism, out var salt, out var expectedHash))
        {
            return PasswordVerificationResult.Failed;
        }

        var actualHash = ComputeHash(providedPassword, salt, memoryKib, iterations, parallelism, expectedHash.Length);

        if (!CryptographicOperations.FixedTimeEquals(actualHash, expectedHash))
        {
            return PasswordVerificationResult.Failed;
        }

        // Parametreler o gunden bu yana artirildiysa (guvenlik yukseltmesi) rehash isaretle.
        var needsRehash = memoryKib < MemoryKib || iterations < Iterations || parallelism < Parallelism;
        return needsRehash ? PasswordVerificationResult.SuccessRehashNeeded : PasswordVerificationResult.Success;
    }

    private static byte[] ComputeHash(string password, byte[] salt, int memoryKib, int iterations, int parallelism, int hashLength)
    {
        using var argon2 = new Argon2id(System.Text.Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = parallelism,
            Iterations = iterations,
            MemorySize = memoryKib,
        };

        return argon2.GetBytes(hashLength);
    }

    private static string Encode(int memoryKib, int iterations, int parallelism, byte[] salt, byte[] hash)
        => $"$argon2id$v=19$m={memoryKib},t={iterations},p={parallelism}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";

    private static bool TryDecode(
        string encoded, out int memoryKib, out int iterations, out int parallelism, out byte[] salt, out byte[] hash)
    {
        memoryKib = iterations = parallelism = 0;
        salt = hash = [];

        // Format: $argon2id$v=19$m=..,t=..,p=..$<salt>$<hash>
        var parts = encoded.Split('$', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 5 || parts[0] != "argon2id")
        {
            return false;
        }

        var costParts = parts[2].Split(',');
        if (costParts.Length != 3)
        {
            return false;
        }

        try
        {
            memoryKib = int.Parse(costParts[0].Split('=')[1], System.Globalization.CultureInfo.InvariantCulture);
            iterations = int.Parse(costParts[1].Split('=')[1], System.Globalization.CultureInfo.InvariantCulture);
            parallelism = int.Parse(costParts[2].Split('=')[1], System.Globalization.CultureInfo.InvariantCulture);
            salt = Convert.FromBase64String(parts[3]);
            hash = Convert.FromBase64String(parts[4]);
            return true;
        }
        catch (Exception ex) when (ex is FormatException or IndexOutOfRangeException or OverflowException)
        {
            return false;
        }
    }
}
