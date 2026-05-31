using Blog.Application.Dtos;
using Blog.Infrastructure.Data;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/search")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IGeminiService _geminiService;

    public SearchController(AppDbContext context, IGeminiService geminiService)
    {
        _context = context;
        _geminiService = geminiService;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new SearchResultDto());

        var query = q.ToLower();
        Guid? searchId = null;
        if (Guid.TryParse(q, out var guid)) searchId = guid;

        var users = await _context.Users
            .Where(u =>
                (u.Username != null && u.Username.ToLower().Contains(query)) ||
                (u.FullName != null && u.FullName.ToLower().Contains(query)) ||
                (searchId.HasValue && u.Id == searchId.Value))
            .Take(10)
            .Select(u => new UserSearchResult
            {
                Id = u.Id,
                Username = u.Username,
                FullName = u.FullName,
                AvatarUrl = u.AvatarUrl,
                Bio = u.Bio
            })
            .ToListAsync();

        var posts = await _context.Posts
            .Where(p =>
                p.Status == Blog.Domain.Entities.PostStatus.Published &&
                (
                    (p.Title != null && p.Title.ToLower().Contains(query)) ||
                    (p.Content != null && p.Content.ToLower().Contains(query)) ||
                    (searchId.HasValue && p.Id == searchId.Value)
                ))
            .Include(p => p.Author)
            .Take(10)
            .Select(p => new PostSearchResult
            {
                Id = p.Id,
                Title = p.Title,
                Summary = p.Summary,
                Content = p.Content,
                FeaturedImageUrl = p.FeaturedImageUrl,
                AuthorName = p.Author != null ? p.Author.FullName : "Người dùng",
                AuthorAvatarUrl = p.Author != null ? p.Author.AvatarUrl : null,
                LikeCount = p.LikeCount,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(new SearchResultDto
        {
            Users = users,
            Posts = posts
        });
    }

    [HttpGet("ai")]
    public async Task<IActionResult> SearchAi([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<object>());

        // 1. Fetch recent posts and products to search semantically
        var posts = await _context.Posts
            .Where(p => p.Status == Blog.Domain.Entities.PostStatus.Published)
            .OrderByDescending(p => p.CreatedAt)
            .Take(30)
            .Select(p => new { p.Id, p.Title, p.Summary, p.Content })
            .ToListAsync();

        var products = await _context.Products
            .OrderByDescending(p => p.CreatedAt)
            .Take(30)
            .Select(p => new { p.Id, p.Name, p.Description, p.Price })
            .ToListAsync();

        // 2. Prepare summary text for Gemini
        var items = new List<object>();
        foreach (var p in posts)
        {
            items.Add(new { id = p.Id, type = "Post", title = p.Title, summary = p.Summary, content = p.Content });
        }
        foreach (var p in products)
        {
            items.Add(new { id = p.Id, type = "Product", title = p.Name, content = p.Description, price = p.Price });
        }

        var itemsJson = JsonSerializer.Serialize(items);
        
        // 3. Call Gemini API to rank
        var rankedJson = await _geminiService.RankSearchResultsAsync(q, itemsJson);
        
        var results = new List<AiSearchResultItemDto>();
        try
        {
            using var doc = JsonDocument.Parse(rankedJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in doc.RootElement.EnumerateArray())
                 {
                    if (el.TryGetProperty("id", out var idProp) && Guid.TryParse(idProp.GetString(), out var id) &&
                        el.TryGetProperty("type", out var typeProp) && el.TryGetProperty("score", out var scoreProp) &&
                        el.TryGetProperty("explanation", out var expProp))
                    {
                        results.Add(new AiSearchResultItemDto
                        {
                            Id = id,
                            Type = typeProp.GetString() ?? string.Empty,
                            Score = scoreProp.GetDouble(),
                            Explanation = expProp.GetString() ?? string.Empty
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SearchController] Error parsing Gemini rank JSON: {ex.Message}");
        }

        // 4. Fallback if Gemini failed or didn't return any matches
        if (results.Count == 0)
        {
            var queryLower = q.ToLower();
            var matchedPosts = posts
                .Where(p => (p.Title != null && p.Title.ToLower().Contains(queryLower)) || (p.Content != null && p.Content.ToLower().Contains(queryLower)))
                .Take(5);
            foreach (var p in matchedPosts)
            {
                results.Add(new AiSearchResultItemDto
                {
                    Id = p.Id,
                    Type = "Post",
                    Score = 0.8,
                    Explanation = "Trùng khớp từ khóa trong nội dung bài viết."
                });
            }
            
            var matchedProducts = products
                .Where(p => (p.Name != null && p.Name.ToLower().Contains(queryLower)) || (p.Description != null && p.Description.ToLower().Contains(queryLower)))
                .Take(5);
            foreach (var p in matchedProducts)
            {
                results.Add(new AiSearchResultItemDto
                {
                    Id = p.Id,
                    Type = "Product",
                    Score = 0.8,
                    Explanation = "Trùng khớp từ khóa trong thông tin sản phẩm."
                });
            }
        }

        // 5. Load full data for matched entities
        var postIds = results.Where(r => r.Type == "Post").Select(r => r.Id).ToList();
        var productIds = results.Where(r => r.Type == "Product").Select(r => r.Id).ToList();

        var fullPosts = await _context.Posts
            .Where(p => postIds.Contains(p.Id))
            .Include(p => p.Author)
            .ToListAsync();

        var fullProducts = await _context.Products
            .Where(p => productIds.Contains(p.Id))
            .Include(p => p.Shop)
            .ToListAsync();

        // 6. Assemble in original ranked order
        var finalResults = new List<object>();
        foreach (var res in results)
        {
            if (res.Type == "Post")
            {
                var post = fullPosts.FirstOrDefault(p => p.Id == res.Id);
                if (post != null)
                {
                    finalResults.Add(new
                    {
                        item = new PostSearchResult
                        {
                            Id = post.Id,
                            Title = post.Title,
                            Summary = post.Summary,
                            Content = post.Content,
                            FeaturedImageUrl = post.FeaturedImageUrl,
                            AuthorName = post.Author != null ? post.Author.FullName : "Người dùng",
                            AuthorAvatarUrl = post.Author != null ? post.Author.AvatarUrl : null,
                            LikeCount = post.LikeCount,
                            CreatedAt = post.CreatedAt
                        },
                        type = "Post",
                        score = res.Score,
                        explanation = res.Explanation
                    });
                }
            }
            else if (res.Type == "Product")
            {
                var prod = fullProducts.FirstOrDefault(p => p.Id == res.Id);
                if (prod != null)
                {
                    finalResults.Add(new
                    {
                        item = new
                        {
                            prod.Id,
                            prod.Name,
                            prod.Description,
                            prod.Price,
                            prod.Stock,
                            prod.FeaturedImageUrl,
                            ShopName = prod.Shop != null ? prod.Shop.Name : "Cửa hàng Zynk"
                        },
                        type = "Product",
                        score = res.Score,
                        explanation = res.Explanation
                    });
                }
            }
        }

        return Ok(finalResults);
    }

    [HttpGet("chat")]
    public async Task<IActionResult> ChatAi([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { message = "Nội dung câu hỏi không được trống." });

        // Fetch recent items to give Gemini context about what's currently on Zynk
        var posts = await _context.Posts
            .Where(p => p.Status == Blog.Domain.Entities.PostStatus.Published)
            .OrderByDescending(p => p.CreatedAt)
            .Take(15)
            .Select(p => new { p.Id, p.Title, p.Summary })
            .ToListAsync();

        var products = await _context.Products
            .OrderByDescending(p => p.CreatedAt)
            .Take(15)
            .Select(p => new { p.Id, p.Name, p.Price })
            .ToListAsync();

        var contextJson = JsonSerializer.Serialize(new { posts, products });

        var prompt = $@"
Bạn là Trợ lý ảo Zynk AI, một chatbot thân thiện và hữu ích trên nền tảng Zynk.
Nhiệm vụ của bạn là trả lời câu hỏi của người dùng và tư vấn sản phẩm hoặc bài viết phù hợp.

Dưới đây là danh sách một số bài viết và sản phẩm mới nhất trên hệ thống Zynk hiện tại:
{contextJson}

Hãy trả lời câu hỏi sau của người dùng bằng tiếng Việt, xưng hô là 'Em' hoặc 'Zynk AI' và gọi người dùng là 'Anh/Chị' hoặc 'Bạn'.
Nếu người dùng tìm kiếm hoặc hỏi về nội dung trùng khớp với danh sách trên, hãy gợi ý tên cụ thể của bài viết/sản phẩm đó.

Câu hỏi của người dùng: ""{q}""
";

        var responseText = await _geminiService.CallGeminiAsync(prompt);
        return Ok(new { response = responseText });
    }
}
