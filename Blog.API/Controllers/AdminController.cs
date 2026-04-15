using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Blog.Application.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.Email,
                u.FullName,
                u.Role,
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
            .Select(r => new
            {
                r.Id,
                r.PostId,
                r.Reason,
                r.CreatedAt,
                r.IsResolved,
                ReporterName = r.Reporter.FullName,
                PostTitle = r.Post.Title,
                PostContent = r.Post.Content,
                PostImageUrl = r.Post.FeaturedImageUrl,
                PostAuthorName = r.Post.Author.FullName,
                PostAuthorId = r.Post.AuthorId
            })
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();
        return Ok(reports);
    }

    [HttpDelete("posts/{id}")]
    public async Task<IActionResult> DeletePost(Guid id)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();

        var adminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Send notification to author before deleting
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = post.AuthorId,
            ActorId = adminId,
            Type = "System",
            Message = "bài viết của bạn đã vi phạm quy tắt cộng đồng",
            CreatedAt = DateTime.UtcNow,
            TargetId = null // Target is deleted so set to null
        };
        _context.Notifications.Add(notification);

        // Cascade delete will handle related entities
        _context.Posts.Remove(post);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xóa bài viết và gửi cảnh báo đến người dùng." });
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.Role == "Admin") return BadRequest(new { message = "Không thể xóa tài khoản Admin." });

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xóa tài khoản người dùng vĩnh viễn." });
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
                a.Status,
                a.CreatedAt,
                UserName = a.User.FullName
            })
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(apps);
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
            ActorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
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
            ActorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
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
