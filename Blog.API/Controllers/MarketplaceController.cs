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
    public async Task<IActionResult> GetProducts(
        [FromQuery] Guid? categoryId,
        [FromQuery] string? keyword,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? sortBy)
    {
        var query = _context.Products
            .Include(p => p.Shop)
            .Include(p => p.Category)
            .Where(p => p.Status == ProductStatus.Active && !p.Shop.IsSuspended);

        // 1. Filter by categoryId (hierarchical)
        if (categoryId.HasValue)
        {
            var categoryIds = await GetCategoryIdsRecursive(categoryId.Value);
            query = query.Where(p => categoryIds.Contains(p.CategoryId));
        }

        // 2. Filter by keyword (Name, Description, or Category Name)
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var kw = keyword.ToLower();
            
            // Find categories matching keyword to include their products
            var matchingCats = await _context.Categories
                .Where(c => c.Name.ToLower().Contains(kw))
                .ToListAsync();
            
            var allMatchingCatIds = new List<Guid>();
            foreach(var cat in matchingCats)
            {
                allMatchingCatIds.AddRange(await GetCategoryIdsRecursive(cat.Id));
            }
            allMatchingCatIds = allMatchingCatIds.Distinct().ToList();

            query = query.Where(p => p.Name.ToLower().Contains(kw) || 
                                    p.Description.ToLower().Contains(kw) || 
                                    allMatchingCatIds.Contains(p.CategoryId));
        }

        // 3. Filter by Price
        if (minPrice.HasValue) query = query.Where(p => p.Price >= minPrice.Value);
        if (maxPrice.HasValue) query = query.Where(p => p.Price <= maxPrice.Value);

        // 4. Sorting
        switch (sortBy?.ToLower())
        {
            case "price_asc": query = query.OrderBy(p => p.Price); break;
            case "price_desc": query = query.OrderByDescending(p => p.Price); break;
            case "rating_desc": query = query.OrderByDescending(p => p.Rating); break;
            case "sales_desc": query = query.OrderByDescending(p => p.SalesCount); break;
            default: query = query.OrderByDescending(p => p.CreatedAt); break;
        }

        var products = await query.ToListAsync();

        var dtos = products.Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Price = p.Price,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ShopName = p.Shop?.Name ?? "N/A",
            ShopId = p.ShopId,
            ShopOwnerId = p.Shop?.UserId ?? Guid.Empty,
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
        var p = await _context.Products
            .Include(p => p.Shop)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(x => x.Id == id && !x.Shop.IsSuspended);

        if (p == null) return NotFound();

        var dto = new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Price = p.Price,
            Stock = p.Stock,
            Description = p.Description,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ShopId = p.ShopId,
            ShopOwnerId = p.Shop?.UserId ?? Guid.Empty,
            ShopName = p.Shop?.Name ?? "N/A",
            CategoryName = p.Category?.Name ?? "Khác",
            Rating = p.Rating,
            SalesCount = p.SalesCount,
            VariantGroupName1 = p.VariantGroupName1,
            VariantGroupName2 = p.VariantGroupName2,
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            Variants = p.Variants.Select(v => new ProductVariantDto
            {
                Id = v.Id,
                Name = v.Name,
                Color = v.Color,
                Size = v.Size,
                ImageUrl = v.ImageUrl,
                PriceOverride = v.PriceOverride,
                Stock = v.Stock
            }).ToList()
        };

        // Get 5 most recent reviews
        dto.RecentReviews = await _context.ProductReviews
            .Include(r => r.User)
            .Include(r => r.Images)
            .Where(r => r.ProductId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Take(5)
            .Select(r => new ProductReviewDto
            {
                Id = r.Id,
                UserName = r.User.Username,
                UserAvatar = r.User.AvatarUrl,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                ImageUrls = r.Images.Select(i => i.Url).ToList()
            }).ToListAsync();

        return Ok(dto);
    }

    [HttpGet("products/{id}/reviews")]
    public async Task<IActionResult> GetProductReviews(Guid id)
    {
        var reviews = await _context.ProductReviews
            .Include(r => r.User)
            .Include(r => r.Images)
            .Where(r => r.ProductId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ProductReviewDto
            {
                Id = r.Id,
                UserName = r.User.Username,
                UserAvatar = r.User.AvatarUrl,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                ImageUrls = r.Images.Select(i => i.Url).ToList()
            }).ToListAsync();

        return Ok(reviews);
    }

    [HttpGet("products/{id}/review-stats")]
    public async Task<IActionResult> GetProductReviewStats(Guid id)
    {
        var reviews = await _context.ProductReviews
            .Where(r => r.ProductId == id)
            .ToListAsync();

        var stats = new ProductReviewStatsDto
        {
            TotalReviews = reviews.Count,
            AverageRating = reviews.Any() ? reviews.Average(r => r.Rating) : 0,
            StarCounts = reviews.GroupBy(r => r.Rating)
                .ToDictionary(g => g.Key, g => g.Count())
        };

        for (int i = 1; i <= 5; i++)
        {
            if (!stats.StarCounts.ContainsKey(i)) stats.StarCounts[i] = 0;
        }

        return Ok(stats);
    }

    [HttpGet("products/{id}/check-review-eligibility")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> CheckReviewEligibility(Guid id)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        var userId = Guid.Parse(userIdStr);
        
        var hasPurchased = await _context.OrderItems
            .Include(oi => oi.Order)
            .AnyAsync(oi => oi.ProductId == id && 
                           oi.Order.BuyerId == userId && 
                           (oi.Order.Status == OrderStatus.Delivered || oi.Order.Status == OrderStatus.Completed));

        var alreadyReviewed = await _context.ProductReviews
            .AnyAsync(r => r.ProductId == id && r.UserId == userId);
        
        return Ok(new { eligible = hasPurchased && !alreadyReviewed });
    }

    [HttpPost("products/{id}/reviews")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> SubmitReview(Guid id, [FromBody] CreateProductReviewDto dto)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        var userId = Guid.Parse(userIdStr);

        var hasPurchased = await _context.OrderItems
            .Include(oi => oi.Order)
            .AnyAsync(oi => oi.ProductId == id && 
                           oi.Order.BuyerId == userId && 
                           (oi.Order.Status == OrderStatus.Delivered || oi.Order.Status == OrderStatus.Completed));

        if (!hasPurchased)
        {
            return BadRequest(new { message = "Bạn chỉ có thể đánh giá sau khi đã nhận được sản phẩm này." });
        }

        var alreadyReviewed = await _context.ProductReviews
            .AnyAsync(r => r.ProductId == id && r.UserId == userId);
        
        if (alreadyReviewed)
        {
            return BadRequest(new { message = "Bạn đã đánh giá sản phẩm này rồi." });
        }

        var review = new ProductReview
        {
            Id = Guid.NewGuid(),
            ProductId = id,
            UserId = userId,
            Rating = dto.Rating,
            Comment = dto.Comment,
            CreatedAt = DateTime.UtcNow,
            Images = dto.ImageUrls.Select(url => new ProductReviewImage
            {
                Id = Guid.NewGuid(),
                Url = url
            }).ToList()
        };

        _context.ProductReviews.Add(review);

        var product = await _context.Products.FindAsync(id);
        if (product != null)
        {
            var allRatings = await _context.ProductReviews
                .Where(r => r.ProductId == id)
                .Select(r => r.Rating)
                .ToListAsync();
            allRatings.Add(dto.Rating);
            product.Rating = allRatings.Average();
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Cảm ơn bạn đã đánh giá sản phẩm!" });
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
