namespace Blog.Domain.Entities;

/// <summary>
/// Full order status state machine per plan (Phase 2.1)
/// </summary>
public enum OrderStatus
{
    // ── Pre-payment ──
    PendingPayment,     // Chờ thanh toán (mới tạo)
    PaymentExpired,     // Quá hạn thanh toán
    Paid,               // Đã thanh toán
    
    // ── Fulfillment ──
    Confirmed,          // Người bán đã xác nhận
    Packing,            // Đang đóng gói
    Shipping,           // Đang giao hàng (đã bàn giao ĐVVC)
    Delivered,          // Đã giao thành công
    Completed,          // Hoàn thành (sau khoảng thời gian bảo hành)
    
    // ── Negative outcomes ──
    Cancelled,          // Đã hủy
    ReturnRequested,    // Yêu cầu hoàn trả
    Returned,           // Trả hàng/Hoàn tiền thành công
    ReturnRejected,     // Yêu cầu hoàn trả bị từ chối
    
    // ── Legacy values (kept for backward compat) ──
    Unpaid = 100,           // → PendingPayment
    AwaitingShipment = 101, // → Confirmed/Packing
    AwaitingCollection = 102, // → Packing
    InTransit = 103         // → Shipping
}

public class Order
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PendingPayment;
    public string PaymentMethod { get; set; } = "COD";
    
    /// <summary>External payment provider order code (e.g., PayOS)</summary>
    public long? OrderCode { get; set; }
    
    /// <summary>External payment provider transaction ID for idempotency check</summary>
    public string? ProviderTransactionId { get; set; }
    
    public decimal ShippingFee { get; set; } = 0;
    
    // ── Address ──
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string DistrictWard { get; set; } = string.Empty;
    public string SpecificAddress { get; set; } = string.Empty;
    public string ShippingAddress { get; set; } = string.Empty;
    
    // ── Optional ──
    public string? CustomerNote { get; set; }
    public string? CancellationReason { get; set; }
    public string? TrackingNumber { get; set; }
    
    // ── Voucher / Discount ──
    public Guid? VoucherId { get; set; }
    public decimal DiscountAmount { get; set; }
    
    // ── Platform Fee ──
    public decimal PlatformFeeRate { get; set; } = 0.05m;
    public decimal PlatformFeeAmount { get; set; } = 0;
    
    // ── Affiliate ──
    public Guid? AffiliateUserId { get; set; }
    public decimal AffiliateCommissionAmount { get; set; } = 0;
    
    // ── Timestamps ──
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // ── Navigation ──
    public virtual User Buyer { get; set; } = null!;
    public virtual Voucher? Voucher { get; set; }
    public virtual ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public virtual ICollection<OrderStatusHistory> StatusHistory { get; set; } = new List<OrderStatusHistory>();
}

/// <summary>
/// Audit log of all order status transitions (Plan 3.1)
/// </summary>
public class OrderStatusHistory
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public OrderStatus FromStatus { get; set; }
    public OrderStatus ToStatus { get; set; }
    /// <summary>UserId of who triggered the change (buyer, seller, system=null)</summary>
    public Guid? ChangedByUserId { get; set; }
    public string? Note { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

    public virtual Order Order { get; set; } = null!;
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountAmount { get; set; } = 0;
    
    // ── Snapshot at time of purchase (immutable) ──
    public string? ProductNameSnapshot { get; set; }
    public string? ProductImageSnapshot { get; set; }
    public string? VariantNameSnapshot { get; set; }

    public virtual Order Order { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
    public virtual ProductVariant? Variant { get; set; }
}
