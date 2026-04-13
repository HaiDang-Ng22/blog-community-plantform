using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
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
}
