using System.Security.Claims;
using System.Security.Cryptography;
using FraudCell.BuildingBlocks.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Shouldly;
using Xunit;

namespace FraudCell.BuildingBlocks.Tests;

/// <summary>
/// The token checks every service runs (case §3.2, §10 "token manipulation"),
/// using the exact parameters <see cref="JwtAuthenticationExtensions"/> configures.
/// A test RSA key stands in for the one downloaded from Identity's JWKS.
/// </summary>
public sealed class JwtValidationTests
{
    private const string Issuer = "fraudcell-identity";
    private const string Audience = "fraudcell-api";

    private static readonly RsaSecurityKey IdentityKey = new(RSA.Create(2048)) { KeyId = "identity-key" };
    private static readonly RsaSecurityKey AttackerKey = new(RSA.Create(2048)) { KeyId = "identity-key" };

    private readonly JsonWebTokenHandler _handler = new();

    [Fact]
    public async Task Token_signed_by_identity_is_accepted()
    {
        (await ValidateAsync(Create())).IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task Expired_token_is_rejected()
    {
        var now = DateTime.UtcNow;
        var result = await ValidateAsync(Create(d =>
        {
            d.IssuedAt = now.AddMinutes(-20);
            d.NotBefore = now.AddMinutes(-20);
            d.Expires = now.AddMinutes(-5);
        }));

        result.IsValid.ShouldBeFalse();
        result.Exception.ShouldBeOfType<SecurityTokenExpiredException>();
    }

    [Fact]
    public async Task Token_from_another_issuer_is_rejected()
    {
        (await ValidateAsync(Create(d => d.Issuer = "https://attacker.example"))).IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Token_for_another_audience_is_rejected()
    {
        (await ValidateAsync(Create(d => d.Audience = "another-api"))).IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Token_signed_with_another_key_under_the_same_kid_is_rejected()
    {
        var result = await ValidateAsync(Create(d => d.SigningCredentials = new SigningCredentials(AttackerKey, SecurityAlgorithms.RsaSha256)));

        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Unsigned_alg_none_token_is_rejected()
    {
        (await ValidateAsync(Create(d => d.SigningCredentials = null))).IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Token_signed_with_hs256_is_rejected()
    {
        // Algorithm confusion: an HMAC signed with a key the attacker knows.
        var hmacKey = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(64)) { KeyId = "identity-key" };
        var token = Create(d => d.SigningCredentials = new SigningCredentials(hmacKey, SecurityAlgorithms.HmacSha256));

        var parameters = ProductionParameters();
        parameters.IssuerSigningKeys = [IdentityKey, hmacKey];

        (await _handler.ValidateTokenAsync(token, parameters)).IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Token_with_a_changed_role_is_rejected()
    {
        var parts = Create().Split('.');
        var claims = Base64UrlEncoder.Decode(parts[1]).Replace("\"ANALYST\"", "\"ADMIN\"", StringComparison.Ordinal);
        var tampered = $"{parts[0]}.{Base64UrlEncoder.Encode(claims)}.{parts[2]}";

        (await ValidateAsync(tampered)).IsValid.ShouldBeFalse();
    }

    private static string Create(Action<SecurityTokenDescriptor>? change = null)
    {
        var now = DateTime.UtcNow;
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.AddMinutes(15),
            Subject = new ClaimsIdentity([new Claim("sub", "analyst-1"), new Claim("role", "ANALYST")]),
            SigningCredentials = new SigningCredentials(IdentityKey, SecurityAlgorithms.RsaSha256),
        };
        change?.Invoke(descriptor);
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    private Task<TokenValidationResult> ValidateAsync(string token) => _handler.ValidateTokenAsync(token, ProductionParameters());

    private static TokenValidationParameters ProductionParameters()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = Issuer,
                ["Jwt:Audience"] = Audience,
                ["Jwt:MetadataAddress"] = "http://identity-service:8080/.well-known/openid-configuration",
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddFraudCellJwtBearer(configuration);
        using var provider = services.BuildServiceProvider();

        var parameters = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>()
            .Get(JwtBearerDefaults.AuthenticationScheme).TokenValidationParameters.Clone();
        parameters.IssuerSigningKey = IdentityKey;
        return parameters;
    }
}
