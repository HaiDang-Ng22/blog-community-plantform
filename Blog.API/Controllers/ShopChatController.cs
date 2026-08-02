using Blog.API.Extensions;
using Blog.API.Services;
using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShopChatController : ControllerBase
{
    private const string ProductMarker = "[[PRODUCT:";
    private const string OrderMarker = "[[ORDER:";
    private const string ComplaintMarker = "[[COMPLAINT:";
    private readonly AppDbContext _context;
    private readonly IShopRepository _shopRepository;
    private readonly INotificationService _notificationService;

    public ShopChatController(AppDbContext context, IShopRepository shopRepository, INotificationService notificationService)
    {
        _context = context;
        _shopRepository = shopRepository;
        _notificationService = notificationService;
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = CurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        var shop = await _shopRepository.GetByUserIdAsync(userId);

        var conversations = await _context.ShopConversations
            .AsNoTracking().Include(c => c.Buyer).Include(c => c.Shop)
            .Where(c => c.BuyerId == userId || (shop != null && c.ShopId == shop.Id))
            .OrderByDescending(c => c.LastMessageAt)
            .ToListAsync();

        var ids = conversations.Select(c => c.Id).ToList();
        var lastMessages = await _context.ShopMessages.AsNoTracking()
            .Where(m => ids.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => g.OrderByDescending(m => m.CreatedAt).First())
            .ToDictionaryAsync(m => m.ConversationId);
        var unreadCounts = await _context.ShopMessages.AsNoTracking()
            .Where(m => ids.Contains(m.ConversationId) && !m.IsRead && m.SenderId != userId)
            .GroupBy(m => m.ConversationId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        return Ok(conversations.Select(c => new ShopConversationDto
        {
            Id = c.Id,
            BuyerId = c.BuyerId,
            BuyerName = c.Buyer.FullName ?? c.Buyer.Username,
            BuyerAvatar = c.Buyer.AvatarUrl,
            ShopId = c.ShopId,
            ShopName = c.Shop.Name,
            ShopLogo = c.Shop.LogoUrl,
            LastMessageAt = c.LastMessageAt,
            LastMessage = lastMessages.TryGetValue(c.Id, out var last) ? GetPreview(last.Content, last.ImageUrl) : string.Empty,
            UnreadCount = unreadCounts.GetValueOrDefault(c.Id)
        }));
    }

    [HttpGet("messages/{conversationId:guid}")]
    public async Task<IActionResult> GetMessages(Guid conversationId)
    {
        var userId = CurrentUserId();
        var access = await GetConversationAccess(conversationId, userId);
        if (access.Conversation == null) return NotFound();
        if (!access.Allowed) return Forbid();

        var messages = await _context.ShopMessages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.CreatedAt).ToListAsync();

        var productIds = messages.Select(m => ParseMarker(m.Content, ProductMarker)).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var orderIds = messages.Select(m => ParseMarker(m.Content, OrderMarker)).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var products = await _context.Products.AsNoTracking().Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
        var orders = await _context.Orders.AsNoTracking().Where(o => orderIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id);

        var result = messages.Select(m => ToDto(m, userId, products, orders)).ToList();
        await _context.ShopMessages
            .Where(m => m.ConversationId == conversationId && !m.IsRead && m.SenderId != userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(m => m.IsRead, true));
        return Ok(result);
    }

    [HttpGet("products")]
    public async Task<IActionResult> GetSellerProducts([FromQuery] string? search = null)
    {
        var userId = CurrentUserId();
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();
        var query = _context.Products.AsNoTracking().Where(p => p.ShopId == shop.Id && p.Status == ProductStatus.Active);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(term));
        }
        return Ok(await query.OrderByDescending(p => p.Stock > 0).ThenByDescending(p => p.SalesCount).Take(30)
            .Select(p => new ShopChatProductDto { Id = p.Id, Name = p.Name, ImageUrl = p.FeaturedImageUrl, Price = p.Price, Stock = p.Stock, Rating = p.Rating })
            .ToListAsync());
    }

    [HttpGet("orders/{conversationId:guid}")]
    public async Task<IActionResult> GetConversationOrders(Guid conversationId)
    {
        var userId = CurrentUserId();
        var access = await GetConversationAccess(conversationId, userId);
        if (access.Conversation == null) return NotFound();
        if (!access.Allowed) return Forbid();
        var conversation = access.Conversation;
        return Ok(await _context.Orders.AsNoTracking()
            .Where(o => o.BuyerId == conversation.BuyerId && o.Items.Any(i => i.Product.ShopId == conversation.ShopId))
            .OrderByDescending(o => o.CreatedAt).Take(20)
            .Select(o => new ShopChatOrderDto { Id = o.Id, Code = o.Id.ToString().Substring(0, 8).ToUpper(), TotalAmount = o.TotalAmount, Status = o.Status.ToString(), CreatedAt = o.CreatedAt })
            .ToListAsync());
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendMessage([FromBody] SendShopMessageRequest request)
    {
        var userId = CurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        var conversation = await ResolveConversation(request, userId);
        if (conversation == null) return NotFound(new { message = "Không tìm thấy cuộc trò chuyện hoặc cửa hàng." });
        var access = await GetConversationAccess(conversation.Id, userId, conversation);
        if (!access.Allowed) return Forbid();

        var content = (request.Content ?? string.Empty).Trim();
        if (content.Length > 2000) return BadRequest(new { message = "Tin nhắn không được vượt quá 2.000 ký tự." });
        if (request.ProductId.HasValue)
        {
            if (!access.IsSeller) return BadRequest(new { message = "Chỉ Seller mới có thể gợi ý sản phẩm." });
            var product = await _context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.ProductId && p.ShopId == conversation.ShopId && p.Status == ProductStatus.Active);
            if (product == null) return BadRequest(new { message = "Sản phẩm không thuộc cửa hàng hoặc đã ngừng bán." });
            content = BuildMarker(ProductMarker, product.Id) + content;
        }
        else if (request.OrderId.HasValue)
        {
            if (!await IsOrderInConversation(request.OrderId.Value, conversation)) return BadRequest(new { message = "Đơn hàng không thuộc cuộc trò chuyện này." });
            content = BuildMarker(OrderMarker, request.OrderId.Value) + content;
        }
        if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(request.ImageUrl))
            return BadRequest(new { message = "Vui lòng nhập nội dung hoặc chọn nội dung cần chia sẻ." });

        var message = new ShopMessage { Id = Guid.NewGuid(), ConversationId = conversation.Id, SenderId = userId, Content = content, ImageUrl = request.ImageUrl, IsRead = false, CreatedAt = DateTime.UtcNow };
        conversation.LastMessageAt = message.CreatedAt;
        _context.ShopMessages.Add(message);
        await _context.SaveChangesAsync();
        await NotifyChatRecipient(conversation, userId, access.IsSeller, message);
        return Ok(await BuildSingleDto(message, userId));
    }

    [HttpPost("complaints")]
    public async Task<IActionResult> CreateSellerComplaint([FromBody] CreateSellerComplaintRequest request)
    {
        var userId = CurrentUserId();
        var conversation = await _context.ShopConversations.FirstOrDefaultAsync(c => c.Id == request.ConversationId);
        if (conversation == null) return NotFound();
        if (conversation.BuyerId != userId) return Forbid();
        if (!await IsOrderInConversation(request.OrderId, conversation)) return BadRequest(new { message = "Đơn hàng không thuộc Shop này." });
        var reason = (request.Reason ?? string.Empty).Trim();
        if (reason.Length < 10 || reason.Length > 1000) return BadRequest(new { message = "Nội dung khiếu nại cần từ 10 đến 1.000 ký tự." });
        var duplicate = await _context.Reports.AnyAsync(r => r.ReporterId == userId && r.TargetType == ReportTargetType.Seller && !r.IsResolved && r.Reason.Contains($"order={request.OrderId}"));
        if (duplicate) return Conflict(new { message = "Đơn hàng này đã có khiếu nại đang chờ Admin xử lý." });

        var report = new Report
        {
            Id = Guid.NewGuid(), ReporterId = userId, TargetType = ReportTargetType.Seller,
            Reason = $"shop={conversation.ShopId}|order={request.OrderId}|conversation={conversation.Id}|reason={reason}",
            CreatedAt = DateTime.UtcNow
        };
        var systemMessage = new ShopMessage
        {
            Id = Guid.NewGuid(), ConversationId = conversation.Id, SenderId = userId,
            Content = $"{BuildMarker(ComplaintMarker, report.Id)}{reason}", IsRead = false, CreatedAt = DateTime.UtcNow
        };
        conversation.LastMessageAt = systemMessage.CreatedAt;
        _context.Reports.Add(report);
        _context.ShopMessages.Add(systemMessage);
        await _context.SaveChangesAsync();
        await NotifyChatRecipient(conversation, userId, false, systemMessage);

        var adminIds = await _context.Users.AsNoTracking()
            .Where(u => u.Role == "Admin" && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync();
        foreach (var adminId in adminIds)
        {
            await _notificationService.SendNotificationAsync(
                adminId, userId, "SellerComplaint", report.Id,
                $"đã gửi khiếu nại Seller cho đơn #{request.OrderId.ToString()[..8].ToUpper()}.");
        }
        return Ok(new
        {
            message = "Đã gửi khiếu nại đến Admin.",
            complaintId = report.Id,
            chatMessage = ToDto(systemMessage, userId, new Dictionary<Guid, Product>(), new Dictionary<Guid, Order>())
        });
    }

    private Guid CurrentUserId() => User.GetUserId() ?? Guid.Empty;

    private async Task NotifyChatRecipient(ShopConversation conversation, Guid senderId, bool senderIsSeller, ShopMessage message)
    {
        Guid receiverId;
        if (senderIsSeller)
        {
            receiverId = conversation.BuyerId;
        }
        else
        {
            receiverId = await _context.Shops.AsNoTracking()
                .Where(s => s.Id == conversation.ShopId)
                .Select(s => s.UserId)
                .FirstOrDefaultAsync();
        }
        if (receiverId == Guid.Empty || receiverId == senderId) return;

        var preview = message.Content.StartsWith(ProductMarker, StringComparison.Ordinal) ? "đã gợi ý một sản phẩm."
            : message.Content.StartsWith(OrderMarker, StringComparison.Ordinal) ? "đã chia sẻ một đơn hàng."
            : message.Content.StartsWith(ComplaintMarker, StringComparison.Ordinal) ? "đã gửi cập nhật khiếu nại."
            : !string.IsNullOrWhiteSpace(message.ImageUrl) ? "đã gửi một hình ảnh."
            : "đã gửi một tin nhắn mới.";
        await _notificationService.SendNotificationAsync(
            receiverId, senderId, "ShopChatMessage", conversation.Id,
            senderIsSeller ? $"đã trả lời bạn: {preview}" : $"đã liên hệ Shop: {preview}");
    }

    private async Task<ShopConversation?> ResolveConversation(SendShopMessageRequest request, Guid userId)
    {
        if (request.ConversationId.HasValue) return await _context.ShopConversations.FirstOrDefaultAsync(c => c.Id == request.ConversationId.Value);
        if (!request.ShopId.HasValue) return null;
        var shopExists = await _context.Shops.AnyAsync(s => s.Id == request.ShopId && !s.IsSuspended);
        if (!shopExists) return null;
        var conversation = await _context.ShopConversations.FirstOrDefaultAsync(c => c.BuyerId == userId && c.ShopId == request.ShopId);
        if (conversation != null) return conversation;
        conversation = new ShopConversation { Id = Guid.NewGuid(), BuyerId = userId, ShopId = request.ShopId.Value, CreatedAt = DateTime.UtcNow, LastMessageAt = DateTime.UtcNow };
        _context.ShopConversations.Add(conversation);
        return conversation;
    }

    private async Task<(ShopConversation? Conversation, bool Allowed, bool IsSeller)> GetConversationAccess(Guid id, Guid userId, ShopConversation? loaded = null)
    {
        var conversation = loaded ?? await _context.ShopConversations.FirstOrDefaultAsync(c => c.Id == id);
        if (conversation == null) return (null, false, false);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        var isSeller = shop?.Id == conversation.ShopId;
        return (conversation, conversation.BuyerId == userId || isSeller, isSeller);
    }

    private Task<bool> IsOrderInConversation(Guid orderId, ShopConversation conversation) => _context.Orders.AsNoTracking()
        .AnyAsync(o => o.Id == orderId && o.BuyerId == conversation.BuyerId && o.Items.Any(i => i.Product.ShopId == conversation.ShopId));

    private async Task<ShopMessageDto> BuildSingleDto(ShopMessage message, Guid userId)
    {
        var products = new Dictionary<Guid, Product>();
        var orders = new Dictionary<Guid, Order>();
        var productId = ParseMarker(message.Content, ProductMarker);
        var orderId = ParseMarker(message.Content, OrderMarker);
        if (productId.HasValue)
        {
            var product = await _context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId);
            if (product != null) products[product.Id] = product;
        }
        if (orderId.HasValue)
        {
            var order = await _context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId);
            if (order != null) orders[order.Id] = order;
        }
        return ToDto(message, userId, products, orders);
    }

    private static ShopMessageDto ToDto(ShopMessage message, Guid userId, IReadOnlyDictionary<Guid, Product> products, IReadOnlyDictionary<Guid, Order> orders)
    {
        var productId = ParseMarker(message.Content, ProductMarker);
        var orderId = ParseMarker(message.Content, OrderMarker);
        var complaintId = ParseMarker(message.Content, ComplaintMarker);
        products.TryGetValue(productId ?? Guid.Empty, out var product);
        orders.TryGetValue(orderId ?? Guid.Empty, out var order);
        return new ShopMessageDto
        {
            Id = message.Id, ConversationId = message.ConversationId, SenderId = message.SenderId,
            Content = StripMarker(message.Content), ImageUrl = message.ImageUrl, IsMe = message.SenderId == userId, CreatedAt = message.CreatedAt,
            Kind = productId.HasValue ? "product" : orderId.HasValue ? "order" : complaintId.HasValue ? "complaint" : "text",
            ComplaintId = complaintId,
            Product = product == null ? null : new ShopChatProductDto { Id = product.Id, Name = product.Name, ImageUrl = product.FeaturedImageUrl, Price = product.Price, Stock = product.Stock, Rating = product.Rating },
            Order = order == null ? null : new ShopChatOrderDto { Id = order.Id, Code = order.Id.ToString()[..8].ToUpper(), TotalAmount = order.TotalAmount, Status = order.Status.ToString(), CreatedAt = order.CreatedAt }
        };
    }

    private static Guid? ParseMarker(string? content, string marker)
    {
        if (string.IsNullOrWhiteSpace(content) || !content.StartsWith(marker, StringComparison.Ordinal)) return null;
        var end = content.IndexOf("]]", marker.Length, StringComparison.Ordinal);
        return end > marker.Length && Guid.TryParse(content[marker.Length..end], out var id) ? id : null;
    }
    private static string BuildMarker(string marker, Guid id) => $"{marker}{id}]]";
    private static string StripMarker(string content)
    {
        if (!content.StartsWith("[[", StringComparison.Ordinal)) return content;
        var end = content.IndexOf("]]", StringComparison.Ordinal);
        return end >= 0 ? content[(end + 2)..] : content;
    }
    private static string GetPreview(string content, string? imageUrl)
    {
        if (content.StartsWith(ProductMarker, StringComparison.Ordinal)) return "🛍️ Đã gợi ý một sản phẩm";
        if (content.StartsWith(OrderMarker, StringComparison.Ordinal)) return "📦 Đã chia sẻ một đơn hàng";
        if (content.StartsWith(ComplaintMarker, StringComparison.Ordinal)) return "🛡️ Khiếu nại đã được gửi đến Admin";
        return string.IsNullOrWhiteSpace(content) && !string.IsNullOrWhiteSpace(imageUrl) ? "Đã gửi một hình ảnh" : content;
    }

    public class SendShopMessageRequest
    {
        public Guid? ConversationId { get; set; }
        public Guid? ShopId { get; set; }
        public string? Content { get; set; }
        public string? ImageUrl { get; set; }
        public Guid? ProductId { get; set; }
        public Guid? OrderId { get; set; }
    }
    public class CreateSellerComplaintRequest
    {
        public Guid ConversationId { get; set; }
        public Guid OrderId { get; set; }
        public string? Reason { get; set; }
    }
}
