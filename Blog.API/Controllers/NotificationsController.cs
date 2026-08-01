using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Extensions;
using Blog.API.Services;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notiService;

    public NotificationsController(AppDbContext context, INotificationService notiService)
    {
        _context = context;
        _notiService = notiService;
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        var count = await _notiService.GetUnreadCountAsync(userId);
        return Ok(new { count });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyNotifications([FromQuery] int? skip = null, [FromQuery] int? take = null)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        const int maxStoredNotifications = 30;
        var query = _context.Notifications
            .Include(n => n.Actor)
            .Where(n => n.ReceiverId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.Id);

        var totalCount = Math.Min(await query.CountAsync(), maxStoredNotifications);
        var safeSkip = Math.Clamp(skip ?? 0, 0, maxStoredNotifications);
        var safeTake = take.HasValue ? Math.Clamp(take.Value, 1, 7) : maxStoredNotifications;
        var notifications = await query
            .Skip(safeSkip)
            .Take(Math.Min(safeTake, maxStoredNotifications - safeSkip))
            .ToListAsync();

        var result = notifications.Select(n => new
        {
            n.Id,
            n.ActorId,
            n.Type,
            n.TargetId,
            n.Message,
            n.IsRead,
            n.CreatedAt,
            ActorName = n.Actor.FullName,
            ActorAvatarUrl = n.Actor.AvatarUrl
        }).ToList();

        if (!take.HasValue) return Ok(result);

        var unreadQuery = _context.Notifications
            .Where(notification => notification.ReceiverId == userId && !notification.IsRead);
        var socialTypes = new[] { "Like", "Comment", "Reply", "Follow", "LikeStory" };
        var orderTypes = new[] { "NewOrder", "OrderStatusUpdated", "OrderCancelled", "PaymentVerificationRequested", "PaymentConfirmed", "OrderPaid" };

        return Ok(new
        {
            items = result,
            totalCount,
            hasMore = safeSkip + result.Count < totalCount,
            unreadCount = await unreadQuery.CountAsync(),
            unreadSocialCount = await unreadQuery.CountAsync(notification => socialTypes.Contains(notification.Type)),
            unreadOrderCount = await unreadQuery.CountAsync(notification => orderTypes.Contains(notification.Type)),
            unreadSystemCount = await unreadQuery.CountAsync(notification => notification.Type == "System")
        });
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.ReceiverId == userId);

        if (notification == null) return NotFound();

        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        var notifications = await _context.Notifications
            .Where(n => n.ReceiverId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var n in notifications) n.IsRead = true;
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.ReceiverId == userId);

        if (notification == null) return NotFound();

        _context.Notifications.Remove(notification);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa thông báo" });
    }
}
