using System;

namespace Blog.Domain.Entities;

public class AiFeedback
{
    public Guid Id { get; set; }
    public Guid AiMessageId { get; set; }
    public Guid? UserId { get; set; }
    public string? AnonymousSessionId { get; set; }
    public int Rating { get; set; } // 1 = helpful, -1 = not helpful
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual AiChatMessage AiMessage { get; set; } = null!;
}
