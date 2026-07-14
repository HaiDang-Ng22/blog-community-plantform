using System;

namespace Blog.Domain.Entities;

public class AiRecommendationLog
{
    public Guid Id { get; set; }
    public Guid? SessionId { get; set; }
    public Guid? MessageId { get; set; }
    public Guid? UserId { get; set; }
    public Guid ProductId { get; set; }
    public double Score { get; set; }
    public string? Reason { get; set; }
    public string? GroupType { get; set; } // relevant, top_rated, same_category, similar
    public bool IsClicked { get; set; } = false;
    public bool IsAddedToCart { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual Product Product { get; set; } = null!;
}
