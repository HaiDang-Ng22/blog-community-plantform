using System;
using System.Collections.Generic;

namespace Blog.Domain.Entities;

public class AiChatSession
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? AnonymousSessionId { get; set; }
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    public virtual User? User { get; set; }
    public virtual ICollection<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
}
