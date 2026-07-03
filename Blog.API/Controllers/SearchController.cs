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

        // 1. Fetch active products (top 60 to give AI more to work with)
        var products = await _context.Products
            .Where(p => p.Status == Blog.Domain.Entities.ProductStatus.Active)
            .Include(p => p.Shop)
            .Include(p => p.Category)
            .OrderByDescending(p => p.Rating).ThenByDescending(p => p.SalesCount)
            .Take(60)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                ShopName = p.Shop != null ? p.Shop.Name : "Cửa hàng Zynk",
                CategoryName = p.Category != null ? p.Category.Name : "",
                CategoryId = p.Category != null ? p.Category.Id : (Guid?)null,
                p.FeaturedImageUrl,
                p.Rating,
                p.SalesCount
            })
            .ToListAsync();

        // Combine question + search keywords for richer context
        var allKeywords = new List<string>();
        if (request.SearchKeywords != null)
            allKeywords.AddRange(request.SearchKeywords.Where(k => !string.IsNullOrWhiteSpace(k)));
        // Also extract from the question itself
        allKeywords.AddRange(request.Question
            .ToLower()
            .Split(new[] { ' ', ',', '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(k => k.Length > 1));
        allKeywords = allKeywords.Distinct().ToList();

        var keywordsContext = allKeywords.Count > 0
            ? string.Join(", ", allKeywords)
            : request.Question;

        // 2. Build Gemini prompt asking for GROUPED recommendations
        var productsContext = products.Select(p => new
        {
            p.Id, p.Name, p.Description, p.Price,
            p.ShopName, p.CategoryName, p.Rating, p.SalesCount
        }).ToList();

        var historyContext = request.History != null && request.History.Count > 0
            ? string.Join("\n", request.History.TakeLast(6).Select(h => $"{h.Sender}: {h.Text}"))
            : "Không có lịch sử.";

        var prompt = $@"
Bạn là Trợ lý Mua sắm Zynk AI, chuyên viên tư vấn thông minh của sàn TMĐT Zynk.
Nhiệm vụ: Phân tích câu hỏi + lịch sử tìm kiếm của người dùng, sau đó GỢI Ý SẢN PHẨM THEO NHIỀU HẠNG MỤC từ danh sách dưới đây.

TỪ KHÓA TÌM KIẾM CỦA NGƯỜI DÙNG (kết hợp lịch sử + câu hỏi hiện tại): {keywordsContext}

LỊCH SỬ TRÒ CHUYỆN:
{historyContext}

CÂU HỎI MỚI NHẤT: ""{request.Question}""

DANH SÁCH SẢN PHẨM:
{JsonSerializer.Serialize(productsContext)}

YÊU CẦU OUTPUT (JSON thuần, không dùng ```json):
{{
  ""response"": ""Lời tư vấn nhiệt tình bằng tiếng Việt, xưng Em, gọi người dùng là Bạn. Nêu bật tại sao em gợi ý theo từng hạng mục."",
  ""groups"": [
    {{
      ""label"": ""⭐ Đánh giá cao nhất"",
      ""type"": ""top_rated"",
      ""productIds"": [""uuid"", ""uuid""]
    }},
    {{
      ""label"": ""🏷️ Cùng danh mục"",
      ""type"": ""same_category"",
      ""productIds"": [""uuid""]
    }},
    {{
      ""label"": ""🔍 Phù hợp nhất với tìm kiếm"",
      ""type"": ""relevant"",
      ""productIds"": [""uuid"", ""uuid""]
    }},
    {{
      ""label"": ""🔥 Sản phẩm tương tự"",
      ""type"": ""similar"",
      ""productIds"": [""uuid""]
    }}
  ]
}}

QUY TẮC:
- Mỗi group chứa tối đa 3 sản phẩm, tổng tất cả group tối đa 8 sản phẩm
- Một sản phẩm CÓ THỂ xuất hiện trong nhiều group nếu phù hợp
- Chỉ dùng ID từ danh sách đã cho, KHÔNG bịa ID
- Bỏ qua group nếu không tìm được sản phẩm phù hợp
- KHÔNG bọc trong ```json``` hay bất kỳ markdown nào
";

        string responseText = "";
        bool parsedSuccess = false;
        // groups: list of { label, type, productIds }
        var geminiGroups = new List<(string Label, string Type, List<string> Ids)>();

        try
        {
            var rawResponse = await _geminiService.CallGeminiAsync(prompt);

            // Strip markdown fences if present
            var cleanedJson = rawResponse.Trim();
            if (cleanedJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                cleanedJson = cleanedJson[7..];
            else if (cleanedJson.StartsWith("```"))
                cleanedJson = cleanedJson[3..];
            if (cleanedJson.EndsWith("```"))
                cleanedJson = cleanedJson[..^3];
            cleanedJson = cleanedJson.Trim();

            using var doc = JsonDocument.Parse(cleanedJson);

            if (doc.RootElement.TryGetProperty("response", out var rp))
            {
                responseText = rp.GetString() ?? "";
                parsedSuccess = true;
            }

            // Parse groups array
            if (doc.RootElement.TryGetProperty("groups", out var gp) && gp.ValueKind == JsonValueKind.Array)
            {
                foreach (var g in gp.EnumerateArray())
                {
                    var label = g.TryGetProperty("label", out var lp) ? lp.GetString() ?? "" : "";
                    var type  = g.TryGetProperty("type",  out var tp) ? tp.GetString() ?? "" : "";
                    var ids   = new List<string>();
                    if (g.TryGetProperty("productIds", out var ip) && ip.ValueKind == JsonValueKind.Array)
                        foreach (var i in ip.EnumerateArray())
                            if (!string.IsNullOrEmpty(i.GetString())) ids.Add(i.GetString()!);
                    if (ids.Count > 0)
                        geminiGroups.Add((label, type, ids));
                }
            }

            Console.WriteLine($"[ChatProducts] Gemini OK. groups={geminiGroups.Count}, responseLen={responseText.Length}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ChatProducts] ERROR: {ex.GetType().Name} — {ex.Message}");
        }

        // 3. Smart fallback: build groups locally if Gemini failed
        if (!parsedSuccess || geminiGroups.Count == 0)
        {
            // Score each product against all keywords
            Func<dynamic, int> score = p =>
            {
                var s = $"{p.Name} {p.Description} {p.CategoryName}".ToLower();
                return allKeywords.Count(k => s.Contains(k));
            };

            var matched = products
                .Where(p => score(p) > 0)
                .OrderByDescending(p => score(p))
                .Take(6)
                .ToList();

            if (matched.Count == 0) matched = products.Take(4).ToList();

            // Group 1: top rated in matched set
            var topRated = matched.Where(p => p.Rating >= 4.0f).OrderByDescending(p => p.Rating).Take(3).ToList();
            if (topRated.Count > 0)
                geminiGroups.Add(("⭐ Đánh giá cao nhất", "top_rated",
                    topRated.Select(p => p.Id.ToString()).ToList()));

            // Group 2: relevant (by keyword score)
            var relevant = matched.Take(3).ToList();
            if (relevant.Count > 0)
                geminiGroups.Add(("🔍 Phù hợp nhất", "relevant",
                    relevant.Select(p => p.Id.ToString()).ToList()));

            // Group 3: same category as first match
            if (matched.Count > 0)
            {
                var firstCatId = matched[0].CategoryId;
                if (firstCatId != null)
                {
                    var samecat = products
                        .Where(p => p.CategoryId == firstCatId && !matched.Select(m => m.Id).Contains(p.Id))
                        .OrderByDescending(p => p.SalesCount)
                        .Take(3)
                        .ToList();
                    if (samecat.Count > 0)
                        geminiGroups.Add(("🏷️ Cùng danh mục", "same_category",
                            samecat.Select(p => p.Id.ToString()).ToList()));
                }
            }

            // Group 4: bestsellers as "similar"
            var bestsellers = products
                .Where(p => !matched.Select(m => m.Id).Contains(p.Id))
                .OrderByDescending(p => p.SalesCount)
                .Take(3)
                .ToList();
            if (bestsellers.Count > 0)
                geminiGroups.Add(("🔥 Sản phẩm bán chạy", "similar",
                    bestsellers.Select(p => p.Id.ToString()).ToList()));

            responseText = matched.Count > 0
                ? $"Chào bạn! 🔍 Em đã tìm thấy các sản phẩm liên quan đến \"{request.Question}\" và chia thành nhiều hạng mục để bạn dễ lựa chọn nhé! 😊"
                : $"Chào bạn! Em chưa tìm được sản phẩm khớp hoàn toàn với \"{request.Question}\", nhưng đây là những gợi ý tốt nhất từ Zynk Shop cho bạn! 🛒✨";
        }

        // 4. Resolve product IDs → full objects, per group (deduplicate within each group)
        var productLookup = products.ToDictionary(p => p.Id.ToString(), p => (object)p);
        var responseGroups = new List<object>();
        var seenIdsTotal = new HashSet<string>(); // across all groups for the flat list

        foreach (var (label, type, ids) in geminiGroups)
        {
            var groupProducts = ids
                .Where(id => productLookup.ContainsKey(id))
                .Distinct()
                .Take(3)
                .Select(id => productLookup[id])
                .ToList();

            if (groupProducts.Count == 0) continue;

            responseGroups.Add(new { label, type, products = groupProducts });
            foreach (var id in ids) seenIdsTotal.Add(id);
        }

        // Also build a flat list of all unique recommended products (for backwards compat)
        var flatProducts = seenIdsTotal
            .Where(id => productLookup.ContainsKey(id))
            .Select(id => productLookup[id])
            .ToList();

        return Ok(new
        {
            response = responseText,
            groups = responseGroups,
            recommendedProducts = flatProducts  // kept for backwards compatibility
        });
    }
}

public class ChatProductsRequest
{
    public string Question { get; set; } = string.Empty;
    public List<ChatHistoryItemDto>? History { get; set; }
    /// <summary>Keywords from the user's main search bar history (localStorage)</summary>
    public List<string>? SearchKeywords { get; set; }
}

public class ChatHistoryItemDto
{
    public string Sender { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}
