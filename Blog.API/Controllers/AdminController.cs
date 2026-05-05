using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Blog.Application.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Extensions;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("cleanup-social-data")]
    public async Task<IActionResult> CleanupSocialData()
    {
        return await PerformCleanup();
    }

    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { message = "Admin Controller is active - v4" });

    [HttpGet("cleanup-now")]
    public async Task<IActionResult> CleanupNow()
    {
        return await PerformCleanup();
    }

    private async Task<IActionResult> PerformCleanup()
    {
        var adminId = User.GetUserId();
        if (adminId == null) return Unauthorized();

        var id = adminId.Value;

        // 1. Delete all posts by this admin
        var posts = await _context.Posts.Where(p => p.AuthorId == id).ToListAsync();
        _context.Posts.RemoveRange(posts);

        // 2. Delete all follows involving this admin
        var follows = await _context.Follows
            .Where(f => f.FollowerId == id || f.FollowingId == id)
            .ToListAsync();
        _context.Follows.RemoveRange(follows);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Dữ liệu Social của Admin đã được dọn dẹp sạch sẽ." });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalUsers = await _context.Users.CountAsync();
        var activeShops = await _context.Shops.CountAsync(s => !s.IsSuspended);
        
        var today = DateTime.UtcNow.Date;
        var dailyOrders = await _context.Orders
            .CountAsync(o => o.CreatedAt >= today);
            
        var pendingReports = await _context.Reports.CountAsync(r => !r.IsResolved);
        var pendingShops = await _context.ShopApplications.CountAsync(s => s.Status == ShopApplicationStatus.Pending);

        // Revenue per shop (top 5)
        var topShops = await _context.OrderItems
            .Include(oi => oi.Product)
                .ThenInclude(p => p.Shop)
            .GroupBy(oi => new { oi.Product.ShopId, oi.Product.Shop.Name })
            .Select(g => new
            {
                ShopId = g.Key.ShopId,
                ShopName = g.Key.Name,
                OrderCount = g.Count(),
                TotalRevenue = g.Sum(oi => oi.UnitPrice * oi.Quantity)
            })
            .OrderByDescending(x => x.TotalRevenue)
            .Take(5)
            .ToListAsync();

        // Chart Data: Revenue last 7 days (Generate all 7 days even if 0)
        var last7Days = Enumerable.Range(0, 7)
            .Select(i => DateTime.UtcNow.Date.AddDays(-i))
            .OrderBy(d => d)
            .ToList();

        var dailyStatsRaw = await _context.OrderItems
            .Include(oi => oi.Order)
            .Where(oi => oi.Order.CreatedAt >= last7Days.First())
            .GroupBy(oi => oi.Order.CreatedAt.Date)
            .Select(g => new
            {
                Date = g.Key,
                Revenue = g.Sum(oi => oi.UnitPrice * oi.Quantity)
            })
            .ToListAsync();

        var dailyStats = last7Days.Select(date => new
        {
            Date = date.ToString("dd/MM"),
            Revenue = dailyStatsRaw.FirstOrDefault(d => d.Date == date)?.Revenue ?? 0
        });

        return Ok(new
        {
            totalUsers,
            activeShops,
            dailyOrders,
            pendingReports,
            pendingShops,
            topShops,
            dailyStats
        });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .Where(u => u.Role.ToLower() != "admin")
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.Email,
                u.FullName,
                u.Role,
                u.AvatarUrl,
                u.CreatedAt,
                PostCount = u.Posts.Count
            })
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("reports")]
    public async Task<IActionResult> GetReports()
    {
        var reports = await _context.Reports
            .Include(r => r.Reporter)
            .Include(r => r.Post)
                .ThenInclude(p => p.Author)
            .Include(r => r.Post)
                .ThenInclude(p => p.Images)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var result = reports.Select(r => new
        {
            r.Id,
            r.PostId,
            r.Reason,
            r.CreatedAt,
            r.IsResolved,
            ReporterName = r.Reporter.FullName,
            PostTitle = r.Post != null ? r.Post.Title : null,
            PostContent = r.Post != null ? r.Post.Content : null,
            PostImageUrl = r.Post != null ? r.Post.FeaturedImageUrl : null,
            PostImageUrls = r.Post != null
                ? r.Post.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList()
                : new List<string>(),
            PostAuthorName = r.Post != null ? r.Post.Author.FullName : "Không rõ",
            PostAuthorId = r.Post != null ? r.Post.AuthorId : (Guid?)null,
            PostAuthorIsPrivate = r.Post != null && r.Post.Author.IsPrivate
        });

        return Ok(result);
    }

    // Admin-only: get any post bypassing privacy restrictions
    [HttpGet("posts/{id}")]
    public async Task<IActionResult> GetPostByIdAdmin(Guid id)
    {
        var post = await _context.Posts
            .Include(p => p.Author)
            .Include(p => p.Images)
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null) return NotFound(new { message = "Không tìm thấy bài viết" });

        return Ok(new
        {
            post.Id,
            post.Title,
            post.Slug,
            post.Content,
            post.Summary,
            post.FeaturedImageUrl,
            ImageUrls = post.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            post.ViewCount,
            post.LikeCount,
            Status = post.Status.ToString(),
            AuthorName = post.Author?.FullName ?? "Người dùng",
            AuthorAvatarUrl = post.Author?.AvatarUrl,
            AuthorId = post.AuthorId,
            AuthorIsPrivate = post.Author?.IsPrivate ?? false,
            post.CreatedAt,
            post.PublishedAt,
            CommentCount = post.Comments.Count
        });
    }

    [HttpDelete("delete-post/{id}")]
    public async Task<IActionResult> DeletePostAdmin(Guid id)
    {
        var post = await _context.Posts
            .Include(p => p.Images)
            .Include(p => p.Comments)
            .Include(p => p.PostLikes)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null) return NotFound();

        var adminId = User.GetUserId() ?? Guid.Empty;

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Thông báo cho tác giả
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                ReceiverId = post.AuthorId,
                ActorId = adminId,
                Type = "System",
                Message = $"Bài viết '{post.Title}' của bạn đã bị xóa do vi phạm quy tắc cộng đồng.",
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            // Xóa ảnh, bình luận, lượt thích liên quan
            _context.PostImages.RemoveRange(post.Images);
            _context.Comments.RemoveRange(post.Comments);
            _context.PostLikes.RemoveRange(post.PostLikes);
            
            // Xử lý các báo cáo liên quan
            var relatedReports = await _context.Reports.Where(r => r.PostId == id).ToListAsync();
            foreach (var r in relatedReports)
            {
                r.IsResolved = true;
            }

            _context.Posts.Remove(post);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = "Đã xóa bài viết vĩnh viễn." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { message = "Lỗi khi xóa bài viết: " + ex.Message });
        }
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.Posts)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound();

        return Ok(new
        {
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.AvatarUrl,
            user.Bio,
            user.Role,
            user.CreatedAt,
            PostCount = user.Posts.Count
        });
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.Role == "Admin") return BadRequest(new { message = "Không thể xóa tài khoản Admin." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Blocks
            var blocks = await _context.Blocks.Where(b => b.BlockerId == id || b.BlockedId == id).ToListAsync();
            _context.Blocks.RemoveRange(blocks);

            // 2. Follows
            var follows = await _context.Follows.Where(f => f.FollowerId == id || f.FollowingId == id).ToListAsync();
            _context.Follows.RemoveRange(follows);

            // 3. Post Likes
            var postLikes = await _context.PostLikes.Where(pl => pl.UserId == id).ToListAsync();
            _context.PostLikes.RemoveRange(postLikes);

            // 4. Notifications
            var notifications = await _context.Notifications.Where(n => n.ActorId == id || n.ReceiverId == id).ToListAsync();
            _context.Notifications.RemoveRange(notifications);

            // 5. Reports
            var reports = await _context.Reports.Where(r => r.ReporterId == id).ToListAsync();
            _context.Reports.RemoveRange(reports);

            // 6. Product Reviews
            var reviews = await _context.ProductReviews.Where(pr => pr.UserId == id).ToListAsync();
            _context.ProductReviews.RemoveRange(reviews);

            // 7. Orders (where user is Buyer)
            var buyerOrders = await _context.Orders.Where(o => o.BuyerId == id).ToListAsync();
            _context.Orders.RemoveRange(buyerOrders);

            // 8. Shop and Shop Applications
            var shopApps = await _context.ShopApplications.Where(sa => sa.UserId == id).ToListAsync();
            _context.ShopApplications.RemoveRange(shopApps);

            var shop = await _context.Shops.FirstOrDefaultAsync(s => s.UserId == id);
            if (shop != null)
            {
                var userProductIds = await _context.Products.Where(p => p.ShopId == shop.Id).Select(p => p.Id).ToListAsync();
                if (userProductIds.Any())
                {
                    var relatedOrderItems = await _context.OrderItems.Where(oi => userProductIds.Contains(oi.ProductId)).ToListAsync();
                    _context.OrderItems.RemoveRange(relatedOrderItems);
                    
                    // Delete orders associated with this shop's items (so we don't leave orphaned orders)
                    var relatedOrderIds = relatedOrderItems.Select(oi => oi.OrderId).Distinct().ToList();
                    var relatedOrders = await _context.Orders.Where(o => relatedOrderIds.Contains(o.Id)).ToListAsync();
                    _context.Orders.RemoveRange(relatedOrders);
                }
                _context.Shops.Remove(shop);
            }

            // 9. Comments (and all their descendant replies)
            var allComments = await _context.Comments.Select(c => new { c.Id, c.ParentCommentId, c.AuthorId, c.PostId }).ToListAsync();
            var commentIdsToDelete = new HashSet<Guid>();
            var queue = new Queue<Guid>();
            
            // Start with comments authored by the user
            foreach (var c in allComments.Where(x => x.AuthorId == id))
            {
                if (commentIdsToDelete.Add(c.Id))
                    queue.Enqueue(c.Id);
            }

            // Also include all comments on posts authored by the user
            var userPosts = await _context.Posts.Where(p => p.AuthorId == id).Select(p => p.Id).ToListAsync();
            foreach (var c in allComments.Where(x => userPosts.Contains(x.PostId)))
            {
                if (commentIdsToDelete.Add(c.Id))
                    queue.Enqueue(c.Id);
            }

            // Find all replies recursively
            while (queue.Count > 0)
            {
                var curr = queue.Dequeue();
                foreach (var c in allComments.Where(x => x.ParentCommentId == curr))
                {
                    if (commentIdsToDelete.Add(c.Id))
                        queue.Enqueue(c.Id);
                }
            }

            if (commentIdsToDelete.Any())
            {
                var commentsToDeleteList = await _context.Comments
                    .Where(c => commentIdsToDelete.Contains(c.Id))
                    .ToListAsync();
                _context.Comments.RemoveRange(commentsToDeleteList);
            }

            // 10. Posts
            var posts = await _context.Posts.Where(p => p.AuthorId == id).ToListAsync();
            _context.Posts.RemoveRange(posts);

            // 11. Remove the user
            _context.Users.Remove(user);
            
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = "Đã xóa tài khoản người dùng và tất cả dữ liệu liên quan." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { message = "Lỗi khi xóa người dùng: " + (ex.InnerException?.Message ?? ex.Message) });
        }
    }

    [HttpPost("reports/{id}/resolve")]
    public async Task<IActionResult> ResolveReport(Guid id)
    {
        var report = await _context.Reports.FindAsync(id);
        if (report == null) return NotFound();

        report.IsResolved = true;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã đánh dấu báo cáo là đã xử lý." });
    }

    [HttpGet("shop-applications")]
    public async Task<IActionResult> GetShopApplications()
    {
        var apps = await _context.ShopApplications
            .Include(a => a.User)
            .Select(a => new
            {
                a.Id,
                a.UserId,
                a.ShopName,
                a.Description,
                a.CitizenId,
                a.FullName,
                a.Gender,
                a.DateOfBirth,
                a.Hometown,
                a.Occupation,
                a.Status,
                a.CreatedAt,
                UserName = a.User.FullName
            })
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(apps);
    }

    [HttpGet("shops")]
    public async Task<IActionResult> GetShops()
    {
        var shops = await _context.Shops
            .Include(s => s.User)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.Description,
                s.IsSuspended,
                s.CreatedAt,
                OwnerName = s.User.FullName,
                ProductCount = s.Products.Count
            })
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
        return Ok(shops);
    }

    [HttpPost("shops/{id}/suspend")]
    public async Task<IActionResult> SuspendShop(Guid id)
    {
        var shop = await _context.Shops.FindAsync(id);
        if (shop == null) return NotFound();

        shop.IsSuspended = true;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã đình chỉ cửa hàng." });
    }

    [HttpPost("shops/{id}/unsuspend")]
    public async Task<IActionResult> UnsuspendShop(Guid id)
    {
        var shop = await _context.Shops.FindAsync(id);
        if (shop == null) return NotFound();

        shop.IsSuspended = false;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã gỡ đình chỉ cửa hàng." });
    }

    [HttpPost("shop-applications/{id}/approve")]
    public async Task<IActionResult> ApproveShop(Guid id)
    {
        var app = await _context.ShopApplications.FindAsync(id);
        if (app == null) return NotFound();

        app.Status = ShopApplicationStatus.Approved;
        app.UpdatedAt = DateTime.UtcNow;

        // Create the official Shop
        var slug = app.ShopName.ToLower().Replace(" ", "-") + "-" + Guid.NewGuid().ToString().Substring(0, 8);
        var shop = new Shop
        {
            Id = Guid.NewGuid(),
            UserId = app.UserId,
            Name = app.ShopName,
            Slug = slug,
            Description = app.Description,
            CreatedAt = DateTime.UtcNow
        };

        _context.Shops.Add(shop);

        // Send Notification
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = app.UserId,
            ActorId = User.GetUserId() ?? Guid.Empty,
            Type = "System",
            Message = $"yêu cầu mở cửa hàng '{app.ShopName}' của bạn đã được phê duyệt!",
            CreatedAt = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã duyệt yêu cầu mở cửa hàng." });
    }

    [HttpPost("shop-applications/{id}/reject")]
    public async Task<IActionResult> RejectShop(Guid id, [FromBody] string note)
    {
        var app = await _context.ShopApplications.FindAsync(id);
        if (app == null) return NotFound();

        app.Status = ShopApplicationStatus.Rejected;
        app.AdminNote = note;
        app.UpdatedAt = DateTime.UtcNow;

        // Send Notification
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = app.UserId,
            ActorId = User.GetUserId() ?? Guid.Empty,
            Type = "System",
            Message = $"yêu cầu mở cửa hàng '{app.ShopName}' của bạn đã bị từ chối. Lý do: {note}",
            CreatedAt = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã từ chối yêu cầu mở cửa hàng." });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var cats = await _context.Categories
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Icon = c.Icon,
                ParentCategoryId = c.ParentCategoryId
            })
            .ToListAsync();
        return Ok(cats);
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] CategoryDto dto)
    {
        // Check for unique name
        var existing = await _context.Categories.AnyAsync(c => c.Name.ToLower() == dto.Name.ToLower().Trim());
        if (existing)
        {
            return BadRequest(new { message = "Tên danh mục này đã tồn tại. Vui lòng chọn tên khác." });
        }

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Slug = dto.Name.ToLower().Trim().Replace(" ", "-"),
            Icon = dto.Icon,
            ParentCategoryId = dto.ParentCategoryId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã thêm danh mục thành công.", id = category.Id });
    }

    [HttpPut("categories/{id}")]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] CategoryDto dto)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return NotFound();

        // Check for unique name (excluding self)
        var existing = await _context.Categories.AnyAsync(c => c.Id != id && c.Name.ToLower() == dto.Name.ToLower().Trim());
        if (existing)
        {
            return BadRequest(new { message = "Tên danh mục này đã tồn tại. Vui lòng chọn tên khác." });
        }

        category.Name = dto.Name;
        category.Slug = dto.Name.ToLower().Trim().Replace(" ", "-");
        category.Icon = dto.Icon;
        category.ParentCategoryId = dto.ParentCategoryId;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật danh mục thành công." });
    }

    [HttpDelete("categories/{id}")]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return NotFound();

        // Collect all descendant IDs using BFS
        var allIdsToDelete = new List<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(id);

        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            allIdsToDelete.Add(currentId);
            var children = await _context.Categories
                .Where(c => c.ParentCategoryId == currentId)
                .Select(c => c.Id)
                .ToListAsync();
            foreach (var childId in children)
                queue.Enqueue(childId);
        }

        // Block deletion if any category in the tree has products
        var hasProducts = await _context.Products
            .AnyAsync(p => allIdsToDelete.Contains(p.CategoryId));
        if (hasProducts)
        {
            return BadRequest(new { message = "Không thể xóa vì có sản phẩm thuộc danh mục này hoặc danh mục con. Hãy xóa sản phẩm trước." });
        }

        // Delete leaves first (reverse BFS order = leaves first)
        allIdsToDelete.Reverse();
        foreach (var catId in allIdsToDelete)
        {
            var cat = await _context.Categories.FindAsync(catId);
            if (cat != null) _context.Categories.Remove(cat);
        }

        var childrenCount = allIdsToDelete.Count - 1;
        await _context.SaveChangesAsync();
        return Ok(new
        {
            message = childrenCount > 0
                ? $"Đã xóa danh mục \"{category.Name}\" và {childrenCount} danh mục con."
                : $"Đã xóa danh mục \"{category.Name}\".",
            count = allIdsToDelete.Count
        });
    }
}
