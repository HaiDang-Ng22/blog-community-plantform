using System;

namespace Blog.Application.Dtos.AiChat;

public class AiChatRequestDto
{
    public Guid? SessionId { get; set; }
    public string? AnonymousSessionId { get; set; }
    public string Message { get; set; } = string.Empty;
    public Guid? CurrentProductId { get; set; }
    public string? PageContext { get; set; }
    public Guid ClientMessageId { get; set; }
}
