using Blog.Infrastructure.Data;
using Blog.Infrastructure.Repositories;
using Blog.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Blog.Domain.Entities;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Hubs;
using Blog.API.Services;
using Blog.Application.Services;
using Blog.Infrastructure.Services;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using PayOS;
using System.Threading.RateLimiting;
using System.Text.Json;
using Npgsql;
// Clear default inbound claim type mapping to prevent mapping 'role' to long XML schema URIs
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

// The default Windows EventLog provider can throw when the API is launched
// without administrator privileges. That secondary logging failure aborts the
// HTTP response and appears in the frontend as "Failed to fetch". Console and
// debug providers are safe for local development and container deployments.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Local-only secrets (gitignored). Overrides appsettings.json for Gemini, etc.
var contentRootLocalSettings = Path.Combine(builder.Environment.ContentRootPath, "appsettings.Local.json");
if (File.Exists(contentRootLocalSettings))
{
    builder.Configuration.AddJsonFile(contentRootLocalSettings, optional: true, reloadOnChange: true);
    Console.WriteLine("[Configuration] Loaded appsettings.Local.json from ContentRootPath.");
}
else
{
    builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
}
var renderSecretsDirectory = "/etc/secrets";
var renderLocalSettingsPath = Path.Combine(renderSecretsDirectory, "appsettings.Local.json");
if (File.Exists(renderLocalSettingsPath))
{
    builder.Configuration.AddJsonFile(
        new Microsoft.Extensions.FileProviders.PhysicalFileProvider(renderSecretsDirectory),
        "appsettings.Local.json",
        optional: false,
        reloadOnChange: false);
    Console.WriteLine("[Configuration] Loaded appsettings.Local.json from Render secret files.");
}

// Environment variables must win over local/Render secret JSON files.
// ASP.NET Core maps names such as Jwt__Key to Jwt:Key.
builder.Configuration.AddEnvironmentVariables();

// Increase upload limit
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100 MB
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100 * 1024 * 1024; // 100 MB
});

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy
            .WithOrigins(
                "http://localhost:5000",
                "http://localhost:5001",
                "http://localhost:3000",
                "http://localhost:4200",
                "http://localhost:5500",
                "http://localhost:5501",
                "http://localhost:8080",
                "http://localhost:7000",
                "http://127.0.0.1:5500",
                "http://127.0.0.1:5501",
                "http://127.0.0.1:8080",
                "https://blog-community-plantform.onrender.com"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
    };
    // Allow SignalR to pass token via query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && (path.StartsWithSegments("/hubs/chat") || path.StartsWithSegments("/hubs/notification")))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

static string ParsePostgresUri(string value)
{
    var prefix = value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ? "postgresql://" : "postgres://";
    var remaining = value.Substring(prefix.Length);
    var lastAtIndex = remaining.LastIndexOf('@');
    if (lastAtIndex > 0)
    {
        var userInfoPart = remaining.Substring(0, lastAtIndex);
        var hostAndPathPart = remaining.Substring(lastAtIndex + 1);

        var userPass = userInfoPart.Split(':', 2);
        var username = userPass.Length > 0 ? Uri.UnescapeDataString(userPass[0]) : string.Empty;
        var password = userPass.Length > 1 ? Uri.UnescapeDataString(userPass[1]) : string.Empty;

        var slashIndex = hostAndPathPart.IndexOf('/');
        var hostPort = slashIndex >= 0 ? hostAndPathPart.Substring(0, slashIndex) : hostAndPathPart;
        var dbName = slashIndex >= 0 ? hostAndPathPart.Substring(slashIndex + 1).Split('?')[0] : "postgres";

        var colonIndex = hostPort.LastIndexOf(':');
        var host = colonIndex >= 0 ? hostPort.Substring(0, colonIndex) : hostPort;
        var port = colonIndex >= 0 && int.TryParse(hostPort.Substring(colonIndex + 1), out var p) ? p : 5432;

        return new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port,
            Database = Uri.UnescapeDataString(dbName),
            Username = username,
            Password = password,
            SslMode = SslMode.Require,
            IncludeErrorDetail = true
        }.ConnectionString;
    }

    var uri = new Uri(value);
    var uInfo = uri.UserInfo.Split(':', 2);
    return new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
        Username = uInfo.Length > 0 ? Uri.UnescapeDataString(uInfo[0]) : string.Empty,
        Password = uInfo.Length > 1 ? Uri.UnescapeDataString(uInfo[1]) : string.Empty,
        SslMode = SslMode.Require,
        IncludeErrorDetail = true
    }.ConnectionString;
}

