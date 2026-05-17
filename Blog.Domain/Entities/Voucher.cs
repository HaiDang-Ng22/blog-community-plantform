using System.ComponentModel.DataAnnotations;

namespace Blog.Domain.Entities;

public enum DiscountType
{
    Percentage, // Phần trăm (ví dụ 10%)
    FixedAmount // Số tiền cố định (ví dụ 20.000đ)
}

public class Voucher
{
    public Guid Id { get; set; }
    public Guid? ShopId { get; set; } // Null if Platform Voucher
    
    [Required]
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    
    public decimal? MinOrderValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; } 
    
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    
    public int UsageLimit { get; set; } // Set to a large number if no limit
    public int UsedCount { get; set; }
    
    public bool IsPublic { get; set; } = false; // If true, shows on hunting page
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual Shop? Shop { get; set; }
}
