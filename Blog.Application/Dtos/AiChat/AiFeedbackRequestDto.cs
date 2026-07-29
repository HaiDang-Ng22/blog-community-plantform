using System;

namespace Blog.Application.Dtos.AiChat;

public class AiFeedbackRequestDto
{
    public int Rating { get; set; }
    public string? Reason { get; set; }
    public string? AnonymousSessionId { get; set; }
}

public class RenameAiChatSessionRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string? AnonymousSessionId { get; set; }
}
