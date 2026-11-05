using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FraudCell.BuildingBlocks.Security;

public sealed class JwtValidationOptions
{
    public const string SectionName = "Jwt";

    public required string Issuer { get; set; }

    public required string Audience { get; set; }

    /// <summary>Identity Service's OpenID discovery document; its jwks_uri lists the signing keys.</summary>
    public required string MetadataAddress { get; set; }
}

public static class JwtAuthenticationExtensions
{
    /// <summary>
    /// Validates the access tokens Identity Service issues. The public signing
    /// keys are downloaded from Identity's JWKS endpoint and cached; a token with
    /// an unknown kid (key rotation) triggers a fresh download. No key file is
    /// shared between containers, and an Identity outage does not affect tokens
    /// whose key is already cached.
    /// </summary>
    public static AuthenticationBuilder AddFraudCellJwtBearer(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(JwtValidationOptions.SectionName).Get<JwtValidationOptions>()
            ?? throw new InvalidOperationException($"Missing '{JwtValidationOptions.SectionName}' configuration section.");

        return services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(jwt =>
            {
                jwt.MetadataAddress = options.MetadataAddress;

                // Identity is only reachable on the private service network; TLS
                // terminates in front of the gateway.
                jwt.RequireHttpsMetadata = false;

                // Keep "role"/"specialties" as issued instead of mapping them to
                // the long .NET claim type URIs.
                jwt.MapInboundClaims = false;

                jwt.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = options.Issuer,
                    ValidateAudience = true,
                    ValidAudience = options.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
                    RoleClaimType = "role",
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    ClockSkew = TimeSpan.FromSeconds(30),
                };
            });
    }
}
