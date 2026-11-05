using FraudCell.BuildingBlocks.Security;
using FraudCell.BuildingBlocks.Api;
using FraudCell.BuildingBlocks.Correlation;
using FraudCell.BuildingBlocks.Messaging.Outbox;
using FraudCell.BuildingBlocks.Messaging.RabbitMq;
using FraudCell.BuildingBlocks.Time;
using FraudCell.Identity.Service.BackgroundJobs;
using FraudCell.Identity.Service.Common;
using FraudCell.Identity.Service.Domain;
using FraudCell.Identity.Service.Features.Audit.GetAuditLogs;
using FraudCell.Identity.Service.Features.Auth.CurrentUser;
using FraudCell.Identity.Service.Features.Auth.CustomerOtp;
using FraudCell.Identity.Service.Features.Auth.Logout;
using FraudCell.Identity.Service.Features.Auth.RefreshToken;
using FraudCell.Identity.Service.Features.Auth.Sessions;
using FraudCell.Identity.Service.Features.Auth.StaffLogin;
using FraudCell.Identity.Service.Features.Reference;
using FraudCell.Identity.Service.Features.Staff.CreateStaff;
using FraudCell.Identity.Service.Features.Staff.GetStaff;
using FraudCell.Identity.Service.Features.Staff.ListStaff;
using FraudCell.Identity.Service.Features.Staff.UpdateStaff;
using FraudCell.Identity.Service.Features.Staff.UpdateStaffRegions;
using FraudCell.Identity.Service.Features.Staff.UpdateStaffRole;
using FraudCell.Identity.Service.Features.Staff.UpdateStaffSpecialties;
using FraudCell.Identity.Service.Messaging;
using FraudCell.Identity.Service.Persistence;
using FraudCell.Identity.Service.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "identity-service")
    .Enrich.WithEnvironmentName()
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

// --- Cross-cutting ---
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<CorrelationContext>();
builder.Services.AddSingleton(new ServiceIdentity("identity-service"));
builder.Services.AddSingleton(JsonDefaults.Create());
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.ApplyTo(options.SerializerOptions));

builder.Services.Configure<JwtSigningOptions>(builder.Configuration.GetSection(JwtSigningOptions.SectionName));
builder.Services.Configure<OtpOptions>(builder.Configuration.GetSection(OtpOptions.SectionName));
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection(RabbitMqOptions.SectionName));
builder.Services.Configure<OutboxOptions>(builder.Configuration.GetSection(OutboxOptions.SectionName));

// --- Persistence ---
builder.Services.AddDbContext<IdentityServiceDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")));

builder.Services.AddScoped<IMessagingDbContext>(sp => sp.GetRequiredService<IdentityServiceDbContext>());

// --- Identity ---
builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        // Dokuman `01-REQUIREMENTS-TRACEABILITY.md` IDN-009..012: min 8 karakter,
        // buyuk harf, rakam, ozel karakter.
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequireLowercase = false;
        options.Password.RequiredUniqueChars = 1;

        // IDN-015/016: 5 basarisiz denemede 15 dakika kilit.
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.AllowedForNewUsers = true;

        options.User.RequireUniqueEmail = false;
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddRoles<ApplicationRole>()
    .AddEntityFrameworkStores<IdentityServiceDbContext>()
    .AddDefaultTokenProviders();

// Varsayilan PBKDF2 hasher yerine Argon2id (dokuman `03-TECH-STACK.md` §8.3).
builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, Argon2idPasswordHasher>();

builder.Services.AddSingleton<RsaKeyProvider>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<SessionIssuer>();
builder.Services.AddScoped<AuditWriter>();
builder.Services.AddScoped<OutboxWriter>();

// --- Messaging ---
builder.Services.AddSingleton<RabbitMqConnectionProvider>();
builder.Services.AddSingleton<RabbitMqEventPublisher>();
builder.Services.AddHostedService<OutboxPublisherService>();
builder.Services.AddHostedService<AuditEntryRequestedConsumer>();
builder.Services.AddHostedService<ExpiredCleanupWorker>();

// --- Authentication / Authorization ---
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

// RsaKeyProvider ve JwtSigningOptions'i DI konteynerini ikinci kez insa etmeden
// enjekte etmek icin tip bazli Configure asiri yuklemesi kullanilir.
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<RsaKeyProvider, Microsoft.Extensions.Options.IOptions<JwtSigningOptions>>((jwtBearerOptions, keyProvider, jwtOptionsAccessor) =>
    {
        var jwtOptions = jwtOptionsAccessor.Value;

        // MapInboundClaims kapali: "role"/"specialties" claim'leri .NET'in uzun
        // varsayilan URI'lerine donusturulmez; JwtTokenService'te uretilen isimlerle
        // birebir eslesir.
        jwtBearerOptions.MapInboundClaims = false;

        jwtBearerOptions.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = keyProvider.SigningKey,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            RoleClaimType = "role",
            NameClaimType = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

// --- Health ---
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseMiddleware<CorrelationMiddleware>();
app.UseAuthorizationDeniedAudit();
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
if (app.Environment.IsDevelopment())
{
    app.MapScalarApiReference();
}

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
app.MapJwks();

app.MapRequestOtpChallenge();
app.MapVerifyOtpChallenge();
app.MapStaffLogin();
app.MapRefreshToken();
app.MapLogout();
app.MapGetCurrentUser();
app.MapSessions();

app.MapCreateStaff();
app.MapListStaff();
app.MapGetStaff();
app.MapUpdateStaff();
app.MapUpdateStaffRole();
app.MapUpdateStaffSpecialties();
app.MapUpdateStaffRegions();

app.MapReference();
app.MapGetAuditLogs();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IdentityServiceDbContext>();
    await db.Database.MigrateAsync();
    await IdentitySeed.RunAsync(scope.ServiceProvider);
}

app.Run();

/// <summary>Test projelerinin <c>WebApplicationFactory&lt;Program&gt;</c> ile erisebilmesi icin.</summary>
public sealed partial class Program;
