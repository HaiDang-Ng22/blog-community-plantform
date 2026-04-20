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
        
        // Tạo bài viết mẫu nếu chưa có
        if (!context.Posts.Any())
        {
            var posts = new List<Post>
            {
                new Post
                {
                    Id = Guid.NewGuid(),
                    Title = "Bài viết đầu tiên",
                    Slug = "bai-viet-dau-tien",
                    Content = "Nội dung bài viết đầu tiên...",
                    Summary = "Tóm tắt bài viết đầu tiên",
                    Status = PostStatus.Published,
                    AuthorId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    CreatedAt = DateTime.UtcNow,
                    PublishedAt = DateTime.UtcNow,
                    ViewCount = 0,
                    LikeCount = 0
                },
                new Post
                {
                    Id = Guid.NewGuid(),
                    Title = "Học ASP.NET Core",
                    Slug = "hoc-asp-net-core",
                    Content = "Hôm nay chúng ta học ASP.NET Core...",
                    Summary = "Hướng dẫn ASP.NET Core",
                    Status = PostStatus.Published,
                    AuthorId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    CreatedAt = DateTime.UtcNow,
                    PublishedAt = DateTime.UtcNow,
                    ViewCount = 0,
                    LikeCount = 0
                }
            };
            
            context.Posts.AddRange(posts);
            await context.SaveChangesAsync();
        }

        // Tạo Danh mục mẫu nếu chưa có
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

        // Tạo Shop mẫu nếu chưa có
        var adminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        if (!context.Shops.Any())
        {
            var shop = new Shop
            {
                Id = Guid.NewGuid(),
                UserId = adminId,
                Name = "Zynk Official Store",
                Slug = "zynk-official-store",
                Description = "Cửa hàng chính hãng của Zynk. Chuyên cung cấp các sản phẩm chất lượng cao.",
                LogoUrl = "https://ui-avatars.com/api/?name=Zynk+Shop&background=0D8ABC&color=fff",
                Rating = 5.0,
                CreatedAt = DateTime.UtcNow
            };

            context.Shops.Add(shop);
            await context.SaveChangesAsync();
        }

        // Tạo Sản phẩm mẫu nếu chưa có
        if (!context.Products.Any())
        {
            var shopId = (await context.Shops.FirstAsync()).Id;
            var catFashionId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var catPhoneId = Guid.Parse("22222222-2222-2222-2222-222222222222");

            var products = new List<Product>
            {
                new Product
                {
                    Id = Guid.NewGuid(),
                    ShopId = shopId,
                    CategoryId = catFashionId,
                    Name = "Áo thun Nam Basic Cotton 100%",
                    Slug = "ao-thun-nam-basic-cotton-100",
                    Description = "Áo thun nam phong cách basic, chất liệu cotton 100% thoáng mát, thấm hút mồ hôi tốt. Phù hợp mặc hàng ngày.",
                    Price = 150000,
                    Stock = 100,
                    FeaturedImageUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=500",
                    Status = ProductStatus.Active,
                    Rating = 4.8,
                    SalesCount = 120,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Id = Guid.NewGuid(),
                    ShopId = shopId,
                    CategoryId = catPhoneId,
                    Name = "iPhone 15 Pro Max 256GB - VN/A",
                    Slug = "iphone-15-pro-max-256gb",
                    Description = "iPhone 15 Pro Max với khung viền Titan siêu bền, chip A17 Pro mạnh mẽ nhất thế giới smartphone hiện nay.",
                    Price = 32990000,
                    Stock = 50,
                    FeaturedImageUrl = "https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=500",
                    Status = ProductStatus.Active,
                    Rating = 5.0,
                    SalesCount = 45,
                    CreatedAt = DateTime.UtcNow
                }
            };

            context.Products.AddRange(products);
            await context.SaveChangesAsync();
        }
    }
}