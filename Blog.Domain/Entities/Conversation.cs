namespace Blog.Domain.Entities;

/// <summary>
/// Một cuộc hội thoại 1-1 giữa hai người dùng
/// </summary>
public class Conversation
{
    public Guid Id { get; set; }

    public Guid User1Id { get; set; }
    public Guid User2Id { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime LastMessageAt { get; set; }

    // Navigation
    public virtual User User1 { get; set; } = null!;
    public virtual User User2 { get; set; } = null!;
    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();
}
