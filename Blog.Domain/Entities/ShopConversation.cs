namespace Blog.Domain.Entities;

/// <summary>
/// Cuộc hội thoại riêng giữa Người mua (User) và Cửa hàng (Shop)
/// </summary>
public class ShopConversation
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public Guid ShopId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public virtual User Buyer { get; set; } = null!;
    public virtual Shop Shop { get; set; } = null!;
    public virtual ICollection<ShopMessage> Messages { get; set; } = new List<ShopMessage>();
}

public class ShopMessage
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; } // Có thể là BuyerId hoặc Shop.UserId
    
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public virtual ShopConversation Conversation { get; set; } = null!;
    public virtual User Sender { get; set; } = null!;
}
