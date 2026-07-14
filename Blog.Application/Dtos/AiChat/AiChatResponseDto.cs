using System;
using System.Collections.Generic;

namespace Blog.Application.Dtos.AiChat;

public class AiChatResponseDto
{
    public Guid SessionId { get; set; }
    public Guid MessageId { get; set; }
    public string Response { get; set; } = string.Empty;
    public AiIntentDto Intent { get; set; } = new();
    public List<AiRecommendationGroupDto> Groups { get; set; } = new();
    public List<string> SuggestedReplies { get; set; } = new();
    public bool HasMore { get; set; } = false;
}