static string? NormalizePostgresConnectionString(string? rawConnectionString)
{
    if (string.IsNullOrWhiteSpace(rawConnectionString)) return null;

    var value = rawConnectionString.Trim();
    try
    {
        if (value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return ParsePostgresUri(value);
        }

        var builder = new NpgsqlConnectionStringBuilder(value);
        var configuredHost = builder.Host?.Trim() ?? string.Empty;
        if (configuredHost.StartsWith("tcp://", StringComparison.OrdinalIgnoreCase))
        {
            var tcpUri = new Uri(configuredHost);
            builder.Host = tcpUri.Host;
            if (!tcpUri.IsDefaultPort) builder.Port = tcpUri.Port;
            Console.WriteLine("[Database] Removed unsupported tcp:// prefix from database host.");
        }
        else if (configuredHost.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase))
        {
            builder.Host = configuredHost[4..].TrimStart('/');
            Console.WriteLine("[Database] Removed unsupported tcp: prefix from database host.");
        }

        return builder.ConnectionString;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database Error] Invalid PostgreSQL connection string: {ex.Message}");
        return null;
    }
}

static string? ParseLegacyConnectionStringsVariable(string? rawValue)
{
    if (string.IsNullOrWhiteSpace(rawValue)) return null;

    var value = rawValue.Trim().TrimEnd(',');
    if (!value.StartsWith('{') &&
        !value.StartsWith("\"DefaultConnection\"", StringComparison.OrdinalIgnoreCase))
    {
        return value;
    }

    try
    {
        var json = value.StartsWith('{') ? value : $"{{{value}}}";
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.TryGetProperty("DefaultConnection", out var connectionString))
            return connectionString.GetString();
    }
    catch (JsonException ex)
    {
        Console.WriteLine($"[Database Error] The legacy ConnectionStrings variable is not valid JSON: {ex.Message}");
    }

    return null;
}

var rawConnectionString = Environment.GetEnvironmentVariable("DATABASE_URL");
var connectionStringSource = "DATABASE_URL";

if (string.IsNullOrWhiteSpace(rawConnectionString))
{
    rawConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    connectionStringSource = "ConnectionStrings__DefaultConnection";
}

if (string.IsNullOrWhiteSpace(rawConnectionString))
{
    rawConnectionString = ParseLegacyConnectionStringsVariable(
        Environment.GetEnvironmentVariable("ConnectionStrings"));
    connectionStringSource = "legacy ConnectionStrings";
}

if (string.IsNullOrWhiteSpace(rawConnectionString))
{
    rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    connectionStringSource = "configuration ConnectionStrings:DefaultConnection";
}

var connectionString = NormalizePostgresConnectionString(rawConnectionString);
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("PostgreSQL connection string is missing or invalid. Configure DATABASE_URL or ConnectionStrings__DefaultConnection.");

