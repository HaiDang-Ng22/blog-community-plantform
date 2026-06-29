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
                p.GroupId == null &&
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
    public async Task<IActionResult> ChatProducts([FromBody] ChatProductsRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Question))
            return BadRequest(new { message = "Nội dung câu hỏi không được trống." });

        // 1. Fetch active products to serve as context and candidates
        var products = await _context.Products
            .Where(p => p.Status == Blog.Domain.Entities.ProductStatus.Active)
            .Include(p => p.Shop)
            .Include(p => p.Category)
            .OrderByDescending(p => p.SalesCount)
            .Take(40)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                ShopName = p.Shop != null ? p.Shop.Name : "Cửa hàng Zynk",
                CategoryName = p.Category != null ? p.Category.Name : "",
                p.FeaturedImageUrl,
                p.Rating,
                p.SalesCount
            })
            .ToListAsync();

        // 2. Prepare the prompt for Gemini
        var productsContext = products.Select(p => new
        {
            p.Id,
            p.Name,
            p.Description,
            p.Price,
            p.ShopName,
            p.CategoryName,
            p.Rating,
            p.SalesCount
        }).ToList();

        var historyContext = request.History != null ? 
            string.Join("\n", request.History.Select(h => $"{h.Sender}: {h.Text}")) : 
            "Không có lịch sử.";

        var prompt = $@"
Bạn là Trợ lý Mua sắm Zynk AI (Zynk Shop Assistant), một chuyên viên tư vấn bán hàng thông minh và nhiệt tình trên sàn thương mại điện tử Zynk.
Nhiệm vụ của bạn là trò chuyện với người dùng, hiểu nhu cầu của họ và gợi ý các sản phẩm phù hợp nhất trong danh sách sản phẩm hiện có dưới đây.

DANH SÁCH SẢN PHẨM HIỆN CÓ TRÊN HỆ THỐNG:
{JsonSerializer.Serialize(productsContext)}

LỊCH SỬ TRÒ CHUYỆN:
{historyContext}

CÂU HỎI MỚI NHẤT CỦA NGƯỜI DÙNG:
""{request.Question}""

YÊU CẦU:
1. Hãy trả lời người dùng bằng tiếng Việt tự nhiên, thân thiện, xưng hô là 'Em' hoặc 'Zynk AI' và gọi người dùng là 'Anh/Chị' hoặc 'Bạn'.
2. Chỉ gợi ý các sản phẩm thực sự tồn tại trong danh sách sản phẩm ở trên. Hãy giới thiệu ngắn gọn các ưu điểm nổi bật của chúng (như giá bán, shop nào bán, đánh giá bao nhiêu sao).
3. ĐƯA RA ĐỊNH DẠNG TRẢ VỀ: Bạn bắt buộc phải trả về một chuỗi JSON thuần chứa hai thuộc tính:
   - ""response"": Lời nhắn/câu trả lời của bạn gửi cho người dùng (hỗ trợ định dạng văn bản thường và icon sinh động).
   - ""recommendedProductIds"": Mảng các UUID của những sản phẩm được gợi ý (ví dụ: [""guid-1"", ""guid-2""]) để hệ thống hiển thị trực quan dưới dạng thẻ sản phẩm. Chỉ đưa vào danh sách này tối đa 3-4 sản phẩm phù hợp nhất. Nếu không có sản phẩm nào phù hợp, hãy để mảng này rỗng.
4. KHÔNG bọc mã trong thẻ ```json ... ```. Chỉ trả về chuỗi JSON thô duy nhất có dạng:
{{
  ""response"": ""Nội dung trả lời..."",
  ""recommendedProductIds"": [""id1"", ""id2""]
}}
";

        string responseText = "";
        bool parsedSuccess = false;
        var recommendedIds = new List<string>();

        try
        {
            // Call Gemini
            var rawResponse = await _geminiService.CallGeminiAsync(prompt);
            
            // Clean JSON markdown if any
            var cleanedJson = rawResponse.Trim();
            if (cleanedJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                cleanedJson = cleanedJson.Substring(7);
            else if (cleanedJson.StartsWith("```", StringComparison.OrdinalIgnoreCase))
                cleanedJson = cleanedJson.Substring(3);
            if (cleanedJson.EndsWith("```", StringComparison.OrdinalIgnoreCase))
                cleanedJson = cleanedJson.Substring(0, cleanedJson.Length - 3);
            cleanedJson = cleanedJson.Trim();

            // Try to parse
            using var doc = JsonDocument.Parse(cleanedJson);
            if (doc.RootElement.TryGetProperty("response", out var respProp))
            {
                responseText = respProp.GetString() ?? string.Empty;
                parsedSuccess = true;
            }
            if (doc.RootElement.TryGetProperty("recommendedProductIds", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in idsProp.EnumerateArray())
                {
                    var idStr = item.GetString();
                    if (!string.IsNullOrEmpty(idStr))
                    {
                        recommendedIds.Add(idStr);
                    }
                }
            }
            
            Console.WriteLine($"[ChatProducts] Gemini parsed OK. parsedSuccess={parsedSuccess}, responseLen={responseText.Length}, productIds={recommendedIds.Count}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ChatProducts] ERROR calling/parsing Gemini: {ex.GetType().Name} - {ex.Message}");
        }

        // 3. Fallback: smart keyword search if Gemini failed or gave empty recommendedProductIds
        if (!parsedSuccess || string.IsNullOrWhiteSpace(responseText))
        {
            // Split query into individual keywords for broader matching
            var keywords = request.Question.ToLower()
                .Split(new[] { ' ', ',', '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(k => k.Length > 1)
                .ToList();
            
            var matchedProducts = products
                .Where(p =>
                {
                    var searchable = $"{p.Name} {p.Description} {p.CategoryName} {p.ShopName}".ToLower();
                    return keywords.Any(k => searchable.Contains(k));
                })
                .OrderByDescending(p => {
                    // Score: more keyword hits = higher priority
                    var searchable = $"{p.Name} {p.Description} {p.CategoryName}".ToLower();
                    return keywords.Count(k => searchable.Contains(k));
                })
                .Take(3)
                .ToList();

            if (matchedProducts.Count > 0)
            {
                var q = request.Question;
                responseText = $"Chào bạn! 🔍 Em đã tìm thấy {matchedProducts.Count} sản phẩm liên quan đến \"{q}\" trong Zynk Shop. Bạn xem thử nhé: 😊";
                recommendedIds = matchedProducts.Select(p => p.Id.ToString()).ToList();
            }
            else
            {
                // Absolute fallback: show bestsellers
                responseText = $"Chào bạn! Em chưa tìm thấy sản phẩm khớp với \"{ request.Question }\". Nhưng đây là những sản phẩm bán chạy nhất hiện nay, bạn thử xem nhé! 🛒✨";
                recommendedIds = products.Take(3).Select(p => p.Id.ToString()).ToList();
            }
        }

        // 4. Map selected product details to return to frontend
        var recommendedProductsList = new List<object>();
        foreach (var idStr in recommendedIds)
        {
            if (Guid.TryParse(idStr, out var gId))
            {
                var prod = products.FirstOrDefault(p => p.Id == gId);
                if (prod != null)
                {
                    recommendedProductsList.Add(prod);
                }
            }
        }

        return Ok(new
        {
            response = responseText,
            recommendedProducts = recommendedProductsList
        });
    }
}

public class ChatProductsRequest
{
    public string Question { get; set; } = string.Empty;
    public List<ChatHistoryItemDto>? History { get; set; }
}

public class ChatHistoryItemDto
{
    public string Sender { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}
