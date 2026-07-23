using Blog.Application.Dtos;
using Blog.Application.Dtos.AiChat;
using Blog.Application.Services;
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
    private readonly IAiShoppingAssistantService _aiShoppingAssistantService;

    public SearchController(AppDbContext context, IGeminiService geminiService, IAiShoppingAssistantService aiShoppingAssistantService)
    {
        _context = context;
        _geminiService = geminiService;
        _aiShoppingAssistantService = aiShoppingAssistantService;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new SearchResultDto());

        var rawQuery = q.Trim().ToLower();
        var normQuery = RemoveDiacritics(rawQuery);
        Guid? searchId = null;
        if (Guid.TryParse(q, out var guid)) searchId = guid;

        // 1. Users Search (Accent-insensitive)
        var rawUsers = await _context.Users
            .Take(100)
            .Select(u => new UserSearchResult
            {
                Id = u.Id,
                Username = u.Username ?? string.Empty,
                FullName = u.FullName ?? string.Empty,
                AvatarUrl = u.AvatarUrl,
                Bio = u.Bio
            })
            .ToListAsync();

        var users = rawUsers
            .Where(u =>
                (searchId.HasValue && u.Id == searchId.Value) ||
                (!string.IsNullOrEmpty(u.Username) && u.Username.ToLower().Contains(rawQuery)) ||
                (!string.IsNullOrEmpty(u.FullName) && (
                    u.FullName.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(u.FullName).ToLower().Contains(normQuery)
                ))
            )
            .Take(10)
            .ToList();

        // 2. Posts Search (Accent-insensitive)
        var rawPosts = await _context.Posts
            .Where(p => p.Status == Blog.Domain.Entities.PostStatus.Published)
            .Include(p => p.Author)
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .ToListAsync();

        var posts = rawPosts
            .Where(p =>
                (searchId.HasValue && p.Id == searchId.Value) ||
                (!string.IsNullOrEmpty(p.Title) && (
                    p.Title.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(p.Title).ToLower().Contains(normQuery)
                )) ||
                (!string.IsNullOrEmpty(p.Content) && (
                    p.Content.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(p.Content).ToLower().Contains(normQuery)
                ))
            )
            .Take(10)
            .Select(p => new PostSearchResult
            {
                Id = p.Id,
                Title = p.Title ?? string.Empty,
                Summary = p.Summary,
                Content = p.Content,
                FeaturedImageUrl = p.FeaturedImageUrl,
                AuthorName = p.Author != null ? p.Author.FullName : "Người dùng",
                AuthorAvatarUrl = p.Author != null ? p.Author.AvatarUrl : null,
                LikeCount = p.LikeCount,
                CreatedAt = p.CreatedAt
            })
            .ToList();

        // 3. Reels Search (Posts with video/reels content)
        var reels = rawPosts
            .Where(p => p.Type == "Reel" || !string.IsNullOrEmpty(p.VideoUrl))
            .Where(p =>
                (!string.IsNullOrEmpty(p.Title) && (p.Title.ToLower().Contains(rawQuery) || RemoveDiacritics(p.Title).ToLower().Contains(normQuery))) ||
                (!string.IsNullOrEmpty(p.Content) && (p.Content.ToLower().Contains(rawQuery) || RemoveDiacritics(p.Content).ToLower().Contains(normQuery)))
            )
            .Take(10)
            .Select(p => new ReelSearchResult
            {
                Id = p.Id,
                Title = p.Title ?? string.Empty,
                VideoUrl = p.VideoUrl,
                FeaturedImageUrl = p.FeaturedImageUrl,
                ImageUrls = p.ImageUrls ?? new List<string>(),
                AuthorName = p.Author != null ? p.Author.FullName : "Người dùng",
                AuthorAvatarUrl = p.Author != null ? p.Author.AvatarUrl : null,
                LikeCount = p.LikeCount
            })
            .ToList();

        // 4. Hashtags Search
        var rawTags = await _context.Tags
            .Include(t => t.PostTags)
            .Take(50)
            .Select(t => new HashtagSearchResult
            {
                Name = t.Name ?? string.Empty,
                PostCount = t.PostTags != null ? t.PostTags.Count : 0
            })
            .ToListAsync();

        var cleanQueryTag = rawQuery.StartsWith("#") ? rawQuery.Substring(1) : rawQuery;
        var normQueryTag = RemoveDiacritics(cleanQueryTag);

        var hashtags = rawTags
            .Where(t =>
                !string.IsNullOrEmpty(t.Name) && (
                    t.Name.ToLower().Contains(cleanQueryTag) ||
                    RemoveDiacritics(t.Name).ToLower().Contains(normQueryTag)
                )
            )
            .Take(10)
            .ToList();

        if (hashtags.Count == 0 && !string.IsNullOrWhiteSpace(cleanQueryTag))
        {
            hashtags.Add(new HashtagSearchResult { Name = cleanQueryTag, PostCount = posts.Count });
        }

        // 5. Groups Search
        var rawGroups = await _context.Groups
            .Include(g => g.Members)
            .Take(50)
            .Select(g => new GroupSearchResult
            {
                Id = g.Id,
                Name = g.Name ?? string.Empty,
                Description = g.Description,
                AvatarUrl = g.AvatarUrl,
                MemberCount = g.Members != null ? g.Members.Count : 0,
                IsPublic = g.IsPublic
            })
            .ToListAsync();

        var groups = rawGroups
            .Where(g =>
                !string.IsNullOrEmpty(g.Name) && (
                    g.Name.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(g.Name).ToLower().Contains(normQuery)
                )
            )
            .Take(10)
            .ToList();

        // 6. Products Search
        var rawProducts = await _context.Products
            .Include(p => p.Shop)
            .Take(50)
            .ToListAsync();

        var products = rawProducts
            .Where(p =>
                (!string.IsNullOrEmpty(p.Name) && (
                    p.Name.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(p.Name).ToLower().Contains(normQuery)
                )) ||
                (!string.IsNullOrEmpty(p.Description) && (
                    p.Description.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(p.Description).ToLower().Contains(normQuery)
                ))
            )
            .Take(10)
            .Select(p => new ProductSearchResult
            {
                Id = p.Id,
                Name = p.Name ?? string.Empty,
                Description = p.Description,
                Price = p.Price,
                FeaturedImageUrl = p.FeaturedImageUrl,
                ShopName = p.Shop != null ? p.Shop.Name : "Cửa hàng Zynk"
            })
            .ToList();

        // 7. Shops Search
        var rawShops = await _context.Shops
            .Include(s => s.Products)
            .Take(50)
            .Select(s => new ShopSearchResult
            {
                Id = s.Id,
                Name = s.Name ?? string.Empty,
                Description = s.Description,
                AvatarUrl = s.LogoUrl,
                IsVerified = s.IsApproved,
                Rating = 5.0,
                FollowerCount = 120,
                ProductCount = s.Products != null ? s.Products.Count : 0
            })
            .ToListAsync();

        var shops = rawShops
            .Where(s =>
                !string.IsNullOrEmpty(s.Name) && (
                    s.Name.ToLower().Contains(rawQuery) ||
                    RemoveDiacritics(s.Name).ToLower().Contains(normQuery)
                )
            )
            .Take(10)
            .ToList();

        return Ok(new SearchResultDto
        {
            Users = users,
            Posts = posts,
            Reels = reels,
            Hashtags = hashtags,
            Groups = groups,
            Products = products,
            Shops = shops
        });
    }

    private static string RemoveDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalizedString = text.Normalize(System.Text.NormalizationForm.FormD);
        var stringBuilder = new System.Text.StringBuilder();
        foreach (var c in normalizedString)
        {
            var unicodeCategory = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != System.Globalization.UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }
        return stringBuilder.ToString().Normalize(System.Text.NormalizationForm.FormC).Replace('đ', 'd').Replace('Đ', 'D');
    }

    [HttpGet("ai")]
    public async Task<IActionResult> SearchAi([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<object>());

        // 1. Fetch recent posts and products to search semantically
        var posts = await _context.Posts
            .Where(p => p.Status == Blog.Domain.Entities.PostStatus.Published && p.GroupId == null)
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
            .Where(p => p.Status == Blog.Domain.Entities.PostStatus.Published && p.GroupId == null)
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

    [HttpPost("chat-products")]
    [Obsolete("Use AiChatController endpoints instead.")]
    public async Task<IActionResult> ChatProducts([FromBody] ChatProductsRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Question))
            return BadRequest(new { message = "Nội dung câu hỏi không được trống." });

        var clientMsgId = Guid.NewGuid();
        var session = await _aiShoppingAssistantService.CreateSessionAsync(null, "legacy-compat", HttpContext.RequestAborted);

        var serviceRequest = new AiChatRequestDto
        {
            SessionId = session.Id,
            AnonymousSessionId = "legacy-compat",
            Message = request.Question,
            ClientMessageId = clientMsgId
        };

        var response = await _aiShoppingAssistantService.SendMessageAsync(null, serviceRequest, HttpContext.RequestAborted);

        var responseGroups = response.Groups.Select(g => new
        {
            label = g.Label,
            type = g.Type,
            products = g.Products.Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                shopName = p.ShopName,
                p.FeaturedImageUrl,
                p.Rating,
                p.SalesCount
            }).ToList()
        }).ToList();

        var flatProducts = response.Groups.SelectMany(g => g.Products).Select(p => new
        {
            p.Id,
            p.Name,
            p.Description,
            p.Price,
            shopName = p.ShopName,
            p.FeaturedImageUrl,
            p.Rating,
            p.SalesCount
        }).DistinctBy(p => p.Id).ToList();

        return Ok(new
        {
            response = response.Response,
            groups = responseGroups,
            recommendedProducts = flatProducts
        });
    }
}

public class ChatProductsRequest
{
    public string Question { get; set; } = string.Empty;
    public List<ChatHistoryItemDto>? History { get; set; }
    public List<string>? SearchKeywords { get; set; }
}

public class ChatHistoryItemDto
{
    public string Sender { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}
