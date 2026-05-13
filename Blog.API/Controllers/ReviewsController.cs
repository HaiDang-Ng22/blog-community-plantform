using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReviewsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("product/{productId}")]
    public async Task<IActionResult> GetProductReviews(Guid productId)
    {
        var reviews = await _context.ProductReviews
            .Include(r => r.User)
            .Include(r => r.Images)
            .Where(r => r.ProductId == productId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ProductReviewDto
            {
                Id = r.Id,
                UserName = r.User.FullName ?? r.User.Username,
                UserAvatar = r.User.AvatarUrl,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                ImageUrls = r.Images.Select(i => i.Url).ToList()
            })
            .ToListAsync();

        var stats = new ProductReviewStatsDto
        {
            TotalReviews = reviews.Count,
            AverageRating = reviews.Any() ? reviews.Average(r => r.Rating) : 0,
            StarCounts = reviews.GroupBy(r => r.Rating).ToDictionary(g => g.Key, g => g.Count())
        };

        return Ok(new { reviews, stats });
    }

    [HttpPost("product/{productId}")]
    [Authorize]
    public async Task<IActionResult> CreateReview(Guid productId, [FromBody] CreateProductReviewDto dto)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        // Check if user bought the product
        var hasBought = await _context.Orders
            .AnyAsync(o => o.BuyerId == userId && 
                           (o.Status == OrderStatus.Completed || o.Status == OrderStatus.Delivered) &&
                           o.Items.Any(i => i.ProductId == productId));

        if (!hasBought)
            return BadRequest(new { message = "Bạn cần mua và nhận được sản phẩm để đánh giá." });

        // Check if already reviewed
        var existing = await _context.ProductReviews.FirstOrDefaultAsync(r => r.ProductId == productId && r.UserId == userId);
        if (existing != null)
            return BadRequest(new { message = "Bạn đã đánh giá sản phẩm này rồi." });

        var review = new ProductReview
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
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
        await _context.SaveChangesAsync();

        return Ok(new { message = "Cảm ơn bạn đã đánh giá sản phẩm!" });
    }
}
