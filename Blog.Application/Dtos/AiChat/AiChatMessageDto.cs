using System;

namespace Blog.Application.Dtos.AiChat;

public class AiChatMessageDto
{
    public Guid Id { get; set; }
    public string Role { get; set; } = string.Empty; // User, Assistant, System
    public string Content { get; set; } = string.Empty;
    public string? Intent { get; set; }
    public DateTime CreatedAt { get; set; }
}