Console.WriteLine($"[Database] Loaded connection string from {connectionStringSource}.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped(typeof(IRepository<>), typeof(GenericRepository<>));
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IShopRepository, ShopRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IPushNotificationService, Blog.Infrastructure.Services.PushNotificationService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddHostedService<PendingPaymentExpirationService>();
builder.Services.AddScoped<IFirebaseChatService, FirebaseChatService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddHttpClient<IGeminiService, GeminiService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<IGroupService, GroupService>();
builder.Services.AddScoped<Blog.Application.Services.IAiShoppingAssistantService, Blog.Infrastructure.Services.AiShoppingAssistantService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<Microsoft.AspNetCore.Authentication.IClaimsTransformation, Blog.API.Security.RealAdminClaimsTransformation>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            code = "AI_RATE_LIMITED",
            message = "Báº¡n Ä‘Ã£ gá»­i quÃ¡ nhiá»u yÃªu cáº§u tá»›i Zynk AI. Vui lÃ²ng thá»­ láº¡i sau."
        }, cancellationToken);
    };
    options.AddPolicy("AuthPolicy", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";
        return RateLimitPartition.GetFixedWindowLimiter($"auth:{ip}", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 15,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
    options.AddPolicy("AiChatPolicy", httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var isAuthenticated = !string.IsNullOrWhiteSpace(userId);
        var partitionKey = isAuthenticated
            ? $"user:{userId}"
            : $"guest:{httpContext.Connection.RemoteIpAddress}";

        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = isAuthenticated ? 30 : 5,
            Window = isAuthenticated ? TimeSpan.FromHours(1) : TimeSpan.FromDays(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});
builder.Services.AddSignalR();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

// Initialize PayOS
var payOsClientId = builder.Configuration["PayOSSettings:ClientId"];
var payOsApiKey = builder.Configuration["PayOSSettings:ApiKey"];
var payOsChecksumKey = builder.Configuration["PayOSSettings:ChecksumKey"];
static bool IsConfiguredSecret(string? value) =>
    !string.IsNullOrWhiteSpace(value) &&
    !value.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase);

if (IsConfiguredSecret(payOsClientId) &&
    IsConfiguredSecret(payOsApiKey) &&
    IsConfiguredSecret(payOsChecksumKey))
{
    var payOS = new PayOSClient(payOsClientId!, payOsApiKey!, payOsChecksumKey!);
    builder.Services.AddSingleton(payOS);
}

// Initialize Firebase
var firebaseKeyPath = Path.Combine(builder.Environment.ContentRootPath, "firebase-key.json");
if (!File.Exists(firebaseKeyPath))
{
    // Try Render's secret mount path
    var renderSecretPath = "/etc/secrets/firebase-key.json";
    if (File.Exists(renderSecretPath))
    {
        firebaseKeyPath = renderSecretPath;
    }
}
if (!File.Exists(firebaseKeyPath))
{
    var currentDirKey = Path.Combine(Directory.GetCurrentDirectory(), "firebase-key.json");
    if (File.Exists(currentDirKey))
    {
        firebaseKeyPath = currentDirKey;
    }
}

if (File.Exists(firebaseKeyPath))
{
    FirebaseApp.Create(new AppOptions()
    {
        Credential = CredentialFactory.FromFile<ServiceAccountCredential>(firebaseKeyPath).ToGoogleCredential(),
    });
    // Set Firestore environment variable
    Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", firebaseKeyPath);
}
else
{
    Console.WriteLine("[Firebase Warning] firebase-key.json not found in any search paths! Chat endpoints will fail.");
}

var app = builder.Build();

// Never expose framework stack traces to the browser. Concurrency conflicts are
// recoverable and should be presented as a short retry message.
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        var exception = feature?.Error;
        var isConcurrencyConflict = exception is DbUpdateConcurrencyException;

        var logger = context.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("GlobalExceptionHandler");
        if (exception != null) logger.LogError(exception, "Unhandled API error");

        context.Response.StatusCode = isConcurrencyConflict
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            message = isConcurrencyConflict
                ? "Dá»¯ liá»‡u vá»«a Ä‘Æ°á»£c cáº­p nháº­t á»Ÿ má»™t yÃªu cáº§u khÃ¡c. Vui lÃ²ng thá»­ láº¡i."
                : "MÃ¡y chá»§ Ä‘ang gáº·p sá»± cá»‘ táº¡m thá»i. Vui lÃ²ng thá»­ láº¡i sau."
        });
    });
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}
// app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseMiddleware<Blog.API.Security.SecurityHeadersMiddleware>();
app.UseResponseCompression();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.UseMiddleware<Blog.API.Security.AdminSecurityMiddleware>();

