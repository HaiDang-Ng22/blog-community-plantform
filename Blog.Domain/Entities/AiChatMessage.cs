using System;

namespace Blog.Domain.Entities;

public class AiChatMessage
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public string Role { get; set; } = string.Empty; // User, Assistant, System
    public string Content { get; set; } = string.Empty;
    public string? Intent { get; set; }
    public string? MetadataJson { get; set; }
    public Guid? ClientMessageId { get; set; } // For deduplication
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual AiChatSession Session { get; set; } = null!;
}
