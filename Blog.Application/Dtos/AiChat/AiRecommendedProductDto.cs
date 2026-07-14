using System;

namespace Blog.Application.Dtos.AiChat;

public class AiRecommendedProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string ShopName { get; set; } = string.Empty;
    public double Rating { get; set; }
    public int SalesCount { get; set; }
    public Guid RecommendationLogId { get; set; }
}
