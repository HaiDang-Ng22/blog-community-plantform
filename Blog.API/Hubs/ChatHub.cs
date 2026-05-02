using Blog.Infrastructure.Data;
using Blog.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;

namespace Blog.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly AppDbContext _context;
    // Map userId -> connectionId (in-memory, single server; replace with IUserIdProvider for production)
    private static readonly Dictionary<string, string> _connections = new();

    public ChatHub(AppDbContext context)
    {
        _context = context;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.GetUserIdStr();
        if (!string.IsNullOrEmpty(userId))
        {
            lock (_connections)
            {
                _connections[userId] = Context.ConnectionId;
            }
            // Join a personal group so server can push to specific user
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.GetUserIdStr();
        if (!string.IsNullOrEmpty(userId))
        {
            lock (_connections)
            {
                _connections.Remove(userId);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Client gọi để gửi tin nhắn. Server lưu DB rồi push realtime cho cả hai.
    /// </summary>
    public async Task SendMessage(string recipientId, string? content, string? imageUrl = null)
    {
        var senderIdStr = Context.User?.GetUserIdStr();
        if (string.IsNullOrEmpty(senderIdStr) || (string.IsNullOrEmpty(content?.Trim()) && string.IsNullOrEmpty(imageUrl)))
            return;
 
        var senderId = Guid.Parse(senderIdStr);
        var recipientGuid = Guid.Parse(recipientId);
 
        if (senderId == recipientGuid) return;
 
        // Logic mới: Tin nhắn là "Request" chỉ khi Người nhận CHƯA follow Người gửi.
        // Nếu người nhận đã follow người gửi → Họ đã chấp nhận liên lạc này.
        bool recipientFollowsSender = await _context.Follows
            .AnyAsync(f => f.FollowerId == recipientGuid && f.FollowingId == senderId);
        
        bool isRequest = !recipientFollowsSender;
 
        // Tìm hoặc tạo conversation (canonical: user1 < user2)
        var u1 = senderId < recipientGuid ? senderId : recipientGuid;
        var u2 = senderId < recipientGuid ? recipientGuid : senderId;
 
        var conv = await _context.Conversations
            .FirstOrDefaultAsync(c => c.User1Id == u1 && c.User2Id == u2);
 
        if (conv == null)
        {
            conv = new Conversation
            {
                Id = Guid.NewGuid(),
                User1Id = u1,
                User2Id = u2,
                CreatedAt = DateTime.UtcNow,
                LastMessageAt = DateTime.UtcNow
            };
            _context.Conversations.Add(conv);
        }
        else
        {
            conv.LastMessageAt = DateTime.UtcNow;
        }
 
        var message = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conv.Id,
            SenderId = senderId,
            Content = content?.Trim() ?? "",
            ImageUrl = imageUrl,
            IsRead = false,
            IsRequestMessage = isRequest, 
            CreatedAt = DateTime.UtcNow
        };
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();
 
        // Load sender info
        var sender = await _context.Users
            .Select(u => new { u.Id, u.FullName, u.Username, u.AvatarUrl })
            .FirstOrDefaultAsync(u => u.Id == senderId);
 
        var payload = new
        {
            id = message.Id,
            conversationId = conv.Id,
            senderId = senderId,
            recipientId = recipientGuid,
            content = message.Content,
            imageUrl = message.ImageUrl,
            isRead = message.IsRead,
            isRequestMessage = message.IsRequestMessage,
            createdAt = message.CreatedAt,
            senderName = sender?.FullName ?? sender?.Username ?? "User",
            senderAvatar = sender?.AvatarUrl
        };
 
        // Push to sender
        await Clients.Group($"user_{senderIdStr}").SendAsync("ReceiveMessage", payload);
 
        // Push to recipient (nếu online)
        if (isRequest)
        {
            await Clients.Group($"user_{recipientId}").SendAsync("MessageRequest", payload);
        }
        else
        {
            await Clients.Group($"user_{recipientId}").SendAsync("ReceiveMessage", payload);
        }
    }

    /// <summary>
    /// Đánh dấu đã đọc tất cả tin nhắn trong conversation
    /// </summary>
    public async Task MarkRead(string conversationId)
    {
        var userIdStr = Context.User?.GetUserIdStr();
        if (string.IsNullOrEmpty(userIdStr)) return;

        var userId = Guid.Parse(userIdStr);
        var convId = Guid.Parse(conversationId);

        var unread = await _context.Messages
            .Where(m => m.ConversationId == convId && m.SenderId != userId && !m.IsRead)
            .ToListAsync();

        foreach (var m in unread) m.IsRead = true;
        await _context.SaveChangesAsync();
    }
}
