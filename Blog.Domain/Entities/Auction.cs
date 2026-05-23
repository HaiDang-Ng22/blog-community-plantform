namespace Blog.Domain.Entities;

public enum AuctionStatus
{
    PendingApproval, // Chờ admin duyệt
    Rejected,        // Admin từ chối
    Upcoming,        // Đã duyệt, chờ đến giờ
    Ongoing,         // Đang diễn ra
    Ended,           // Kết thúc
    Cancelled        // Hủy
}

public class Auction
{
    public Guid Id { get; set; }
    
    // Thông tin người gửi (Seller)
    public Guid SellerId { get; set; }
    public virtual User Seller { get; set; } = null!;
    
    // Thông tin sản phẩm đấu giá
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new List<string>();
    
    public decimal StartingPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public Guid? HighestBidderId { get; set; }
    
    // Thời gian
    public DateTime RequestedDate { get; set; } // Ngày user muốn đấu giá
    public DateTime? StartTime { get; set; } // Admin set khi duyệt
    public DateTime? EndTime { get; set; }   // Admin set khi duyệt
    
    public AuctionStatus Status { get; set; } = AuctionStatus.PendingApproval;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual User? HighestBidder { get; set; }
    public virtual ICollection<AuctionBid> Bids { get; set; } = new List<AuctionBid>();
}

public class AuctionBid
{
    public Guid Id { get; set; }
    public Guid AuctionId { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual Auction Auction { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
