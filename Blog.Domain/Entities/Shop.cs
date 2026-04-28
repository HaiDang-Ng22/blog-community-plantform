namespace Blog.Domain.Entities;

public class Shop
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? CoverUrl { get; set; }
    public double Rating { get; set; } = 5.0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsSuspended { get; set; } = false;

    // Payment Settings
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }

    public virtual User User { get; set; } = null!;
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}
