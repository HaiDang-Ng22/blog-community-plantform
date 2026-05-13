namespace Blog.Application.Dtos;

// Category DTOs
public class CategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public Guid? ParentCategoryId { get; set; }
}

// Shop DTOs
public class ShopDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? CoverUrl { get; set; }
    public double Rating { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
}

public class UpdateShopPaymentDto
{
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountName { get; set; } = string.Empty;
}

public class ShopApplicationDto
{
    public Guid Id { get; set; }
    public string ShopName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    
    // Identity Fields
    public string CitizenId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Hometown { get; set; } = string.Empty;
    public string Occupation { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

// Product DTOs
public class ProductDto
{
    public Guid Id { get; set; }
    public Guid ShopId { get; set; }
    public Guid ShopOwnerId { get; set; }
    public string ShopName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public double Rating { get; set; }
    public int SalesCount { get; set; }
    public string? VariantGroupName1 { get; set; }
    public string? VariantGroupName2 { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public List<ProductReviewDto> RecentReviews { get; set; } = new();
    public List<ProductVariantDto> Variants { get; set; } = new();
}

public class ProductReviewDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserAvatar { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class ProductReviewStatsDto
{
    public double AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public Dictionary<int, int> StarCounts { get; set; } = new();
}

public class CreateProductReviewDto
{
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public List<string> ImageUrls { get; set; } = new();
}

public class ProductVariantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
    public string? Size { get; set; }
    public string? ImageUrl { get; set; }
    public decimal PriceOverride { get; set; }
    public int Stock { get; set; }
}

public class CreateProductDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string? VariantGroupName1 { get; set; }
    public string? VariantGroupName2 { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public List<CreateProductVariantDto> Variants { get; set; } = new();
}

public class CreateProductVariantDto
{
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
    public string? Size { get; set; }
    public string? ImageUrl { get; set; }
    public decimal PriceOverride { get; set; }
    public int Stock { get; set; }
}

public class UpdateProductDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string? VariantGroupName1 { get; set; }
    public string? VariantGroupName2 { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public List<CreateProductVariantDto> Variants { get; set; } = new();
}

// Order DTOs
public class OrderDto
{
    public Guid Id { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal ShippingFee { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string ShippingAddress { get; set; } = string.Empty; // Holds combined address
    public string Province { get; set; } = string.Empty;
    public string DistrictWard { get; set; } = string.Empty;
    public string SpecificAddress { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<OrderItemDto> Items { get; set; } = new();
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
}

public class UpdateOrderAddressDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string DistrictWard { get; set; } = string.Empty;
    public string SpecificAddress { get; set; } = string.Empty;
    public string ShippingAddress { get; set; } = string.Empty;
}

public class OrderItemDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? VariantName { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? ProductImageUrl { get; set; }
}

public class CreateOrderDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string DistrictWard { get; set; } = string.Empty;
    public string SpecificAddress { get; set; } = string.Empty;
    public string ShippingAddress { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = "COD";
    public decimal ShippingFee { get; set; }
    public bool SaveAddress { get; set; }
    public string? CustomerNote { get; set; }
    public string? VoucherCode { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
}

public class CreateOrderItemDto
{
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public int Quantity { get; set; }
}

// Voucher DTOs
public class VoucherDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DiscountType { get; set; } = string.Empty; // Percentage, FixedAmount
    public decimal DiscountValue { get; set; }
    public decimal? MinOrderValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public bool IsActive { get; set; }
}

public class CreateVoucherDto
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DiscountType { get; set; } = "Percentage";
    public decimal DiscountValue { get; set; }
    public decimal? MinOrderValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int? UsageLimit { get; set; }
}

// Seller Dashboard DTOs
public class SellerDashboardDto
{
    public decimal TotalRevenue { get; set; }
    public int TotalOrders { get; set; }
    public int PendingOrders { get; set; }
    public int TotalProducts { get; set; }
    public List<RevenueChartDataDto> RevenueChart { get; set; } = new();
}

public class RevenueChartDataDto
{
    public string Date { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
}

// Shop Chat DTOs
public class ShopConversationDto
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string? BuyerAvatar { get; set; }
    public Guid ShopId { get; set; }
    public string ShopName { get; set; } = string.Empty;
    public string? ShopLogo { get; set; }
    public string LastMessage { get; set; } = string.Empty;
    public DateTime LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
}

public class ShopMessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public bool IsMe { get; set; }
    public DateTime CreatedAt { get; set; }
}
