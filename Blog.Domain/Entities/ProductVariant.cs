namespace Blog.Domain.Entities;

public class ProductImage
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string Url { get; set; } = string.Empty;
    public int OrderIndex { get; set; }

    public virtual Product Product { get; set; } = null!;
}

public class ProductVariant
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string Name { get; set; } = string.Empty; // e.g., "Size: M", "Color: Red"
    public string? Color { get; set; }
    public string? Size { get; set; }
    public string? ImageUrl { get; set; }
    public decimal PriceOverride { get; set; } // If 0, use base product price
    public int Stock { get; set; }

    public virtual Product Product { get; set; } = null!;
}
