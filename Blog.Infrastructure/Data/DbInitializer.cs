using Blog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Blog.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(AppDbContext context)
    {
        // Tạo user mẫu nếu chưa có
        if (!context.Users.Any())
        {
            var user = new User
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Username = "admin",
                Email = "admin@blog.com",
                PasswordHash = "temp", // Sau này sẽ hash thật
                CreatedAt = DateTime.UtcNow
            };
            
            context.Users.Add(user);
            await context.SaveChangesAsync();
        }
        
        // Tạo Danh mục mẫu nếu chưa có (Giữ lại danh mục để sử dụng)
        if (!context.Categories.Any())
        {
            var categories = new List<Category>
            {
                new Category 
                { 
                    Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), 
                    Name = "Thời trang", 
                    Slug = "thoi-trang", 
                    Icon = "fa-solid fa-shirt", 
                    CreatedAt = DateTime.UtcNow 
                },
                new Category 
                { 
                    Id = Guid.Parse("22222222-2222-2222-2222-222222222222"), 
                    Name = "Điện thoại & Phụ kiện", 
                    Slug = "dien-thoai-phu-kien", 
                    Icon = "fa-solid fa-mobile-screen", 
                    CreatedAt = DateTime.UtcNow 
                },
                new Category 
                { 
                    Id = Guid.Parse("33333333-3333-3333-3333-333333333333"), 
                    Name = "Đồ gia dụng", 
                    Slug = "do-gia-dung", 
                    Icon = "fa-solid fa-house-laptop", 
                    CreatedAt = DateTime.UtcNow 
                },
                new Category 
                { 
                    Id = Guid.Parse("44444444-4444-4444-4444-444444444444"), 
                    Name = "Máy tính & Laptop", 
                    Slug = "may-tinh-laptop", 
                    Icon = "fa-solid fa-laptop", 
                    CreatedAt = DateTime.UtcNow 
                }
            };

            context.Categories.AddRange(categories);
            await context.SaveChangesAsync();
        }
    }
}