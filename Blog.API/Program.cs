using Blog.Infrastructure.Data;
using Blog.Infrastructure.Repositories;
using Blog.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Blog.Domain.Entities;


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
