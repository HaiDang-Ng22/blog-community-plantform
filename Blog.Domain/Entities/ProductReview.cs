using System.ComponentModel.DataAnnotations;

namespace Blog.Domain.Entities;

public class ProductReview
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid UserId { get; set; }
    
    [Range(1, 5)]
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual Product Product { get; set; } = null!;
    public virtual User User { get; set; } = null!;
    public virtual ICollection<ProductReviewImage> Images { get; set; } = new List<ProductReviewImage>();
}

public class ProductReviewImage
{
    public Guid Id { get; set; }
    public Guid ProductReviewId { get; set; }
    public string Url { get; set; } = string.Empty;

    public virtual ProductReview Review { get; set; } = null!;
}
