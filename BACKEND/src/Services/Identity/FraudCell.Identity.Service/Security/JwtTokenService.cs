using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FraudCell.Identity.Service.Security;

public sealed record AccessTokenResult(string Token, string Jti, DateTimeOffset ExpiresAt);

/// <summary>
/// Access token uretimi (dokuman §6/§27). RSA private key ile imzalar; yalnizca
/// bu servis private key'e sahiptir. Claim seti dokuman §6'daki ornekle birebir
/// eslesir.
/// </summary>
public sealed class JwtTokenService(RsaKeyProvider keyProvider, IOptions<JwtSigningOptions> options, IClock clock)
{
    private readonly JwtSigningOptions _options = options.Value;

    public AccessTokenResult GenerateAccessToken(
        ApplicationUser user,
        string role,
        IReadOnlyCollection<string> specialties,
        IReadOnlyCollection<string> regions)
    {
        var now = clock.UtcNow;
        var expiresAt = now.AddMinutes(_options.AccessTokenLifetimeMinutes);
        var jti = Ulid.NewUlid().ToString();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Jti, jti),
            new("role", role),
        };

        claims.AddRange(specialties.Select(specialty => new Claim("specialties", specialty)));
        claims.AddRange(regions.Select(region => new Claim("regions", region)));

        var credentials = new SigningCredentials(keyProvider.SigningKey, SecurityAlgorithms.RsaSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new AccessTokenResult(new JwtSecurityTokenHandler().WriteToken(token), jti, expiresAt);
    }
}
