using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FraudCell.Identity.Service.Security;

/// <summary>
/// Publishes the public half of the token signing key, so the other services
/// validate JWTs without a shared key file: they read the discovery document,
/// follow its jwks_uri and cache the keys. Reachable only on the service
/// network; the gateway has no route to it.
/// </summary>
public static class JwksEndpoints
{
    public static void MapJwks(this IEndpointRouteBuilder app)
    {
        app.MapGet("/.well-known/openid-configuration", (HttpRequest request, IOptions<JwtSigningOptions> options) =>
                Results.Ok(new OpenIdConfiguration(
                    options.Value.Issuer,
                    $"{request.Scheme}://{request.Host}/.well-known/jwks.json",
                    [SecurityAlgorithms.RsaSha256])))
            .AllowAnonymous()
            .ExcludeFromDescription();

        app.MapGet("/.well-known/jwks.json", (RsaKeyProvider keys) => Results.Ok(new JsonWebKeySetDocument([keys.PublicJwk])))
            .AllowAnonymous()
            .ExcludeFromDescription();
    }
}

public sealed record OpenIdConfiguration(
    [property: JsonPropertyName("issuer")] string Issuer,
    [property: JsonPropertyName("jwks_uri")] string JwksUri,
    [property: JsonPropertyName("id_token_signing_alg_values_supported")] IReadOnlyList<string> SigningAlgorithms);

public sealed record JsonWebKeySetDocument([property: JsonPropertyName("keys")] IReadOnlyList<PublicJwk> Keys);

/// <summary>An RSA public key in JWK form (RFC 7517).</summary>
public sealed record PublicJwk(
    [property: JsonPropertyName("kty")] string KeyType,
    [property: JsonPropertyName("use")] string Use,
    [property: JsonPropertyName("alg")] string Algorithm,
    [property: JsonPropertyName("kid")] string KeyId,
    [property: JsonPropertyName("n")] string Modulus,
    [property: JsonPropertyName("e")] string Exponent);
