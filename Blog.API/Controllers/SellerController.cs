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
            Images = dto.ImageUrls.Select((url, index) => new ProductImage
            {
                Id = Guid.NewGuid(),
                Url = url,
                OrderIndex = index
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

    [HttpGet("incoming-orders")]
    public async Task<IActionResult> GetIncomingOrders()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var shop = await _shopRepository.GetByUserIdAsync(userId);
        if (shop == null) return Forbid();

        var orders = await _orderRepository.GetOrdersByShopIdAsync(shop.Id);
        return Ok(orders);
    }
}
