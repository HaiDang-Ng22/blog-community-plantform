using Blog.Infrastructure.Data;
using Blog.Infrastructure.Repositories;
using Blog.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Blog.Domain.Entities;
using System.IdentityModel.Tokens.Jwt;

// Clear default inbound claim type mapping to prevent mapping 'role' to long XML schema URIs
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
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
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped(typeof(IRepository<>), typeof(GenericRepository<>));
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IShopRepository, ShopRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();

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
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webPath)
    });
}

app.MapControllers();
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Ensure database and update schema if needed
    dbContext.Database.EnsureCreated();
    
    // Manual schema update for existing tables
    dbContext.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'CoverImageUrl') ALTER TABLE Users ADD CoverImageUrl NVARCHAR(MAX) NULL;");
    dbContext.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Bio') ALTER TABLE Users ADD Bio NVARCHAR(MAX) NULL;");
    dbContext.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsPrivate') ALTER TABLE Users ADD IsPrivate BIT NOT NULL DEFAULT 0;");
    dbContext.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Role') ALTER TABLE Users ADD Role NVARCHAR(50) NOT NULL DEFAULT 'User';");
    dbContext.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Comments') AND name = 'ParentCommentId') ALTER TABLE Comments ADD ParentCommentId UNIQUEIDENTIFIER NULL;");
    
    // Create PostImages table if not exists
    dbContext.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[PostImages]') AND type in (N'U'))
        BEGIN
            CREATE TABLE [PostImages] (
                [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                [PostId] UNIQUEIDENTIFIER NOT NULL,
                [Url] NVARCHAR(MAX) NOT NULL,
                [OrderIndex] INT NOT NULL DEFAULT 0,
                CONSTRAINT [FK_PostImages_Posts_PostId] FOREIGN KEY ([PostId]) REFERENCES [Posts] ([Id]) ON DELETE CASCADE
            );
        END");

    // Create Reports table if not exists
    dbContext.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Reports]') AND type in (N'U'))
        BEGIN
            CREATE TABLE [Reports] (
                [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                [PostId] UNIQUEIDENTIFIER NOT NULL,
                [ReporterId] UNIQUEIDENTIFIER NOT NULL,
                [Reason] NVARCHAR(MAX) NOT NULL,
                [CreatedAt] DATETIME2 NOT NULL,
                [IsResolved] BIT NOT NULL DEFAULT 0,
                CONSTRAINT [FK_Reports_Posts_PostId] FOREIGN KEY ([PostId]) REFERENCES [Posts] ([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_Reports_Users_ReporterId] FOREIGN KEY ([ReporterId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
            );
        END");

    // Create Blocks table if not exists
    dbContext.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Blocks]') AND type in (N'U'))
        BEGIN
            CREATE TABLE [Blocks] (
                [BlockerId] UNIQUEIDENTIFIER NOT NULL,
                [BlockedId] UNIQUEIDENTIFIER NOT NULL,
                [CreatedAt] DATETIME2 NOT NULL,
                PRIMARY KEY ([BlockerId], [BlockedId]),
                CONSTRAINT [FK_Blocks_Users_BlockerId] FOREIGN KEY ([BlockerId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
                CONSTRAINT [FK_Blocks_Users_BlockedId] FOREIGN KEY ([BlockedId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
            );
        END");

        // --- Shopping Table Creation ---
        
        // 1. Categories
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Categories]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [Categories] ([Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [Name] NVARCHAR(MAX) NOT NULL, [Slug] NVARCHAR(MAX) NOT NULL, [Icon] NVARCHAR(MAX) NULL, [CreatedAt] DATETIME2 NOT NULL);
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Categories') AND name = 'ParentCategoryId')
                BEGIN
                    ALTER TABLE [Categories] ADD [ParentCategoryId] UNIQUEIDENTIFIER NULL;
                    ALTER TABLE [Categories] ADD CONSTRAINT [FK_Categories_Categories_ParentCategoryId] FOREIGN KEY ([ParentCategoryId]) REFERENCES [Categories] ([Id]);
                END
            END");

        // 2. ShopApplications
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[ShopApplications]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [ShopApplications] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [UserId] UNIQUEIDENTIFIER NOT NULL, [ShopName] NVARCHAR(MAX) NOT NULL, [Description] NVARCHAR(MAX) NOT NULL, [IdentityInfo] NVARCHAR(MAX) NULL, 
                    [Status] INT NOT NULL DEFAULT 0, [AdminNote] NVARCHAR(MAX) NULL, [CreatedAt] DATETIME2 NOT NULL, [UpdatedAt] DATETIME2 NULL,
                    CONSTRAINT [FK_ShopApps_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
                );
            END");

        // 3. Shops
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Shops]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [Shops] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [UserId] UNIQUEIDENTIFIER NOT NULL, [Name] NVARCHAR(MAX) NOT NULL, [Slug] NVARCHAR(450) NOT NULL, [Description] NVARCHAR(MAX) NOT NULL, 
                    [LogoUrl] NVARCHAR(MAX) NULL, [CoverUrl] NVARCHAR(MAX) NULL, [Rating] FLOAT NOT NULL DEFAULT 5.0, [CreatedAt] DATETIME2 NOT NULL,
                    CONSTRAINT [FK_Shops_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                );
                CREATE UNIQUE INDEX [IX_Shops_Slug] ON [Shops] ([Slug]);
            END");

        // 4. Products
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Products]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [Products] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [ShopId] UNIQUEIDENTIFIER NOT NULL, [CategoryId] UNIQUEIDENTIFIER NOT NULL, [Name] NVARCHAR(MAX) NOT NULL, [Slug] NVARCHAR(450) NOT NULL, 
                    [Description] NVARCHAR(MAX) NOT NULL, [Price] DECIMAL(18,2) NOT NULL, [Stock] INT NOT NULL, [FeaturedImageUrl] NVARCHAR(MAX) NULL, [Status] INT NOT NULL DEFAULT 0, 
                    [Rating] FLOAT NOT NULL DEFAULT 5.0, [SalesCount] INT NOT NULL DEFAULT 0, [CreatedAt] DATETIME2 NOT NULL, [UpdatedAt] DATETIME2 NULL,
                    CONSTRAINT [FK_Products_Shops_ShopId] FOREIGN KEY ([ShopId]) REFERENCES [Shops] ([Id]) ON DELETE CASCADE,
                    CONSTRAINT [FK_Products_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION
                );
                CREATE UNIQUE INDEX [IX_Products_Slug] ON [Products] ([Slug]);
            END");

        // 5. ProductImages
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[ProductImages]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [ProductImages] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [ProductId] UNIQUEIDENTIFIER NOT NULL, [Url] NVARCHAR(MAX) NOT NULL, [OrderIndex] INT NOT NULL,
                    CONSTRAINT [FK_ProductImages_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products] ([Id]) ON DELETE CASCADE
                );
            END");

        // 6. ProductVariants
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[ProductVariants]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [ProductVariants] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [ProductId] UNIQUEIDENTIFIER NOT NULL, [Name] NVARCHAR(MAX) NOT NULL, [PriceOverride] DECIMAL(18,2) NOT NULL, [Stock] INT NOT NULL,
                    CONSTRAINT [FK_ProductVariants_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products] ([Id]) ON DELETE CASCADE
                );
            END");

        // 7. Orders
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Orders]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [Orders] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [BuyerId] UNIQUEIDENTIFIER NOT NULL, [TotalAmount] DECIMAL(18,2) NOT NULL, [Status] INT NOT NULL DEFAULT 0, 
                    [PaymentMethod] NVARCHAR(50) NOT NULL DEFAULT 'COD', [ShippingAddress] NVARCHAR(MAX) NOT NULL, [CustomerNote] NVARCHAR(MAX) NULL, [CreatedAt] DATETIME2 NOT NULL, [UpdatedAt] DATETIME2 NULL,
                    CONSTRAINT [FK_Orders_Users_BuyerId] FOREIGN KEY ([BuyerId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                );
            END");

        // 8. OrderItems
        dbContext.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[OrderItems]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [OrderItems] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, [OrderId] UNIQUEIDENTIFIER NOT NULL, [ProductId] UNIQUEIDENTIFIER NOT NULL, [VariantId] UNIQUEIDENTIFIER NULL, [Quantity] INT NOT NULL, [UnitPrice] DECIMAL(18,2) NOT NULL,
                    CONSTRAINT [FK_OrderItems_Orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [Orders] ([Id]) ON DELETE CASCADE,
                    CONSTRAINT [FK_OrderItems_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products] ([Id]) ON DELETE NO ACTION
                );
            END");
            
        // One-time cleanup of old hardcoded categories and associated products
        if (await dbContext.Categories.AnyAsync(c => c.Slug == "thoi-trang"))
        {
            await dbContext.Database.ExecuteSqlRawAsync("DELETE FROM OrderItems; DELETE FROM Orders; DELETE FROM ProductImages; DELETE FROM ProductVariants; DELETE FROM Products; DELETE FROM Categories;");
        }
    
    // Seed Real Admin User
    var adminEmail = "hd813345@gmail.com";
    var existingAdmin = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == adminEmail);
    if (existingAdmin == null)
    {
        dbContext.Users.Add(new User 
        { 
            Id = Guid.NewGuid(), 
            Username = "admin_dang", 
            Email = adminEmail,
            FullName = "Admin Zynk",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("D@ng0799192226"),
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
app.Run();
