using System.Collections.Generic;

namespace Blog.Application.Dtos.AiChat;

public class AiRecommendationGroupDto
{
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // relevant, top_rated, same_category, similar
    public List<AiRecommendedProductDto> Products { get; set; } = new();
}
