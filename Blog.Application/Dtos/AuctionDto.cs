namespace Blog.Application.Dtos;

public class AuctionDto
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string SellerAvatar { get; set; } = string.Empty;
    
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new List<string>();
    
    public decimal StartingPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public Guid? HighestBidderId { get; set; }
    public string? HighestBidderName { get; set; }
    
    public DateTime RequestedDate { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateAuctionRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new List<string>();
    public decimal StartingPrice { get; set; }
    public DateTime RequestedDate { get; set; }
}

public class CreateAuctionSessionByAdminDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string>? ImageUrls { get; set; }
    public decimal StartingPrice { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

public class ApproveAuctionRequestDto
{
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}
