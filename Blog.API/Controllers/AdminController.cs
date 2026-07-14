using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Blog.Application.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Extensions;
using Blog.API.Services;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notificationService;

    public AdminController(AppDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
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

        var totalPlatformFee = await _context.Orders
            .Where(o => o.Status == OrderStatus.Completed)
            .SumAsync(o => o.PlatformFeeAmount);

        return Ok(new
        {
            totalUsers,
            activeShops,
            dailyOrders,
            pendingReports,
            pendingShops,
            topShops,
            dailyStats,
            totalPlatformFee
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
                .ThenInclude(p => p!.Author)
            .Include(r => r.Post)
                .ThenInclude(p => p!.Images)
            .Include(r => r.Group)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var result = reports.Select(r => new
        {
            r.Id,
            r.PostId,
            r.GroupId,
            TargetType = r.TargetType.ToString(),
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
            PostAuthorIsPrivate = r.Post != null && r.Post.Author.IsPrivate,
            GroupName = r.Group != null ? r.Group.Name : null,
            GroupDescription = r.Group != null ? r.Group.Description : null
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
            // Thông báo cho tác giả (Real-time)
            await _notificationService.SendNotificationAsync(
                post.AuthorId,
                adminId,
                "System",
                post.Id,
                $"Bài viết '{post.Title}' của bạn đã bị xóa do vi phạm quy tắc cộng đồng."
            );

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

        // Notify the reporter
        var adminId = User.GetUserId() ?? Guid.Empty;
        await _notificationService.SendNotificationAsync(
            report.ReporterId,
            adminId,
            "System",
            report.PostId,
            "Báo cáo của bạn về một bài viết đã được xử lý. Cảm ơn bạn đã góp ý!"
        );

        return Ok(new { message = "Đã đánh dấu báo cáo là đã xử lý và thông báo cho người gửi." });
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

        // Notify Shop Owner
        var adminId = User.GetUserId() ?? Guid.Empty;
        await _notificationService.SendNotificationAsync(
            shop.UserId,
            adminId,
            "System",
            shop.Id,
            $"Cửa hàng '{shop.Name}' của bạn đã bị tạm đình chỉ do vi phạm chính sách."
        );

        return Ok(new { message = "Đã đình chỉ cửa hàng và thông báo cho chủ shop." });
    }

    [HttpPost("shops/{id}/unsuspend")]
    public async Task<IActionResult> UnsuspendShop(Guid id)
    {
        var shop = await _context.Shops.FindAsync(id);
        if (shop == null) return NotFound();

        shop.IsSuspended = false;
        await _context.SaveChangesAsync();

        // Notify Shop Owner
        var adminId = User.GetUserId() ?? Guid.Empty;
        await _notificationService.SendNotificationAsync(
            shop.UserId,
            adminId,
            "System",
            shop.Id,
            $"Cửa hàng '{shop.Name}' của bạn đã được gỡ bỏ lệnh đình chỉ. Bạn có thể tiếp tục kinh doanh."
        );

        return Ok(new { message = "Đã gỡ đình chỉ cửa hàng và thông báo cho chủ shop." });
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
        await _context.SaveChangesAsync();

        // Send Notification (Real-time)
        await _notificationService.SendNotificationAsync(
            app.UserId,
            User.GetUserId() ?? Guid.Empty,
            "System",
            shop.Id,
            $"yêu cầu mở cửa hàng '{app.ShopName}' của bạn đã được phê duyệt!"
        );

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

        await _context.SaveChangesAsync();

        // Send Notification (Real-time)
        await _notificationService.SendNotificationAsync(
            app.UserId,
            User.GetUserId() ?? Guid.Empty,
            "System",
            app.Id,
            $"yêu cầu mở cửa hàng '{app.ShopName}' của bạn đã bị từ chối. Lý do: {note}"
        );

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

    // ─── Verification (Tích xanh) ─────────────────────────────────────────

    [HttpGet("verifications")]
    public async Task<IActionResult> GetVerifications()
    {
        var list = await _context.VerificationRequests
            .Include(v => v.User)
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new
            {
                v.Id,
                v.UserId,
                Username = v.User.Username,
                FullName = v.FullName,
                DocumentType = v.DocumentType,
                DocumentUrl = v.DocumentUrl,
                v.Status,
                v.CreatedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost("verifications/{id}/approve")]
    public async Task<IActionResult> ApproveVerification(Guid id)
    {
        var req = await _context.VerificationRequests
            .Include(v => v.User)
            .FirstOrDefaultAsync(v => v.Id == id);
        if (req == null) return NotFound();

        req.Status = "Approved";

        // Cấp tích xanh cho user
        var user = await _context.Users.FindAsync(req.UserId);
        if (user != null) user.IsVerified = true;

        await _context.SaveChangesAsync();

        // Gửi thông báo cho user (Real-time)
        await _notificationService.SendNotificationAsync(
            req.UserId,
            User.GetUserId() ?? Guid.Empty,
            "System",
            req.Id,
            "Chúc mừng! Yêu cầu xác minh danh tính của bạn đã được phê duyệt. Tài khoản của bạn đã được cấp tích xanh ✅."
        );

        return Ok(new { message = "Đã duyệt và cấp tích xanh cho người dùng." });
    }

    [HttpPost("verifications/{id}/reject")]
    public async Task<IActionResult> RejectVerification(Guid id)
    {
        var req = await _context.VerificationRequests
            .FirstOrDefaultAsync(v => v.Id == id);
        if (req == null) return NotFound();

        req.Status = "Rejected";

        await _context.SaveChangesAsync();

        // Gửi thông báo cho user (Real-time)
        await _notificationService.SendNotificationAsync(
            req.UserId,
            User.GetUserId() ?? Guid.Empty,
            "System",
            req.Id,
            "Yêu cầu xác minh danh tính của bạn đã bị từ chối. Vui lòng kiểm tra lại thông tin và thử lại."
        );

        return Ok(new { message = "Đã từ chối yêu cầu xác minh." });
    }

    [HttpGet("verifications/pending-count")]
    public async Task<IActionResult> GetPendingVerificationsCount()
    {
        var count = await _context.VerificationRequests
            .CountAsync(v => v.Status == "Pending");
        return Ok(new { count });
    }

    // ─── Banned Words Management ─────────────────────────────────────────

    [HttpGet("banned-words")]
    public async Task<IActionResult> GetBannedWords()
    {
        var words = await _context.BannedWords.OrderByDescending(b => b.CreatedAt).ToListAsync();
        return Ok(words);
    }

    public class BannedWordDto { public string Word { get; set; } = string.Empty; }

    [HttpPost("banned-words")]
    public async Task<IActionResult> AddBannedWord([FromBody] BannedWordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Word))
            return BadRequest(new { message = "Từ khóa không hợp lệ." });

        var wordLower = dto.Word.ToLower().Trim();
        var exists = await _context.BannedWords.AnyAsync(b => b.Word.ToLower() == wordLower);
        if (exists)
            return BadRequest(new { message = "Từ này đã có trong danh sách." });

        var bannedWord = new BannedWord
        {
            Word = dto.Word.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.BannedWords.Add(bannedWord);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Thêm từ khóa thành công.", data = bannedWord });
    }

    [HttpDelete("banned-words/{id}")]
    public async Task<IActionResult> DeleteBannedWord(int id)
    {
        var word = await _context.BannedWords.FindAsync(id);
        if (word == null) return NotFound();

        _context.BannedWords.Remove(word);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa tất cả từ khóa nhạy cảm." });
    }

    // ─── Banner Management ─────────────────────────────────────────

    [HttpGet("banners")]
    public async Task<IActionResult> GetAdminBanners()
    {
        var banners = await _context.Banners
            .OrderBy(b => b.DisplayOrder)
            .ThenByDescending(b => b.CreatedAt)
            .ToListAsync();
        return Ok(banners);
    }

    [HttpGet("banners/{id}")]
    public async Task<IActionResult> GetBannerById(Guid id)
    {
        var banner = await _context.Banners.FindAsync(id);
        if (banner == null) return NotFound();
        return Ok(banner);
    }

    [HttpPost("banners")]
    public async Task<IActionResult> CreateBanner([FromBody] Banner banner)
    {
        banner.Id = Guid.NewGuid();
        banner.CreatedAt = DateTime.UtcNow;
        _context.Banners.Add(banner);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã thêm banner thành công.", id = banner.Id });
    }

    [HttpPut("banners/{id}")]
    public async Task<IActionResult> UpdateBanner(Guid id, [FromBody] Banner bannerData)
    {
        var banner = await _context.Banners.FindAsync(id);
        if (banner == null) return NotFound();

        banner.ImageUrl = bannerData.ImageUrl;
        banner.LinkUrl = bannerData.LinkUrl;
        banner.IsMain = bannerData.IsMain;
        banner.DisplayOrder = bannerData.DisplayOrder;
        banner.IsActive = bannerData.IsActive;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật banner thành công." });
    }

    [HttpDelete("banners/{id}")]
    public async Task<IActionResult> DeleteBanner(Guid id)
    {
        var banner = await _context.Banners.FindAsync(id);
        if (banner == null) return NotFound();

        _context.Banners.Remove(banner);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa banner thành công." });
    }

    [HttpPost("banned-words/scan")]
    public async Task<IActionResult> ScanAndRemoveBadPosts()
    {
        var bannedWords = await _context.BannedWords.Select(b => b.Word.ToLower()).ToListAsync();
        if (!bannedWords.Any())
            return Ok(new { message = "Không có từ cấm nào để quét." });

        var posts = await _context.Posts
            .Include(p => p.Images)
            .Include(p => p.Comments)
            .Include(p => p.PostLikes)
            .ToListAsync();

        int removedCount = 0;
        var adminId = User.GetUserId() ?? Guid.Empty;

        foreach (var post in posts)
        {
            var contentToCheck = $"{post.Title} {post.Summary} {post.Content}".ToLower();
            bool containsBadWord = false;

            foreach (var word in bannedWords)
            {
                if (!string.IsNullOrWhiteSpace(word) && contentToCheck.Contains(word))
                {
                    containsBadWord = true;
                    break;
                }
            }

            if (containsBadWord)
            {
                // Send notification
                if (adminId != Guid.Empty)
                {
                    await _notificationService.SendNotificationAsync(
                        post.AuthorId,
                        adminId,
                        "System",
                        post.Id,
                        $"Bài viết '{post.Title}' của bạn đã bị hệ thống xóa tự động do chứa ngôn từ không phù hợp."
                    );
                }

                // Delete related data
                var relatedReports = await _context.Reports.Where(r => r.PostId == post.Id).ToListAsync();
                foreach (var r in relatedReports) r.IsResolved = true;

                _context.PostImages.RemoveRange(post.Images);
                _context.Comments.RemoveRange(post.Comments);
                _context.PostLikes.RemoveRange(post.PostLikes);
                
                _context.Posts.Remove(post);
                removedCount++;
            }
        }

        if (removedCount > 0)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(new { message = $"Đã quét xong. Xóa thành công {removedCount} bài viết vi phạm." });
    }

    // --- Voucher Management ---

    [HttpGet("vouchers")]
    public async Task<IActionResult> GetAdminVouchers()
    {
        var vouchers = await _context.Vouchers
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();
        return Ok(vouchers);
    }

    [HttpPost("vouchers")]
    public async Task<IActionResult> CreateAdminVoucher([FromBody] CreateVoucherDto dto)
    {
        var voucher = new Voucher
        {
            Id = Guid.NewGuid(),
            Code = dto.Code.ToUpper(),
            Description = dto.Description,
            DiscountType = Enum.Parse<DiscountType>(dto.DiscountType),
            DiscountValue = dto.DiscountValue,
            MinOrderValue = dto.MinOrderValue,
            MaxDiscountAmount = dto.MaxDiscountAmount,
            StartDate = dto.StartDate.Kind == DateTimeKind.Utc ? dto.StartDate : dto.StartDate.ToUniversalTime(),
            EndDate = dto.EndDate.Kind == DateTimeKind.Utc ? dto.EndDate : dto.EndDate.ToUniversalTime(),
            UsageLimit = dto.UsageLimit,
            IsPublic = dto.IsPublic,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Vouchers.Add(voucher);
        await _context.SaveChangesAsync();
        return Ok(voucher);
    }

    [HttpPut("vouchers/{id}")]
    public async Task<IActionResult> UpdateAdminVoucher(Guid id, [FromBody] CreateVoucherDto dto)
    {
        var voucher = await _context.Vouchers.FindAsync(id);
        if (voucher == null) return NotFound();

        voucher.Code = dto.Code.ToUpper();
        voucher.Description = dto.Description;
        voucher.DiscountType = Enum.Parse<DiscountType>(dto.DiscountType);
        voucher.DiscountValue = dto.DiscountValue;
        voucher.MinOrderValue = dto.MinOrderValue;
        voucher.MaxDiscountAmount = dto.MaxDiscountAmount;
        voucher.StartDate = dto.StartDate.Kind == DateTimeKind.Utc ? dto.StartDate : dto.StartDate.ToUniversalTime();
        voucher.EndDate = dto.EndDate.Kind == DateTimeKind.Utc ? dto.EndDate : dto.EndDate.ToUniversalTime();
        voucher.UsageLimit = dto.UsageLimit;
        voucher.IsPublic = dto.IsPublic;

        await _context.SaveChangesAsync();
        return Ok(voucher);
    }

    [HttpDelete("vouchers/{id}")]
    public async Task<IActionResult> DeleteAdminVoucher(Guid id)
    {
        var voucher = await _context.Vouchers.FindAsync(id);
        if (voucher == null) return NotFound();

        _context.Vouchers.Remove(voucher);
        await _context.SaveChangesAsync();
        return Ok();
    }
    [HttpDelete("groups/{id}")]
    public async Task<IActionResult> DeleteGroupAdmin(Guid id)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .Include(g => g.Posts)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null) return NotFound();

        // 1. Remove all members
        _context.GroupMembers.RemoveRange(group.Members);

        // 2. Remove all reports related to this group
        var reports = await _context.Reports.Where(r => r.GroupId == id).ToListAsync();
        _context.Reports.RemoveRange(reports);

        // 3. (Optional) Remove posts in group or set GroupId to null
        // Let's remove them since they belong to the group
        _context.Posts.RemoveRange(group.Posts);

        // 4. Remove group
        _context.Groups.Remove(group);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xóa Group thành công." });
    }
}
