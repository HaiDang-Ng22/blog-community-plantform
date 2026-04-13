namespace Blog.Domain.Entities;

public enum ShopApplicationStatus
{
    Pending,
    Approved,
    Rejected
}

public class ShopApplication
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ShopName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IdentityInfo { get; set; } // CCCD or Tax ID
    public ShopApplicationStatus Status { get; set; } = ShopApplicationStatus.Pending;
    public string? AdminNote { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
