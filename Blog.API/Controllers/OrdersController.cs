using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IProductRepository _productRepository;
    private readonly IRepository<ProductVariant> _variantRepository;
    private readonly IRepository<UserAddress> _addressRepository;
    private readonly IShopRepository _shopRepository;
    private readonly Blog.Infrastructure.Data.AppDbContext _context;

    public OrdersController(
        IOrderRepository orderRepository,
        IProductRepository productRepository,
        IRepository<ProductVariant> variantRepository,
        IRepository<UserAddress> addressRepository,
        IShopRepository shopRepository,
        Blog.Infrastructure.Data.AppDbContext context)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
        _variantRepository = variantRepository;
        _addressRepository = addressRepository;
        _shopRepository = shopRepository;
        _context = context;
    }

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout([FromBody] CreateOrderDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        
        var order = new Order
        {
            Id = Guid.NewGuid(),
            BuyerId = userId,
            CustomerName = dto.CustomerName,
            PhoneNumber = dto.PhoneNumber,
            Province = dto.Province,
            DistrictWard = dto.DistrictWard,
            SpecificAddress = dto.SpecificAddress,
            ShippingAddress = dto.ShippingAddress,
            CustomerNote = dto.CustomerNote,
            PaymentMethod = string.IsNullOrEmpty(dto.PaymentMethod) ? "COD" : dto.PaymentMethod,
            Status = (string.IsNullOrEmpty(dto.PaymentMethod) || dto.PaymentMethod == "COD") 
                ? OrderStatus.AwaitingShipment 
                : OrderStatus.Unpaid,
            CreatedAt = DateTime.UtcNow,
            ShippingFee = dto.ShippingFee,
            Items = new List<OrderItem>()
        };

        // Handle SaveAddress
        if (dto.SaveAddress)
        {
            var userAddresses = await _addressRepository.FindAsync(a => a.UserId == userId);
            bool isFirst = !userAddresses.Any();
            
            var newAddress = new UserAddress
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                FullName = dto.CustomerName,
                PhoneNumber = dto.PhoneNumber,
                Province = dto.Province,
                DistrictWard = dto.DistrictWard,
                SpecificAddress = dto.SpecificAddress,
                IsDefault = isFirst
            };
            await _addressRepository.AddAsync(newAddress);
        }

        decimal total = 0;

        foreach (var itemDto in dto.Items)
        {
            var product = await _context.Products.Include(p => p.Shop).FirstOrDefaultAsync(p => p.Id == itemDto.ProductId);
            if (product == null) continue;
            
            if (product.Shop != null && product.Shop.IsSuspended)
            {
                return BadRequest(new { message = $"Sản phẩm '{product.Name}' thuộc về cửa hàng đang bị đình chỉ. Không thể thanh toán." });
            }

            decimal unitPrice = product.Price;
            if (itemDto.VariantId.HasValue)
            {
                var variant = await _variantRepository.GetByIdAsync(itemDto.VariantId.Value);
                if (variant != null && variant.PriceOverride > 0)
                {
                    unitPrice = variant.PriceOverride;
                }
            }

            var orderItem = new OrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductId = itemDto.ProductId,
                VariantId = itemDto.VariantId,
                Quantity = itemDto.Quantity,
                UnitPrice = unitPrice
            };

            order.Items.Add(orderItem);
            total += unitPrice * itemDto.Quantity;
            
            // Update stock (Simplified)
            product.Stock -= itemDto.Quantity;
            product.SalesCount += itemDto.Quantity;
            await _productRepository.UpdateAsync(product);
            
            // Keep track of shop ID for notification
            if (product.ShopId != Guid.Empty && !order.Items.Any(i => i.Id != orderItem.Id && i.Product?.ShopId == product.ShopId))
            {
                var shop = await _shopRepository.GetByIdAsync(product.ShopId);
                if (shop != null)
                {
                    var noti = new Notification
                    {
                        Id = Guid.NewGuid(),
                        ReceiverId = shop.UserId,
                        ActorId = userId,
                        Type = "NewOrder",
                        TargetId = order.Id,
                        Message = "đã đặt một đơn hàng mới từ shop của bạn.",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Notifications.Add(noti);
                }
            }
        }

        order.TotalAmount = total + dto.ShippingFee;
        await _orderRepository.AddAsync(order);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đặt hàng thành công", orderId = order.Id });
    }

    [HttpGet("my-orders")]
    public async Task<IActionResult> GetMyOrders()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var orders = await _orderRepository.GetOrdersByBuyerIdAsync(userId);
        
        var dtos = orders.Select(o => new OrderDto
        {
            Id = o.Id,
            TotalAmount = o.TotalAmount,
            Status = o.Status.ToString(),
            PaymentMethod = o.PaymentMethod,
            CustomerName = o.CustomerName,
            PhoneNumber = o.PhoneNumber,
            CreatedAt = o.CreatedAt,
            ShippingAddress = o.ShippingAddress,
            Province = o.Province,
            DistrictWard = o.DistrictWard,
            SpecificAddress = o.SpecificAddress,
            Items = o.Items.Select(i => new OrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                VariantId = i.VariantId,
                ProductName = i.Product?.Name ?? "Sản phẩm đã xóa",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                ProductImageUrl = i.Product?.FeaturedImageUrl
            }).ToList()
        });

        return Ok(dtos);
    }

    public class UpdateOrderStatusRequest { public string Status { get; set; } = string.Empty; }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateOrderStatusRequest request)
    {
        var order = await _orderRepository.GetOrderDetailAsync(id);
        if (order == null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        
        // Authorization check
        bool isBuyer = order.BuyerId == userId;
        var userShop = await _shopRepository.GetByUserIdAsync(userId);
        bool isSeller = userShop != null && order.Items.Any(i => i.Product != null && i.Product.ShopId == userShop.Id);

        if (!isBuyer && !isSeller) return Forbid();

        if (string.IsNullOrEmpty(request.Status))
        {
            return BadRequest(new { message = "Trạng thái không được để trống" });
        }
        
        if (Enum.TryParse<OrderStatus>(request.Status, true, out var newStatus))
        {
            // Transition logic validation
            if (isBuyer && !isSeller)
            {
                if (newStatus != OrderStatus.Cancelled)
                    return BadRequest(new { message = "Người mua chỉ có thể yêu cầu hủy đơn hàng." });
                
                if (order.Status != OrderStatus.Unpaid && order.Status != OrderStatus.AwaitingShipment)
                    return BadRequest(new { message = "Không thể hủy đơn hàng sau khi đã bắt đầu vận chuyển." });
            }

            // Simplified transition for MVP
            order.Status = newStatus;
            order.UpdatedAt = DateTime.UtcNow;
            await _orderRepository.UpdateAsync(order);

            // Generate Notifications
            if (isBuyer && !isSeller && newStatus == OrderStatus.Cancelled)
            {
                // Buyer cancelled -> Notify Seller
                var shopId = order.Items.FirstOrDefault()?.Product?.ShopId;
                if (shopId.HasValue)
                {
                    var shop = await _shopRepository.GetByIdAsync(shopId.Value);
                    if (shop != null)
                    {
                        var noti = new Notification
                        {
                            Id = Guid.NewGuid(),
                            ReceiverId = shop.UserId,
                            ActorId = userId,
                            Type = "OrderCancelled",
                            TargetId = order.Id,
                            Message = "đã hủy đơn hàng.",
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.Notifications.Add(noti);
                    }
                }
            }
            else if (isSeller && !isBuyer)
            {
                // Seller updated status -> Notify Buyer
                var noti = new Notification
                {
                    Id = Guid.NewGuid(),
                    ReceiverId = order.BuyerId,
                    ActorId = userId, // Seller user ID
                    Type = "OrderStatusUpdated",
                    TargetId = order.Id,
                    Message = $"đã cập nhật đơn hàng thành: {GetStatusDisplayName(newStatus)}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Notifications.Add(noti);
            }
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã chuyển trạng thái sang: {GetStatusDisplayName(newStatus)}" });
        }

        return BadRequest(new { message = $"Trạng thái '{request.Status}' không hợp lệ." });
    }

    private string GetStatusDisplayName(OrderStatus status)
    {
        return status switch
        {
            OrderStatus.Unpaid => "Chờ thanh toán",
            OrderStatus.AwaitingShipment => "Chờ vận chuyển",
            OrderStatus.AwaitingCollection => "Chờ lấy hàng",
            OrderStatus.InTransit => "Đang giao",
            OrderStatus.Delivered => "Đã giao hàng",
            OrderStatus.Completed => "Hoàn thành",
            OrderStatus.Cancelled => "Đã hủy",
            OrderStatus.Returned => "Trả hàng/Hoàn tiền",
            _ => status.ToString()
        };
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrderById(Guid id)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString)) return Unauthorized();
        
        var userId = Guid.Parse(userIdString);
        var order = await _orderRepository.GetOrderDetailAsync(id);
        
        if (order == null) return NotFound();
        
        
        // Authorization: Buyer OR Shop Owner of at least one product in the order
        bool isBuyer = order.BuyerId == userId;
        bool isSeller = false;

        var userShop = await _shopRepository.GetByUserIdAsync(userId);
        if (userShop != null)
        {
            isSeller = order.Items.Any(i => i.Product != null && i.Product.ShopId == userShop.Id);
        }

        if (!isBuyer && !isSeller) return Forbid();

        var dto = new OrderDto
        {
            Id = order.Id,
            TotalAmount = order.TotalAmount,
            Status = order.Status.ToString(),
            PaymentMethod = order.PaymentMethod,
            CustomerName = order.CustomerName,
            PhoneNumber = order.PhoneNumber,
            CreatedAt = order.CreatedAt,
            ShippingAddress = order.ShippingAddress,
            ShippingFee = order.ShippingFee,
            Province = order.Province,
            DistrictWard = order.DistrictWard,
            SpecificAddress = order.SpecificAddress,
            BankName = order.Items.FirstOrDefault()?.Product?.Shop?.BankName,
            BankAccountNumber = order.Items.FirstOrDefault()?.Product?.Shop?.BankAccountNumber,
            BankAccountName = order.Items.FirstOrDefault()?.Product?.Shop?.BankAccountName,
            Items = order.Items.Select(i => new OrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                VariantId = i.VariantId,
                ProductName = i.Product?.Name ?? "Sản phẩm",
                VariantName = i.Variant?.Name,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                ProductImageUrl = i.Product?.FeaturedImageUrl
            }).ToList()
        };

        return Ok(dto);
    }

    [HttpPut("{id}/address")]
    public async Task<IActionResult> UpdateOrderAddress(Guid id, [FromBody] UpdateOrderAddressDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var order = await _orderRepository.GetByIdAsync(id);
        
        if (order == null) return NotFound();
        if (order.BuyerId != userId) return Forbid();
        
        // TikTok Shop logic: Can only change address IF not packed yet
        if (order.Status != OrderStatus.Unpaid && order.Status != OrderStatus.AwaitingShipment)
        {
            return BadRequest(new { message = "Không thể thay đổi địa chỉ sau khi đơn hàng đã được chuẩn bị hoặc gửi đi." });
        }

        order.CustomerName = dto.CustomerName;
        order.PhoneNumber = dto.PhoneNumber;
        order.Province = dto.Province;
        order.DistrictWard = dto.DistrictWard;
        order.SpecificAddress = dto.SpecificAddress;
        order.ShippingAddress = dto.ShippingAddress;
        order.UpdatedAt = DateTime.UtcNow;

        await _orderRepository.UpdateAsync(order);
        return Ok(new { message = "Đã cập nhật địa chỉ giao hàng." });
    }

    [HttpGet("my-addresses")]
    public async Task<IActionResult> GetMyAddresses()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userAddresses = await _addressRepository.FindAsync(a => a.UserId == userId);
        
        var dtos = userAddresses.Select(a => new
        {
            a.Id,
            a.FullName,
            a.PhoneNumber,
            a.Province,
            a.DistrictWard,
            a.SpecificAddress,
            a.IsDefault
        }).ToList();

        return Ok(dtos);
    }
}
