using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Blog.API.Hubs;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Services;

public interface INotificationService
{
    Task SendNotificationAsync(Guid receiverId, Guid actorId, string type, Guid? targetId, string message);
    Task<int> GetUnreadCountAsync(Guid userId);
}

public class NotificationService : INotificationService
{
    private readonly AppDbContext _context;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly Blog.Application.Services.IPushNotificationService _pushService;

    public NotificationService(AppDbContext context, IHubContext<NotificationHub> hubContext, Blog.Application.Services.IPushNotificationService pushService)
    {
        _context = context;
        _hubContext = hubContext;
        _pushService = pushService;
    }

    public async Task SendNotificationAsync(Guid receiverId, Guid actorId, string type, Guid? targetId, string message)
    {
        if (receiverId == actorId) return; // Don't notify yourself

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = receiverId,
            ActorId = actorId,
            Type = type,
            TargetId = targetId,
            Message = message,
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Get actor info for realtime toast
        var actor = await _context.Users.FindAsync(actorId);

        // Notify via SignalR
        await _hubContext.Clients.Group(receiverId.ToString()).SendAsync("ReceiveNotification", new
        {
            notification.Id,
            notification.Type,
            notification.TargetId,
            notification.Message,
            notification.CreatedAt,
            ActorName = actor?.FullName ?? "Ai đó",
            ActorAvatarUrl = actor?.AvatarUrl,
            UnreadCount = await GetUnreadCountAsync(receiverId)
        });

        // Send Web Push
        try
        {
            await _pushService.SendPushNotificationAsync(
                receiverId, 
                "Thông báo mới từ Zynk", 
                message, 
                "/notifications.html"
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Push Notification failed: {ex.Message}");
        }
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _context.Notifications.CountAsync(n => n.ReceiverId == userId && !n.IsRead);
    }
}