// Serve static files from Blog.Web
var webPath = Path.Combine(app.Environment.ContentRootPath, "..", "Blog.Web");
if (Directory.Exists(webPath))
{
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webPath)
    });
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webPath),
        OnPrepareResponse = ctx =>
        {
            var fileName = ctx.File.Name.ToLower();
            if (fileName.EndsWith(".html") || app.Environment.IsDevelopment())
            {
                ctx.Context.Response.Headers[Microsoft.Net.Http.Headers.HeaderNames.CacheControl] = "no-cache, no-store, must-revalidate";
                ctx.Context.Response.Headers[Microsoft.Net.Http.Headers.HeaderNames.Pragma] = "no-cache";
                ctx.Context.Response.Headers[Microsoft.Net.Http.Headers.HeaderNames.Expires] = "0";
            }
            else
            {
                const int durationInSeconds = 60 * 60 * 24 * 7;
                ctx.Context.Response.Headers[Microsoft.Net.Http.Headers.HeaderNames.CacheControl] =
                    $"public,max-age={durationInSeconds}";
            }
        }
    });
}

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<NotificationHub>("/hubs/notification");

// Deployment probes: liveness verifies the process, readiness verifies PostgreSQL.
app.MapGet("/health/live", () => Results.Ok(new
{
    status = "Healthy",
    service = "Zynk API",
    timestamp = DateTimeOffset.UtcNow
})).AllowAnonymous().WithName("Liveness");

