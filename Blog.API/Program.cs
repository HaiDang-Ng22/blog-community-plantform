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
// Clear default inbound claim type mapping to prevent mapping 'role' to long XML schema URIs
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

// Local-only secrets (gitignored). Overrides appsettings.json for Gemini, etc.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

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

var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");
if (!string.IsNullOrEmpty(connectionString) && connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
{
    try
    {
        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':');
        var username = userInfo[0];
        var password = userInfo.Length > 1 ? userInfo[1] : "";
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');
        
        connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password};Ssl Mode=Require;Trust Server Certificate=true;Include Error Detail=True;";
        Console.WriteLine($"[Database] Parsed connection string from DATABASE_URL env var. Host={host}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database Error] Failed to parse DATABASE_URL: {ex.Message}");
        connectionString = null;
    }
}

if (string.IsNullOrEmpty(connectionString))
{
    connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped(typeof(IRepository<>), typeof(GenericRepository<>));
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IShopRepository, ShopRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IPushNotificationService, Blog.Infrastructure.Services.PushNotificationService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IFirebaseChatService, FirebaseChatService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IGeminiService, GeminiService>();
builder.Services.AddScoped<IGroupService, GroupService>();
builder.Services.AddScoped<Blog.Application.Services.IAiShoppingAssistantService, Blog.Infrastructure.Services.AiShoppingAssistantService>();
builder.Services.AddMemoryCache();
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
if (!string.IsNullOrEmpty(payOsClientId) && 
    !payOsClientId.StartsWith("YOUR_") && 
    payOsClientId != "YOUR_CLIENT_ID_HERE")
{
    var payOS = new PayOSClient(payOsClientId, payOsApiKey, payOsChecksumKey);
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
        Credential = GoogleCredential.FromFile(firebaseKeyPath),
    });
    // Set Firestore environment variable
    Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", firebaseKeyPath);
}
else
{
    Console.WriteLine("[Firebase Warning] firebase-key.json not found in any search paths! Chat endpoints will fail.");
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}
// app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseResponseCompression();
app.UseAuthentication();
app.UseAuthorization();

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
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Migration/Seed Error] Failed to run migration/seed: {ex.Message}");
        }
    }
    
    // Seed Real Admin User (credentials loaded from appsettings.Local.json)
    var adminEmail = builder.Configuration["AdminSettings:Email"];
    var adminPassword = builder.Configuration["AdminSettings:Password"];
    if (!string.IsNullOrEmpty(adminEmail) && !adminEmail.StartsWith("YOUR_"))
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
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword ?? "ChangeMe@2026!"),
                Role = "Admin",
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }
        else if (existingAdmin.Role != "Admin")
        {
            existingAdmin.Role = "Admin";
            await dbContext.SaveChangesAsync();
        }
    }
}
app.Run();
