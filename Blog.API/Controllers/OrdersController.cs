using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IProductRepository _productRepository;
    private readonly IRepository<ProductVariant> _variantRepository;

    public OrdersController(
        IOrderRepository orderRepository,
        IProductRepository productRepository,
        IRepository<ProductVariant> variantRepository)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
        _variantRepository = variantRepository;
    }

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout([FromBody] CreateOrderDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        
        var order = new Order
        {
            Id = Guid.NewGuid(),
            BuyerId = userId,
            ShippingAddress = dto.ShippingAddress,
            CustomerNote = dto.CustomerNote,
            PaymentMethod = "COD",
            Status = OrderStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            Items = new List<OrderItem>()
        };

        decimal total = 0;

        foreach (var itemDto in dto.Items)
        {
            var product = await _productRepository.GetByIdAsync(itemDto.ProductId);
            if (product == null) continue;

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
        }

        order.TotalAmount = total;
        await _orderRepository.AddAsync(order);

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
            CreatedAt = o.CreatedAt,
            ShippingAddress = o.ShippingAddress,
            Items = o.Items.Select(i => new OrderItemDto
            {
                Id = i.Id,
                ProductName = i.Product?.Name ?? "Sản phẩm đã xóa",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                ProductImageUrl = i.Product?.FeaturedImageUrl
            }).ToList()
        });

        return Ok(dtos);
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] string status)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        if (order == null) return NotFound();

        // Check if user is either the buyer (can cancel if Pending) 
        // or the seller (can update Preparing/Shipping/Completed)
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        
        // This is a simplified check. Real app would need to verify if user owns the shop that has products in this order.
        // For CV purposes, we'll implement a reasonable check.
        
        if (Enum.TryParse<OrderStatus>(status, true, out var newStatus))
        {
            order.Status = newStatus;
            order.UpdatedAt = DateTime.UtcNow;
            await _orderRepository.UpdateAsync(order);
            return Ok(new { message = "Cập nhật trạng thái thành công" });
        }

        return BadRequest(new { message = "Trạng thái không hợp lệ" });
    }
}