app.MapGet("/health/ready", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    try
    {
        if (await dbContext.Database.CanConnectAsync(cancellationToken))
        {
            return Results.Ok(new
            {
                status = "Ready",
                database = "Connected",
                timestamp = DateTimeOffset.UtcNow
            });
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Readiness probe could not connect to PostgreSQL.");
    }

    return Results.Json(new
    {
        status = "NotReady",
        database = "Unavailable",
        timestamp = DateTimeOffset.UtcNow
    }, statusCode: StatusCodes.Status503ServiceUnavailable);
}).AllowAnonymous().WithName("Readiness");

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Ensure database and update schema using Migrations
    var connStr = dbContext.Database.GetConnectionString();
    if (string.IsNullOrEmpty(connStr) || connStr.Contains("YOUR_DB_HOST"))
    {
        Console.WriteLine("[Database Warning] Connection string is using placeholder 'YOUR_DB_HOST'. Skipping Database Migration.");
    }
    else
    {
        try
        {
            dbContext.Database.Migrate();
            // Seed initial data
            await DbInitializer.InitializeAsync(dbContext);

            // Backfill direct-transfer requests created before the dedicated
            // AwaitingBankVerification status existed. The notification is durable
            // evidence that the buyer already submitted a verification request.
            var legacyVerificationOrderIds = await dbContext.Notifications
                .AsNoTracking()
                .Where(notification =>
                    notification.Type == "PaymentVerificationRequested" &&
                    notification.TargetId.HasValue)
                .Select(notification => notification.TargetId!.Value)
                .Distinct()
                .ToListAsync();

            if (legacyVerificationOrderIds.Count > 0)
            {
                var legacyVerificationOrders = await dbContext.Orders
                    .Where(order =>
                        legacyVerificationOrderIds.Contains(order.Id) &&
                        order.PaymentMethod.ToUpper() == "BANK_TRANSFER" &&
                        (order.Status == OrderStatus.Unpaid || order.Status == OrderStatus.PendingPayment))
                    .ToListAsync();

                foreach (var order in legacyVerificationOrders)
                {
                    var previousStatus = order.Status;
                    order.Status = OrderStatus.AwaitingBankVerification;
                    order.UpdatedAt = DateTime.UtcNow;
                    dbContext.OrderStatusHistories.Add(new OrderStatusHistory
                    {
                        Id = Guid.NewGuid(),
                        OrderId = order.Id,
                        FromStatus = previousStatus,
                        ToStatus = OrderStatus.AwaitingBankVerification,
                        ChangedByUserId = order.BuyerId,
                        Note = "Äá»“ng bá»™ yÃªu cáº§u xÃ¡c minh chuyá»ƒn khoáº£n Ä‘Ã£ táº¡o trÆ°á»›c phiÃªn báº£n tráº¡ng thÃ¡i má»›i."
                    });
                }

                if (legacyVerificationOrders.Count > 0)
                {
                    await dbContext.SaveChangesAsync();
                    app.Logger.LogInformation(
                        "Backfilled {Count} legacy bank-transfer verification orders.",
                        legacyVerificationOrders.Count);
                }
            }

            var syncedOrdersNeedingNotification = await dbContext.Orders
                .Include(order => order.Items)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product.Shop)
                .Where(order =>
                    order.Status == OrderStatus.AwaitingBankVerification &&
                    order.UpdatedAt.HasValue &&
                    order.StatusHistory.Any(history =>
                        history.Note == "Äá»“ng bá»™ yÃªu cáº§u xÃ¡c minh chuyá»ƒn khoáº£n Ä‘Ã£ táº¡o trÆ°á»›c phiÃªn báº£n tráº¡ng thÃ¡i má»›i.") &&
                    !dbContext.Notifications.Any(notification =>
                        notification.Type == "PaymentVerificationRequested" &&
                        notification.TargetId == order.Id &&
                        notification.CreatedAt >= order.UpdatedAt.Value))
                .ToListAsync();

            foreach (var order in syncedOrdersNeedingNotification)
            {
                var shopUserId = order.Items.FirstOrDefault()?.Product?.Shop?.UserId;
                if (!shopUserId.HasValue) continue;

                dbContext.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    ReceiverId = shopUserId.Value,
                    ActorId = order.BuyerId,
                    Type = "PaymentVerificationRequested",
                    TargetId = order.Id,
                    Message = "Ä‘Ã£ bÃ¡o chuyá»ƒn khoáº£n thÃ nh cÃ´ng. Vui lÃ²ng kiá»ƒm tra tÃ i khoáº£n vÃ  xÃ¡c nháº­n giao dá»‹ch.",
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                });
            }

            if (syncedOrdersNeedingNotification.Count > 0)
            {
                await dbContext.SaveChangesAsync();
                app.Logger.LogInformation(
                    "Created {Count} missing notifications for synchronized bank transfers.",
                    syncedOrdersNeedingNotification.Count);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Migration/Seed Error] Failed to run migration/seed: {ex.Message}");
        }
    }
    
    // Seed Real Admin User (credentials loaded from appsettings.Local.json)
    var adminEmail = builder.Configuration["AdminSettings:Email"];
    var adminPassword = builder.Configuration["AdminSettings:Password"];
    if (!string.IsNullOrWhiteSpace(adminEmail) && !adminEmail.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(adminPassword) && !adminPassword.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) && adminPassword != "ChangeMe@2026!" && adminPassword.Length >= 8)
    {
        var existingAdmin = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == adminEmail);
        if (existingAdmin == null)
        {
            dbContext.Users.Add(new User 
            { 
                Id = Guid.NewGuid(), 
                Username = "admin_dang", 
                Email = adminEmail,
                FullName = "Admin Zynk",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword!),
                Role = "Admin",
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }
        // Existing accounts are not modified during startup
        {
            // no-op
            // skipped
        }
    }
}
app.Run();
