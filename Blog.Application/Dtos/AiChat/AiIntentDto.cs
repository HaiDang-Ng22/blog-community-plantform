using System.Collections.Generic;

namespace Blog.Application.Dtos.AiChat;

public class AiIntentDto
{
    public string Type { get; set; } = "unknown";
    public List<string> Keywords { get; set; } = new();
    public string? Category { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public string SortBy { get; set; } = "relevance";
    public Dictionary<string, string> Attributes { get; set; } = new();
    public bool IsShoppingRelated { get; set; }
    public bool IsOrderRelated { get; set; }
    public bool RequiresComparison { get; set; }
    public bool NeedsProducts { get; set; } = true;
    public bool NeedsClarification { get; set; }
    public string? ClarificationQuestion { get; set; }
}
