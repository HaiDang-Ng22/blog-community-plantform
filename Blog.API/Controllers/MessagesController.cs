using Blog.API.Extensions;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _context;

    public MessagesController(AppDbContext context)
    {
        _context = context;
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
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
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

            var lastMsg = c.Messages.FirstOrDefault();
            int unread = await _context.Messages
                .CountAsync(m => m.ConversationId == c.Id && m.SenderId != uid && !m.IsRead);

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
    public async Task<IActionResult> GetMessages(Guid conversationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 30)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var conv = await _context.Conversations.FindAsync(conversationId);
        if (conv == null) return NotFound();
        if (conv.User1Id != userId && conv.User2Id != userId) return Forbid();

        var messages = await _context.Messages
            .Where(m => m.ConversationId == conversationId)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                m.Id,
                m.SenderId,
                m.Content,
                m.ImageUrl,
                m.IsRead,
                m.IsRequestMessage,
                m.CreatedAt,
                m.IsHearted,
                m.ReplyToMessageId,
                ReplyToMessage = m.ReplyToMessage == null ? null : new {
                    m.ReplyToMessage.Id,
                    m.ReplyToMessage.Content,
                    m.ReplyToMessage.SenderId
                },
                m.SharedPostId,
                SharedPost = m.SharedPost == null ? null : new {
                    m.SharedPost.Id,
                    m.SharedPost.Content,
                    AuthorName = m.SharedPost.Author.FullName,
                    AuthorAvatar = m.SharedPost.Author.AvatarUrl,
                    FirstImage = m.SharedPost.Images.FirstOrDefault().Url
                }
            })
            .ToListAsync();

        // Mark as read
        var unread = await _context.Messages
            .Where(m => m.ConversationId == conversationId && m.SenderId != userId && !m.IsRead)
            .ToListAsync();
        foreach (var m in unread) m.IsRead = true;
        if (unread.Any()) await _context.SaveChangesAsync();

        return Ok(messages.OrderBy(m => m.CreatedAt));
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
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

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
            var unread = await _context.Messages
                .CountAsync(m => m.ConversationId == c.Id && m.SenderId != uid && !m.IsRead);
            if (isMutual) count += unread;
            else pendingCount += unread;
        }

        return Ok(new { count, pendingCount, total = count + pendingCount });
    }

    // ─── POST /api/messages/{messageId}/heart ──────────────────────────────────
    [HttpPost("{messageId}/heart")]
    public async Task<IActionResult> ToggleHeart(Guid messageId)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var message = await _context.Messages.FindAsync(messageId);
        if (message == null) return NotFound();

        // Optional: check if user is part of the conversation
        var conv = await _context.Conversations.FindAsync(message.ConversationId);
        if (conv == null || (conv.User1Id != userId && conv.User2Id != userId)) return Forbid();

        message.IsHearted = !message.IsHearted;
        await _context.SaveChangesAsync();

        return Ok(new { messageId = message.Id, isHearted = message.IsHearted });
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
