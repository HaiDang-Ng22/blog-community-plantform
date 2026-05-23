namespace Blog.Domain.Entities;

public class PostProductTag
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Guid ProductId { get; set; }
    
    // Position on the image (0.0 to 100.0 percentage)
    public double? PositionX { get; set; }
    public double? PositionY { get; set; }

    // Affiliate Commission Rate (e.g., 0.10 for 10%)
    public decimal CommissionRate { get; set; } = 0.0m;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual Post Post { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
}
