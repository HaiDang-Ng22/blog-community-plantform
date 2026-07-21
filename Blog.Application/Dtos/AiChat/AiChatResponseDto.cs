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

    /// <summary>
    /// Optional action hint for the frontend. Values: "view_cart", "redirect_cart",
    /// "view_orders", "require_login", "cancel_order_info", "return_refund_info", "help", null.
    /// </summary>
    public string? ActionType { get; set; }

    /// <summary>
    /// Populated when ActionType is "view_orders": list of the user's recent orders.
    /// </summary>
    public List<AiOrderSummaryDto>? Orders { get; set; }
}
