using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketplaceController : ControllerBase
{
    private readonly IProductRepository _productRepository;
    private readonly IRepository<Category> _categoryRepository;

    public MarketplaceController(
        IProductRepository productRepository,
        IRepository<Category> categoryRepository)
    {
        _productRepository = productRepository;
        _categoryRepository = categoryRepository;
    }

    [HttpGet("products")]
    public async Task<IActionResult> GetProducts([FromQuery] Guid? categoryId)
    {
        IEnumerable<Product> products;
        if (categoryId.HasValue)
        {
            products = await _productRepository.GetProductsByCategoryAsync(categoryId.Value);
        }
        else
        {
            products = await _productRepository.GetFeaturedProductsAsync(50);
        }

        var dtos = products.Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Price = p.Price,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ShopName = p.Shop?.Name ?? "N/A",
            CategoryName = p.Category?.Name ?? "Khác",
            Rating = p.Rating,
            SalesCount = p.SalesCount
        });

        return Ok(dtos);
    }

    [HttpGet("products/{id}")]
    public async Task<IActionResult> GetProductById(Guid id)
    {
        var p = await _productRepository.GetByIdAsync(id);
        if (p == null) return NotFound();

        var dto = new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Price = p.Price,
            Stock = p.Stock,
            Description = p.Description,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ShopName = p.Shop?.Name ?? "N/A",
            CategoryName = p.Category?.Name ?? "Khác",
            Rating = p.Rating,
            SalesCount = p.SalesCount,
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            Variants = p.Variants.Select(v => new ProductVariantDto
            {
                Id = v.Id,
                Name = v.Name,
                PriceOverride = v.PriceOverride,
                Stock = v.Stock
            }).ToList()
        };

        return Ok(dto);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var cats = await _categoryRepository.GetAllAsync();
        var dtos = cats.Select(c => new CategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Slug = c.Slug,
            Icon = c.Icon
        });
        return Ok(dtos);
    }
}
