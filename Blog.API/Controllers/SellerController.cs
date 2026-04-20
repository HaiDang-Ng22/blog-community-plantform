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
public class SellerController : ControllerBase
{
    private readonly IShopRepository _shopRepository;
    private readonly IRepository<ShopApplication> _appRepository;
    private readonly IProductRepository _productRepository;
    private readonly IRepository<ProductImage> _imageRepository;
    private readonly IOrderRepository _orderRepository;

    public SellerController(
        IShopRepository shopRepository,
        IRepository<ShopApplication> appRepository,
        IProductRepository productRepository,
        IRepository<ProductImage> imageRepository,
        IOrderRepository orderRepository)
    {
        _shopRepository = shopRepository;
        _appRepository = appRepository;
        _productRepository = productRepository;
        _imageRepository = imageRepository;
        _orderRepository = orderRepository;
    }

    [HttpPost("apply")]
    public async Task<IActionResult> ApplyForShop([FromBody] ShopApplicationDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        
        var existing = await _appRepository.FindAsync(a => a.UserId == userId && a.Status == ShopApplicationStatus.Pending);
        if (existing.Any()) return BadRequest(new { message = "Bạn đã có khảo sát đang chờ duyệt." });

        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop != null) return BadRequest(new { message = "Bạn đã sở hữu một cửa hàng." });

        var app = new ShopApplication
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ShopName = dto.ShopName,
            Description = dto.Description,
            Status = ShopApplicationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        await _appRepository.AddAsync(app);
        return Ok(new { message = "Gửi đơn đăng ký thành công. Vui lòng chờ Admin duyệt." });
    }

    [HttpGet("application-status")]
    public async Task<IActionResult> GetApplicationStatus()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var apps = await _appRepository.FindAsync(a => a.UserId == userId);
        return Ok(apps.OrderByDescending(a => a.CreatedAt).FirstOrDefault());
    }

    [HttpGet("my-shop")]
    public async Task<IActionResult> GetMyShop()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return NotFound(new { message = "Bạn chưa có cửa hàng." });
        return Ok(shop);
    }

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();

        var slug = dto.Name.ToLower().Replace(" ", "-") + "-" + Guid.NewGuid().ToString().Substring(0, 8);
        
        var product = new Product
        {
            Id = Guid.NewGuid(),
            ShopId = shop.Id,
            CategoryId = dto.CategoryId,
            Name = dto.Name,
            Slug = slug,
            Description = dto.Description,
            Price = dto.Price,
            Stock = dto.Stock,
            FeaturedImageUrl = dto.ImageUrls.FirstOrDefault(),
            CreatedAt = DateTime.UtcNow,
            VariantGroupName1 = dto.VariantGroupName1,
            VariantGroupName2 = dto.VariantGroupName2,
            Images = dto.ImageUrls.Select((url, index) => new ProductImage
            {
                Id = Guid.NewGuid(),
                Url = url,
                OrderIndex = index
            }).ToList(),
            Variants = dto.Variants.Select(v => new ProductVariant
            {
                Id = Guid.NewGuid(),
                Name = v.Name,
                Color = v.Color,
                Size = v.Size,
                ImageUrl = v.ImageUrl,
                PriceOverride = v.PriceOverride,
                Stock = v.Stock
            }).ToList()
        };

        await _productRepository.AddAsync(product);
        return Ok(new { message = "Đăng sản phẩm thành công", id = product.Id });
    }

    [HttpGet("my-products")]
    public async Task<IActionResult> GetMyProducts()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();

        var products = await _productRepository.GetProductsByShopIdAsync(shop.Id);
        return Ok(products);
    }

    [HttpPut("products/{id}")]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] UpdateProductDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();

        var product = await _productRepository.GetByIdAsync(id);
        if (product == null) return NotFound(new { message = "Không tìm thấy sản phẩm." });
        if (product.ShopId != shop.Id) return Forbid();

        product.Name = dto.Name;
        product.Description = dto.Description;
        product.Price = dto.Price;
        product.Stock = dto.Stock;
        product.CategoryId = dto.CategoryId;
        product.FeaturedImageUrl = dto.ImageUrls.FirstOrDefault() ?? product.FeaturedImageUrl;
        product.VariantGroupName1 = dto.VariantGroupName1;
        product.VariantGroupName2 = dto.VariantGroupName2;
        product.UpdatedAt = DateTime.UtcNow;

        // Update Images
        product.Images.Clear();
        product.Images = dto.ImageUrls.Select((url, index) => new ProductImage
        {
            Id = Guid.NewGuid(),
            ProductId = id,
            Url = url,
            OrderIndex = index
        }).ToList();

        // Update Variants
        product.Variants.Clear();
        product.Variants = dto.Variants.Select(v => new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = id,
            Name = v.Name,
            Color = v.Color,
            Size = v.Size,
            ImageUrl = v.ImageUrl,
            PriceOverride = v.PriceOverride,
            Stock = v.Stock
        }).ToList();

        await _productRepository.UpdateAsync(product);
        return Ok(new { message = "Cập nhật sản phẩm thành công." });
    }

    [HttpDelete("products/{id}")]
    public async Task<IActionResult> DeleteProduct(Guid id)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();

        var product = await _productRepository.GetByIdAsync(id);
        if (product == null) return NotFound(new { message = "Không tìm thấy sản phẩm." });
        if (product.ShopId != shop.Id) return Forbid();

        await _productRepository.DeleteAsync(product);
        return Ok(new { message = "Đã xóa sản phẩm thành công." });
    }

    [HttpGet("incoming-orders")]
    public async Task<IActionResult> GetIncomingOrders([FromQuery] string? status = null, [FromQuery] string? keyword = null)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();

        var orders = await _orderRepository.SearchOrdersAsync(shop.Id, status, keyword);
        
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
            Items = o.Items.Select(i => new OrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                VariantId = i.VariantId,
                ProductName = i.Product.Name,
                VariantName = i.Variant?.Name,
                ProductImageUrl = i.Product.FeaturedImageUrl,
                UnitPrice = i.UnitPrice,
                Quantity = i.Quantity
            }).ToList()
        });

        return Ok(dtos);
    }
}
