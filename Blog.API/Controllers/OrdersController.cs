using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Extensions;
using Blog.API.Services;
using PayOS;
using PayOS.Models;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

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
    private readonly INotificationService _notiService;
    private readonly PayOSClient? _payOS;

    public OrdersController(
        IOrderRepository orderRepository,
        IProductRepository productRepository,
        IRepository<ProductVariant> variantRepository,
        IRepository<UserAddress> addressRepository,
        IShopRepository shopRepository,
        Blog.Infrastructure.Data.AppDbContext context,
        INotificationService notiService,
        PayOSClient? payOS = null)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
        _variantRepository = variantRepository;
        _addressRepository = addressRepository;
        _shopRepository = shopRepository;
        _context = context;
        _notiService = notiService;
        _payOS = payOS;
    }

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout([FromBody] CreateOrderDto dto)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        
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

        // Pre-load all products to group by ShopId
        var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _context.Products.Include(p => p.Shop).Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id);

        var shopGroups = dto.Items.GroupBy(i => 
        {
            if (products.TryGetValue(i.ProductId, out var p)) return p.ShopId;
            return Guid.Empty;
        }).Where(g => g.Key != Guid.Empty).ToList();

        if (!shopGroups.Any()) return BadRequest(new { message = "Không tìm thấy sản phẩm hợp lệ." });

        var createdOrderIds = new List<Guid>();

        foreach (var group in shopGroups)
        {
            var shopId = group.Key;
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
                ShippingFee = 25000, // Split fee or fixed fee per shop
                Items = new List<OrderItem>()
            };

            decimal total = 0;
            Voucher? appliedVoucher = null;

            if (!string.IsNullOrEmpty(dto.VoucherCode))
            {
                appliedVoucher = await _context.Vouchers.FirstOrDefaultAsync(v => 
                    (v.ShopId == shopId || v.ShopId == null) && 
                    v.Code == dto.VoucherCode.ToUpper() && 
                    v.IsActive && 
                    v.StartDate <= DateTime.UtcNow && 
                    v.EndDate >= DateTime.UtcNow &&
                    (v.UsageLimit == null || v.UsedCount < v.UsageLimit));
            }

            foreach (var itemDto in group)
            {
                var product = products[itemDto.ProductId];
                
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
                
                // Update stock
                product.Stock -= itemDto.Quantity;
                product.SalesCount += itemDto.Quantity;
                _context.Products.Update(product);
            }

            // Apply Voucher
            if (appliedVoucher != null)
            {
                if (appliedVoucher.MinOrderValue == null || total >= appliedVoucher.MinOrderValue.Value)
                {
                    if (appliedVoucher.DiscountType == DiscountType.FreeShipping)
                    {
                        // Free shipping: set shipping fee to zero
                        order.ShippingFee = 0;
                        order.VoucherId = appliedVoucher.Id;
                        appliedVoucher.UsedCount++;
                        _context.Vouchers.Update(appliedVoucher);
                    }
                    else
                    {
                        decimal discount = 0;
                        if (appliedVoucher.DiscountType == DiscountType.Percentage)
                        {
                            discount = total * (appliedVoucher.DiscountValue / 100);
                            if (appliedVoucher.MaxDiscountAmount.HasValue)
                                discount = Math.Min(discount, appliedVoucher.MaxDiscountAmount.Value);
                        }
                        else
                        {
                            discount = appliedVoucher.DiscountValue;
                        }

                        order.VoucherId = appliedVoucher.Id;
                        order.DiscountAmount = Math.Min(discount, total); // Cannot discount more than total
                        appliedVoucher.UsedCount++;
                        _context.Vouchers.Update(appliedVoucher);
                    }
                }
            }

            decimal finalItemsTotal = Math.Max(0, total - order.DiscountAmount);
            order.PlatformFeeRate = 0.05m;
            order.PlatformFeeAmount = finalItemsTotal * order.PlatformFeeRate;
            order.TotalAmount = finalItemsTotal + order.ShippingFee;
            await _orderRepository.AddAsync(order);
            createdOrderIds.Add(order.Id);

            // Notification
            var shop = await _shopRepository.GetByIdAsync(shopId);
            if (shop != null)
            {
                await _notiService.SendNotificationAsync(shop.UserId, userId, "NewOrder", order.Id, "đã đặt một đơn hàng mới từ shop của bạn.");
            }
        }

        await _context.SaveChangesAsync();

        // Handle PayOS Payment
        if (dto.PaymentMethod?.ToUpper() == "PAYOS" && _payOS != null)
        {
            var orders = await _context.Orders
                .Where(o => createdOrderIds.Contains(o.Id))
                .ToListAsync();

            if (orders.Any())
            {
                long orderCode = long.Parse(DateTimeOffset.Now.ToString("yyMMddHHmmssfff"));
                int totalAmount = (int)orders.Sum(o => o.TotalAmount);
                
                // Update orders with the same orderCode
                foreach (var o in orders)
                {
                    o.OrderCode = orderCode;
                }
                await _context.SaveChangesAsync();

                var baseUrl = $"{Request.Scheme}://{Request.Host}";
                var paymentData = new CreatePaymentLinkRequest
                {
                    OrderCode = orderCode,
                    Amount = totalAmount,
                    Description = "Thanh toán Zynk Shop",
                    CancelUrl = $"{baseUrl}/index.html",
                    ReturnUrl = $"{baseUrl}/index.html?payment=success"
                };

                try
                {
                    var result = await _payOS.PaymentRequests.CreateAsync(paymentData);
                    return Ok(new { 
                        message = "Tiến hành thanh toán", 
                        checkoutUrl = result.CheckoutUrl,
                        orderIds = createdOrderIds 
                    });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { message = "Lỗi khởi tạo thanh toán: " + ex.Message });
                }
            }
        }

        // Handle Bank Transfer (VietQR)
        if (dto.PaymentMethod?.ToUpper() == "BANK_TRANSFER")
        {
            var orders = await _context.Orders
                .Include(o => o.Items)
                .Where(o => createdOrderIds.Contains(o.Id))
                .ToListAsync();

            var paymentDetails = new List<object>();
            foreach (var order in orders)
            {
                // Find shop for this order
                var firstItem = order.Items.FirstOrDefault();
                if (firstItem != null)
                {
                    var product = await _context.Products.Include(p => p.Shop).FirstOrDefaultAsync(p => p.Id == firstItem.ProductId);
                    if (product?.Shop != null)
                    {
                        paymentDetails.Add(new {
                            orderId = order.Id,
                            shopName = product.Shop.Name,
                            bankName = product.Shop.BankName,
                            accountNumber = product.Shop.BankAccountNumber,
                            accountName = product.Shop.BankAccountName,
                            amount = order.TotalAmount,
                            description = $"ZYNK {order.Id.ToString().Substring(0,8).ToUpper()}"
                        });
                    }
                }
            }

            return Ok(new { 
                message = "Vui lòng chuyển khoản cho các Shop", 
                paymentDetails = paymentDetails,
                orderIds = createdOrderIds 
            });
        }

        return Ok(new { message = "Đặt hàng thành công", orderIds = createdOrderIds });
    }

    [HttpGet("my-orders")]
    public async Task<IActionResult> GetMyOrders()
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
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

        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        
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

            // Restore stock when order is cancelled
            if (newStatus == OrderStatus.Cancelled)
            {
                foreach (var item in order.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product != null)
                    {
                        product.Stock += item.Quantity;
                        product.SalesCount = Math.Max(0, product.SalesCount - item.Quantity);
                        _context.Products.Update(product);
                    }
                }
            }

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
                        await _notiService.SendNotificationAsync(shop.UserId, userId, "OrderCancelled", order.Id, "đã hủy đơn hàng.");
                    }
                }
            }
            else if (isSeller && !isBuyer)
            {
                // Seller updated status -> Notify Buyer
                await _notiService.SendNotificationAsync(order.BuyerId, userId, "OrderStatusUpdated", order.Id, $"đã cập nhật đơn hàng thành: {GetStatusDisplayName(newStatus)}");
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
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        
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
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
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
        var userId = User.GetUserId();
        if (userId == null || userId == Guid.Empty) return Ok(Array.Empty<object>());
        
        // Fetch all addresses for this user, ordered by default first, then newest
        var userAddresses = await _context.UserAddresses
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.IsDefault)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync();
        
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

    [HttpPost("addresses")]
    public async Task<IActionResult> CreateAddress([FromBody] CreateAddressDto dto)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var userAddresses = await _context.UserAddresses.Where(a => a.UserId == userId).ToListAsync();
        bool isFirst = !userAddresses.Any();

        var newAddress = new UserAddress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FullName = dto.FullName,
            PhoneNumber = dto.PhoneNumber,
            Province = dto.Province,
            DistrictWard = dto.DistrictWard,
            SpecificAddress = dto.SpecificAddress,
            IsDefault = isFirst || dto.IsDefault,
            CreatedAt = DateTime.UtcNow
        };

        if (newAddress.IsDefault)
        {
            foreach (var addr in userAddresses)
            {
                if (addr.IsDefault)
                {
                    addr.IsDefault = false;
                    _context.UserAddresses.Update(addr);
                }
            }
        }

        _context.UserAddresses.Add(newAddress);
        await _context.SaveChangesAsync();

        return Ok(newAddress);
    }

    [HttpPut("addresses/{id}/default")]
    public async Task<IActionResult> SetDefaultAddress(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var userAddresses = await _context.UserAddresses.Where(a => a.UserId == userId).ToListAsync();
        var targetAddress = userAddresses.FirstOrDefault(a => a.Id == id);
        if (targetAddress == null) return NotFound(new { message = "Không tìm thấy địa chỉ." });

        foreach (var addr in userAddresses)
        {
            addr.IsDefault = (addr.Id == id);
            _context.UserAddresses.Update(addr);
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã đặt làm địa chỉ mặc định." });
    }

    [HttpDelete("addresses/{id}")]
    public async Task<IActionResult> DeleteAddress(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var userAddresses = await _context.UserAddresses.Where(a => a.UserId == userId).ToListAsync();
        var targetAddress = userAddresses.FirstOrDefault(a => a.Id == id);
        if (targetAddress == null) return NotFound(new { message = "Không tìm thấy địa chỉ." });

        bool wasDefault = targetAddress.IsDefault;
        _context.UserAddresses.Remove(targetAddress);

        // If we deleted the default address, make another one default
        if (wasDefault)
        {
            var remaining = userAddresses.Where(a => a.Id != id).OrderByDescending(a => a.CreatedAt).FirstOrDefault();
            if (remaining != null)
            {
                remaining.IsDefault = true;
                _context.UserAddresses.Update(remaining);
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa địa chỉ thành công." });
    }

    [HttpPost("validate-voucher")]
    public async Task<IActionResult> ValidateVoucher([FromBody] ValidateVoucherDto dto)
    {
        var now = DateTime.UtcNow;
        var voucher = await _context.Vouchers
            .Include(v => v.Shop)
            .FirstOrDefaultAsync(v => 
                v.Code == dto.Code.ToUpper() && 
                v.IsActive && 
                v.StartDate <= now && 
                v.EndDate >= now && 
                (v.UsageLimit == 0 || v.UsedCount < v.UsageLimit));

        if (voucher == null)
        {
            return BadRequest(new { message = "Mã giảm giá không tồn tại, đã hết hạn hoặc hết lượt dùng." });
        }

        if (dto.ShopId.HasValue && voucher.ShopId.HasValue && voucher.ShopId.Value != dto.ShopId.Value)
        {
            return BadRequest(new { message = "Mã giảm giá này không áp dụng cho cửa hàng của sản phẩm này." });
        }

        if (voucher.MinOrderValue.HasValue && dto.OrderValue < voucher.MinOrderValue.Value)
        {
            return BadRequest(new { message = $"Đơn hàng từ shop chưa đạt giá trị tối thiểu {voucher.MinOrderValue.Value:N0}đ để áp dụng mã." });
        }

        decimal discountAmount = 0;
        bool isFreeShipping = voucher.DiscountType == DiscountType.FreeShipping;

        if (!isFreeShipping)
        {
            if (voucher.DiscountType == DiscountType.Percentage)
            {
                discountAmount = dto.OrderValue * (voucher.DiscountValue / 100);
                if (voucher.MaxDiscountAmount.HasValue)
                {
                    discountAmount = Math.Min(discountAmount, voucher.MaxDiscountAmount.Value);
                }
            }
            else
            {
                discountAmount = voucher.DiscountValue;
            }
            discountAmount = Math.Min(discountAmount, dto.OrderValue);
        }

        return Ok(new { 
            code = voucher.Code,
            discountType = voucher.DiscountType.ToString(),
            discountValue = voucher.DiscountValue,
            discountAmount = discountAmount,
            isFreeShipping = isFreeShipping,
            shopId = voucher.ShopId,
            shopName = voucher.Shop?.Name ?? "Zynk Platform"
        });
    }

    [HttpGet("my-vouchers")]
    public async Task<IActionResult> GetMyVouchers()
    {
        var userId = User.GetUserId();
        if (userId == null || userId == Guid.Empty) return Ok(Array.Empty<object>());

        var now = DateTime.UtcNow;
        var userVouchers = await _context.UserVouchers
            .Include(uv => uv.Voucher)
            .ThenInclude(v => v.Shop)
            .Where(uv => uv.UserId == userId && !uv.IsUsed && uv.Voucher.IsActive && uv.Voucher.EndDate >= now)
            .Select(uv => new {
                uv.Voucher.Id,
                uv.Voucher.Code,
                uv.Voucher.Description,
                DiscountType = uv.Voucher.DiscountType.ToString(), // Serialize as string
                uv.Voucher.DiscountValue,
                uv.Voucher.MinOrderValue,
                uv.Voucher.MaxDiscountAmount,
                uv.Voucher.StartDate,
                uv.Voucher.EndDate,
                uv.Voucher.ShopId,
                ShopName = uv.Voucher.Shop != null ? uv.Voucher.Shop.Name : "Hệ thống Zynk",
                uv.ClaimedAt
            })
            .ToListAsync();

        return Ok(userVouchers);
    }

    public class ValidateVoucherDto
    {
        public string Code { get; set; } = string.Empty;
        public decimal OrderValue { get; set; }
        public Guid? ShopId { get; set; }
    }

    public class CreateAddressDto
    {
        public string FullName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Province { get; set; } = string.Empty;
        public string DistrictWard { get; set; } = string.Empty;
        public string SpecificAddress { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
    }

    [HttpPost("{id}/confirm-bank-payment")]
    public async Task<IActionResult> ConfirmBankTransferPayment(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var order = await _orderRepository.GetOrderDetailAsync(id);
        if (order == null) return NotFound(new { message = "Không tìm thấy đơn hàng." });

        // Only the seller of this order can confirm
        var userShop = await _shopRepository.GetByUserIdAsync(userId);
        bool isSeller = userShop != null && order.Items.Any(i => i.Product != null && i.Product.ShopId == userShop.Id);
        if (!isSeller) return Forbid();

        if (order.PaymentMethod?.ToUpper() != "BANK_TRANSFER")
            return BadRequest(new { message = "Đơn hàng này không phải thanh toán chuyển khoản." });

        if (order.Status != OrderStatus.Unpaid)
            return BadRequest(new { message = $"Đơn hàng không ở trạng thái chờ thanh toán (trạng thái hiện tại: {order.Status})." });

        order.Status = OrderStatus.AwaitingShipment;
        order.UpdatedAt = DateTime.UtcNow;
        await _orderRepository.UpdateAsync(order);

        // Notify the buyer
        await _notiService.SendNotificationAsync(order.BuyerId, userId, "OrderStatusUpdated", order.Id, "đã xác nhận thanh toán chuyển khoản. Đơn hàng của bạn đang được chuẩn bị.");

        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xác nhận thanh toán thành công. Đơn hàng chuyển sang Chờ vận chuyển." });
    }

    [AllowAnonymous]
    [HttpPost("payos-webhook")]
    public async Task<IActionResult> PayOSWebhook([FromBody] Webhook request)
    {
        if (_payOS == null) return BadRequest();

        try
        {
            // Verify webhook signature
            var verifiedData = await _payOS.Webhooks.VerifyAsync(request);

            if (verifiedData.Description == "Ma giao dich thu nghiem")
            {
                // This is a test transaction
            }

            // Find orders with this OrderCode
            long orderCodeToFind = verifiedData.OrderCode;
            var orders = await _context.Orders
                .Where(o => o.OrderCode == orderCodeToFind)
                .ToListAsync();

            if (orders.Any())
            {
                foreach (var order in orders)
                {
                    if (order.Status == OrderStatus.Unpaid)
                    {
                        order.Status = OrderStatus.AwaitingShipment;
                        order.UpdatedAt = DateTime.UtcNow;
                    }
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
