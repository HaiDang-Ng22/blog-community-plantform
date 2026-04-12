using Blog.Domain.Entities;

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
    }
}