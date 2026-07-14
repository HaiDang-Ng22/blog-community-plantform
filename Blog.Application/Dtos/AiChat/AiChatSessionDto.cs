using System;

namespace Blog.Application.Dtos.AiChat;

public class AiChatSessionDto
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
