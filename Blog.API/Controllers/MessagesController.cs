using Blog.API.Extensions;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Blog.Domain.Interfaces;
using Blog.Domain.Entities;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly Blog.Application.Services.IPushNotificationService _pushService;
    private readonly IFirebaseChatService _firebaseChatService;

    public MessagesController(AppDbContext context, 
                              Blog.Application.Services.IPushNotificationService pushService,
                              IFirebaseChatService firebaseChatService)
    {
        _context = context;
        _pushService = pushService;
        _firebaseChatService = firebaseChatService;
    }

    // ─── GET /api/messages/conversations ─────────────────────────────────────
    /// <summary>
    /// Danh sách cuộc hội thoại của user hiện tại (inbox).
    /// Trả về 2 nhóm: "accepted" (mutual follow hoặc người kia đã trả lời) và "pending" (tin nhắn chờ).
    /// </summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();
        var uid = userId.Value;

        var convs = await _context.Conversations
            .Where(c => c.User1Id == uid || c.User2Id == uid)
            .Include(c => c.User1)
            .Include(c => c.User2)
            .OrderByDescending(c => c.LastMessageAt)
            .ToListAsync();

        // Mutual follows của user hiện tại
        var myFollowingIds = await _context.Follows
            .Where(f => f.FollowerId == uid)
            .Select(f => f.FollowingId)
            .ToListAsync();
        var myFollowerIds = await _context.Follows
            .Where(f => f.FollowingId == uid)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var accepted = new List<object>();
        var pending = new List<object>();

        foreach (var c in convs)
        {
            var otherId = c.User1Id == uid ? c.User2Id : c.User1Id;
            var other = c.User1Id == uid ? c.User2 : c.User1;
            
            bool iFollowThem = myFollowingIds.Contains(otherId);
            bool isMutual = iFollowThem && myFollowerIds.Contains(otherId);

            // Fetch last message and unread count from Firebase
            var firebaseMessages = await _firebaseChatService.GetMessagesAsync(c.Id, 1);
            var lastMsg = firebaseMessages.FirstOrDefault();
            int unread = await _firebaseChatService.GetUnreadCountAsync(c.Id, uid);

            var dto = new
            {
                conversationId = c.Id,
                otherUser = new
                {
                    id = other.Id,
                    fullName = other.FullName,
                    username = other.Username,
                    avatarUrl = other.AvatarUrl
                },
                lastMessage = lastMsg == null ? null : new
                {
                    content = lastMsg.Content,
                    imageUrl = lastMsg.ImageUrl,
                    senderId = lastMsg.SenderId,
                    createdAt = lastMsg.CreatedAt,
                    isRead = lastMsg.IsRead
                },
                unreadCount = unread,
                isMutual
            };

            // Logic: Inbox (Accepted) nếu:
            // 1. Tôi đang theo dõi họ (đã fl hoặc đã bấm Accept)
            // 2. HOẶC tôi là người gửi tin nhắn cuối cùng (tôi chủ động nhắn)
            bool lastSenderIsMe = lastMsg != null && lastMsg.SenderId == uid;
            
            if (iFollowThem || lastSenderIsMe)
                accepted.Add(dto);
            else
                pending.Add(dto);
        }

        return Ok(new { accepted, pending });
    }

    // ─── GET /api/messages/conversations/{conversationId}/messages ───────────
    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<IActionResult> GetMessages(Guid conversationId, [FromQuery] DateTime? before = null)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var conv = await _context.Conversations.FindAsync(conversationId);
        if (conv == null) return NotFound();
        if (conv.User1Id != userId && conv.User2Id != userId) return Forbid();

        var messages = await _firebaseChatService.GetMessagesAsync(conversationId, 50, before);
        
        // Mark as read in Firebase
        await _firebaseChatService.MarkAsReadAsync(conversationId, userId.Value);

        // Populate Shared Post data if needed
        var sharedPostIds = messages.Where(m => m.SharedPostId.HasValue).Select(m => m.SharedPostId!.Value).ToList();
        var sharedPosts = await _context.Posts
            .Include(p => p.Author)
            .Include(p => p.Images)
            .Where(p => sharedPostIds.Contains(p.Id))
            .ToListAsync();

        var result = messages.Select(m => {
            var post = m.SharedPostId.HasValue ? sharedPosts.FirstOrDefault(p => p.Id == m.SharedPostId.Value) : null;
            return new {
                m.Id,
                m.SenderId,
                m.Content,
                m.ImageUrl,
                m.IsRead,
                m.IsRequestMessage,
                m.CreatedAt,
                m.IsHearted,
                m.ReplyToMessageId,
                SharedPostId = m.SharedPostId,
                SharedPost = post == null ? null : new {
                    post.Id,
                    post.Content,
                    AuthorName = post.Author.FullName,
                    AuthorAvatar = post.Author.AvatarUrl,
                    FirstImage = post.Images.FirstOrDefault()?.Url
                }
            };
        });

        return Ok(result);
    }

    // ─── POST /api/messages/conversations/{userId}/start ────────────────────
    /// <summary>
    /// Tạo hoặc lấy conversation với một user cụ thể.
    /// </summary>
    [HttpPost("conversations/{targetUserId}/start")]
    public async Task<IActionResult> StartConversation(Guid targetUserId)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();
        var uid = userId.Value;

        if (uid == targetUserId) return BadRequest(new { message = "Không thể nhắn tin với chính mình." });

        var target = await _context.Users.FindAsync(targetUserId);
        if (target == null) return NotFound(new { message = "Người dùng không tồn tại." });

        var u1 = uid < targetUserId ? uid : targetUserId;
        var u2 = uid < targetUserId ? targetUserId : uid;

        var conv = await _context.Conversations
            .FirstOrDefaultAsync(c => c.User1Id == u1 && c.User2Id == u2);

        if (conv == null)
        {
            conv = new Blog.Domain.Entities.Conversation
            {
                Id = Guid.NewGuid(),
                User1Id = u1,
                User2Id = u2,
                CreatedAt = DateTime.UtcNow,
                LastMessageAt = DateTime.UtcNow
            };
            _context.Conversations.Add(conv);
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            conversationId = conv.Id,
            otherUser = new
            {
                id = target.Id,
                fullName = target.FullName,
                username = target.Username,
                avatarUrl = target.AvatarUrl
            }
        });
    }

    // ─── POST /api/messages/send ───────────────────────────────────────────
    public class SendMessageDto
    {
        public Guid RecipientId { get; set; }
        public string? Content { get; set; }
        public string? ImageUrl { get; set; }
        public Guid? ReplyToMessageId { get; set; }
        public Guid? SharedPostId { get; set; }
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendMessageRest([FromBody] SendMessageDto dto)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();
        var uid = userId.Value;

        if (uid == dto.RecipientId) return BadRequest("Không thể nhắn tin với chính mình.");

        bool isBlocked = await _context.Blocks.AnyAsync(b => 
            (b.BlockerId == uid && b.BlockedId == dto.RecipientId) || 
            (b.BlockerId == dto.RecipientId && b.BlockedId == uid));
        if (isBlocked) return BadRequest("Không thể gửi tin nhắn vì người dùng đã bị chặn.");

        bool isRequest = !await _context.Follows.AnyAsync(f => f.FollowerId == dto.RecipientId && f.FollowingId == uid);

        var u1 = uid < dto.RecipientId ? uid : dto.RecipientId;
        var u2 = uid < dto.RecipientId ? dto.RecipientId : uid;

        var conv = await _context.Conversations.FirstOrDefaultAsync(c => c.User1Id == u1 && c.User2Id == u2);
        if (conv == null)
        {
            conv = new Blog.Domain.Entities.Conversation
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

        var message = new Blog.Domain.Entities.Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conv.Id,
            SenderId = uid,
            Content = dto.Content?.Trim() ?? "",
            ImageUrl = dto.ImageUrl,
            IsRead = false,
            IsRequestMessage = isRequest,
            ReplyToMessageId = dto.ReplyToMessageId,
            SharedPostId = dto.SharedPostId,
            CreatedAt = DateTime.UtcNow
        };
        
        // Save to Firebase instead of PostgreSQL
        await _firebaseChatService.SaveMessageAsync(message);
        await _context.SaveChangesAsync();

        // Send Push Notification
        try
        {
            var sender = await _context.Users.FindAsync(uid);
            await _pushService.SendPushNotificationAsync(
                dto.RecipientId,
                $"Tin nhắn mới từ {sender?.FullName ?? "Ai đó"}",
                message.Content ?? "Đã gửi một tin nhắn mới",
                "/messages.html"
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Push Notification failed: {ex.Message}");
        }

        return Ok(new { success = true, messageId = message.Id });
    }

    // ─── GET /api/messages/unread-count ─────────────────────────────────────
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();
        var uid = userId.Value;

        // Count unread in accepted conversations only (not pending from strangers)
        var myFollowingIds = await _context.Follows
            .Where(f => f.FollowerId == uid)
            .Select(f => f.FollowingId)
            .ToListAsync();
        var myFollowerIds = await _context.Follows
            .Where(f => f.FollowingId == uid)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var conversations = await _context.Conversations
            .Where(c => c.User1Id == uid || c.User2Id == uid)
            .ToListAsync();

        int count = 0;
        int pendingCount = 0;
        foreach (var c in conversations)
        {
            var otherId = c.User1Id == uid ? c.User2Id : c.User1Id;
            bool isMutual = myFollowingIds.Contains(otherId) && myFollowerIds.Contains(otherId);
            
            int unread = await _firebaseChatService.GetUnreadCountAsync(c.Id, uid);
            
            if (isMutual) count += unread;
            else pendingCount += unread;
        }

        return Ok(new { count, pendingCount, total = count + pendingCount });
    }

    // ─── POST /api/messages/{messageId}/heart ──────────────────────────────────
    [HttpPost("{messageId}/heart")]
    public async Task<IActionResult> ToggleHeart(Guid messageId)
    {
        // Optional: check if user is part of the conversation
        var conv = await _context.Conversations.FindAsync(messageId); // Wait, this logic needs change as messageId is not in DB
        // Let's assume we fetch the message from Firebase first to get conversationId
        // For simplicity, we just need messageId and we know it's in Firestore
        
        // However, we need conversationId to update in Firestore efficiently
        // If we don't have it, we might need a different schema or store convId in client
        // In current implementation, I'll keep it simple:
        
        // await _firebaseChatService.UpdateMessageHeartAsync(convId, messageId, true);
        // But we don't have convId easily here without querying DB or Firebase.
        
        // For now, let's just say we need to pass conversationId from frontend too.
        return BadRequest("Vui lòng cung cấp ConversationId để thả tim.");
    }

    [HttpPost("conversations/{conversationId}/messages/{messageId}/heart")]
    public async Task<IActionResult> ToggleHeartFirebase(Guid conversationId, Guid messageId, [FromQuery] bool isHearted)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        await _firebaseChatService.UpdateMessageHeartAsync(conversationId, messageId, isHearted);
        return Ok(new { messageId, isHearted });
    }

    // ─── POST /api/messages/block/{targetUserId} ───────────────────────────────
    [HttpPost("block/{targetUserId}")]
    public async Task<IActionResult> ToggleBlock(Guid targetUserId)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();
        if (userId == targetUserId) return BadRequest("Không thể tự chặn chính mình.");

        var block = await _context.Blocks.FirstOrDefaultAsync(b => b.BlockerId == userId && b.BlockedId == targetUserId);
        
        if (block != null)
        {
            // Unblock
            _context.Blocks.Remove(block);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã bỏ chặn người dùng.", isBlocked = false });
        }
        else
        {
            // Block
            _context.Blocks.Add(new Blog.Domain.Entities.Block
            {
                BlockerId = userId.Value,
                BlockedId = targetUserId,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã chặn người dùng.", isBlocked = true });
        }
    }
}
