namespace Blog.Domain.Entities;

/// <summary>
/// Một tin nhắn trong cuộc hội thoại
/// </summary>
public class Message
{
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }

    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Nếu người nhận chưa follow người gửi: tin nhắn nằm trong "Tin nhắn chờ" (pending).
    /// Khi cả hai follow nhau (mutual) hoặc người nhận chủ động chấp nhận: IsAccepted = true.
    /// </summary>
    public bool IsRead { get; set; } = false;

    public bool IsRequestMessage { get; set; } = false;   // Gửi từ người lạ → nằm trong "Chờ"
    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid? ReplyToMessageId { get; set; }
    public virtual Message? ReplyToMessage { get; set; }

    public bool IsHearted { get; set; } = false;

    public Guid? SharedPostId { get; set; }
    public virtual Post? SharedPost { get; set; }

    // Navigation
    public virtual Conversation Conversation { get; set; } = null!;
    public virtual User Sender { get; set; } = null!;
}
