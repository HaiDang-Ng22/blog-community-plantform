namespace Blog.Domain.Entities;

public enum OrderStatus
{
    Unpaid,             // Chờ thanh toán
    AwaitingShipment,   // Chờ vận chuyển (Người bán cần chuẩn bị hàng)
    AwaitingCollection, // Chờ lấy hàng (Đã đóng gói, chờ ĐVVC đến lấy)
    InTransit,          // Đang giao hàng
    Delivered,          // Đã giao hàng
    Completed,          // Hoàn thành
    Cancelled,          // Đã hủy
    Returned            // Trả hàng/Hoàn tiền
}

public class Order
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Unpaid;
    public string PaymentMethod { get; set; } = "COD";
    
    // Address detail fields
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string DistrictWard { get; set; } = string.Empty;
    public string SpecificAddress { get; set; } = string.Empty;
    // Legacy mapping or full address
    public string ShippingAddress { get; set; } = string.Empty;
    
    public string? CustomerNote { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public virtual User Buyer { get; set; } = null!;
    public virtual ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }

    public virtual Order Order { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
    public virtual ProductVariant? Variant { get; set; }
}
