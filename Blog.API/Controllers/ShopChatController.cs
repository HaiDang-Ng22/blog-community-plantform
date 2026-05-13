using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShopChatController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IShopRepository _shopRepository;

    public ShopChatController(AppDbContext context, IShopRepository shopRepository)
    {
        _context = context;
        _shopRepository = shopRepository;
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var shop = await _shopRepository.GetByUserIdAsync(userId);

        // Fetch conversations where user is buyer OR owner of the shop
        var conversations = await _context.ShopConversations
            .Include(c => c.Buyer)
            .Include(c => c.Shop)
            .Where(c => c.BuyerId == userId || (shop != null && c.ShopId == shop.Id))
            .OrderByDescending(c => c.LastMessageAt)
            .Select(c => new ShopConversationDto
            {
                Id = c.Id,
                BuyerId = c.BuyerId,
                BuyerName = c.Buyer.FullName ?? c.Buyer.Username,
                BuyerAvatar = c.Buyer.AvatarUrl,
                ShopId = c.ShopId,
                ShopName = c.Shop.Name,
                ShopLogo = c.Shop.LogoUrl,
                LastMessageAt = c.LastMessageAt,
                LastMessage = _context.ShopMessages
                    .Where(m => m.ConversationId == c.Id)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Content)
                    .FirstOrDefault() ?? "",
                UnreadCount = _context.ShopMessages
                    .Count(m => m.ConversationId == c.Id && !m.IsRead && m.SenderId != userId)
            })
            .ToListAsync();

        return Ok(conversations);
    }

    [HttpGet("messages/{conversationId}")]
    public async Task<IActionResult> GetMessages(Guid conversationId)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var conversation = await _context.ShopConversations.FindAsync(conversationId);
        if (conversation == null) return NotFound();

        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (conversation.BuyerId != userId && (shop == null || conversation.ShopId != shop.Id))
            return Forbid();

        var messages = await _context.ShopMessages
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ShopMessageDto
            {
                Id = m.Id,
                ConversationId = m.ConversationId,
                SenderId = m.SenderId,
                Content = m.Content,
                ImageUrl = m.ImageUrl,
                IsMe = m.SenderId == userId,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync();

        // Mark as read
        var unread = await _context.ShopMessages
            .Where(m => m.ConversationId == conversationId && !m.IsRead && m.SenderId != userId)
            .ToListAsync();
        foreach (var m in unread) m.IsRead = true;
        await _context.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendMessage([FromBody] SendShopMessageRequest request)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        ShopConversation? conversation;
        if (request.ConversationId.HasValue)
        {
            conversation = await _context.ShopConversations.FindAsync(request.ConversationId.Value);
        }
        else if (request.ShopId.HasValue)
        {
            // Find or create conversation by shopId
            conversation = await _context.ShopConversations
                .FirstOrDefaultAsync(c => c.BuyerId == userId && c.ShopId == request.ShopId.Value);

            if (conversation == null)
            {
                var shop = await _context.Shops.FirstOrDefaultAsync(s => s.Id == request.ShopId.Value);
                Console.WriteLine($"[DEBUG] Chat: Checking ShopId {request.ShopId.Value}. Found: {shop?.Name ?? "NULL"}");
                
                if (shop == null) return NotFound(new { message = $"Không tìm thấy cửa hàng với ID: {request.ShopId.Value}" });

                conversation = new ShopConversation
                {
                    Id = Guid.NewGuid(),
                    BuyerId = userId,
                    ShopId = request.ShopId.Value,
                    CreatedAt = DateTime.UtcNow,
                    LastMessageAt = DateTime.UtcNow
                };
                _context.ShopConversations.Add(conversation);
            }
        }
        else
        {
            return BadRequest(new { message = "ConversationId or ShopId is required" });
        }

        if (conversation == null) return NotFound();

        var message = new ShopMessage
        {
            Id = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderId = userId,
            Content = request.Content,
            ImageUrl = request.ImageUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        conversation.LastMessageAt = DateTime.UtcNow;
        _context.ShopMessages.Add(message);
        await _context.SaveChangesAsync();

        return Ok(new ShopMessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            Content = message.Content,
            ImageUrl = message.ImageUrl,
            IsMe = true,
            CreatedAt = message.CreatedAt
        });
    }

    public class SendShopMessageRequest
    {
        public Guid? ConversationId { get; set; }
        public Guid? ShopId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
    }
}
