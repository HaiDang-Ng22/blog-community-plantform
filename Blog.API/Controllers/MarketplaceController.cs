using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketplaceController : ControllerBase
{
    private readonly IProductRepository _productRepository;
    private readonly IRepository<Category> _categoryRepository;
    private readonly Blog.Infrastructure.Data.AppDbContext _context;

    public MarketplaceController(
        IProductRepository productRepository,
        IRepository<Category> categoryRepository,
        Blog.Infrastructure.Data.AppDbContext context)
    {
        _productRepository = productRepository;
        _categoryRepository = categoryRepository;
        _context = context;
    }

    [HttpGet("products")]
    public async Task<IActionResult> GetProducts([FromQuery] Guid? categoryId)
    {
        List<Product> products;
        if (categoryId.HasValue)
        {
            var categoryIds = await GetCategoryIdsRecursive(categoryId.Value);
            products = await _context.Products
                .Include(p => p.Shop)
                .Include(p => p.Category)
                .Where(p => categoryIds.Contains(p.CategoryId) && p.Status == ProductStatus.Active)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }
        else
        {
            var featured = await _productRepository.GetFeaturedProductsAsync(50);
            products = featured.ToList();
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

    private async Task<List<Guid>> GetCategoryIdsRecursive(Guid parentId)
    {
        var ids = new List<Guid> { parentId };
        var subCats = await _context.Categories
            .Where(c => c.ParentCategoryId == parentId)
            .ToListAsync();
        
        foreach (var sub in subCats)
        {
            ids.AddRange(await GetCategoryIdsRecursive(sub.Id));
        }
        return ids;
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
            Icon = c.Icon,
            ParentCategoryId = c.ParentCategoryId
        });
        return Ok(dtos);
    }
}
