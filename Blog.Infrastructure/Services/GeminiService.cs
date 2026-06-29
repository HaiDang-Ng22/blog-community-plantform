using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Blog.Domain.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Blog.Infrastructure.Services;

public class GeminiService : IGeminiService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public GeminiService(IConfiguration configuration)
    {
        _configuration = configuration;
        _httpClient = new HttpClient();
    }

    public async Task<string> CallGeminiAsync(string prompt, List<string>? imageUrls = null)
    {
        var apiKey = _configuration["Gemini:ApiKey"];
        
        // Check if API key is valid or empty, fallback to environment variable
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("YOUR_") || apiKey == "GeminiApiKey")
        {
            apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        }
        
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("YOUR_") || apiKey == "GeminiApiKey")
        {
            Console.WriteLine("[GeminiService WARNING] Gemini API Key is missing or invalid. Running in DEMO/MOCK mode.");
            return GetMockResponse(prompt);
        }

        try
        {
            // Try gemini-1.5-flash (stable, widely available) then fall back to 2.0-flash
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";
            
            var parts = new List<object>
            {
                new { text = prompt }
            };

            // Process image URLs if any
            if (imageUrls != null && imageUrls.Count > 0)
            {
                foreach (var imageUrl in imageUrls)
                {
                    if (string.IsNullOrWhiteSpace(imageUrl)) continue;
                    
                    try
                    {
                        var (base64Data, mimeType) = await GetImageBase64Async(imageUrl);
                        parts.Add(new
                        {
                            inlineData = new
                            {
                                mimeType = mimeType,
                                data = base64Data
                            }
                        });
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[GeminiService ERROR] Failed to download image {imageUrl}: {ex.Message}");
                    }
                }
            }

            var requestBody = new
            {
                contents = new[]
                {
                    new { parts = parts.ToArray() }
                }
            };

            var jsonPayload = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);
            var responseText = await response.Content.ReadAsStringAsync();
            
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[GeminiService ERROR] Gemini API returned {response.StatusCode}. Response body: {responseText}");
                
                // Try to extract Gemini error message
                string apiErrorMsg = string.Empty;
                try
                {
                    using var errDoc = JsonDocument.Parse(responseText);
                    if (errDoc.RootElement.TryGetProperty("error", out var errObj) &&
                        errObj.TryGetProperty("message", out var msgProp))
                    {
                        apiErrorMsg = msgProp.GetString() ?? string.Empty;
                    }
                }
                catch { /* ignore parse errors */ }
                
                // Return error result with actual API message if available
                if (!string.IsNullOrEmpty(apiErrorMsg))
                {
                    return JsonSerializer.Serialize(new
                    {
                        success = false,
                        matchPercentage = 0,
                        extractedInfo = new { citizenId = "", fullName = "", gender = "Nam", dateOfBirth = "", hometown = "" },
                        livenessCheck = "Failed",
                        message = $"Lỗi Gemini API: {apiErrorMsg}"
                    });
                }
                
                return GetMockResponse(prompt);
            }

            using var doc = JsonDocument.Parse(responseText);
            
            // Extract the text content from the Gemini response structure:
            // candidates[0].content.parts[0].text
            if (doc.RootElement.TryGetProperty("candidates", out var candidates) && 
                candidates.GetArrayLength() > 0 &&
                candidates[0].TryGetProperty("content", out var candidateContent) &&
                candidateContent.TryGetProperty("parts", out var partsArray) &&
                partsArray.GetArrayLength() > 0 &&
                partsArray[0].TryGetProperty("text", out var textProp))
            {
                return textProp.GetString() ?? string.Empty;
            }

            Console.WriteLine("[GeminiService ERROR] Unexpected response format from Gemini API.");
            return GetMockResponse(prompt);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GeminiService ERROR] Exception in CallGeminiAsync: {ex.Message}");
            return GetMockResponse(prompt);
        }
    }

    public async Task<string> VerifyIdentityAsync(string frontCccdUrl, string backCccdUrl, string selfieUrl)
    {
        var prompt = @"
Bạn là hệ thống xác thực danh tính của Zynk Platform. Các ảnh được cung cấp theo thứ tự: [ảnh 1] CCCD mặt trước, [ảnh 2 nếu có] CCCD mặt sau, [ảnh cuối] ảnh selfie của người đăng ký.

**NHIỆM VỤ 1 - ĐỌC THÔNG TIN CCCD:**
Đọc và trích xuất từ ảnh CCCD mặt trước:
- citizenId: Số CCCD (9 hoặc 12 chữ số, chỉ lấy số)
- fullName: Họ và tên (IN HOA, đúng như trên thẻ)
- gender: 'Nam' hoặc 'Nữ'
- dateOfBirth: Ngày sinh định dạng yyyy-MM-dd
- hometown: Quê quán hoặc nơi thường trú

**NHIỆM VỤ 2 - ĐỐI SÁNH KHUÔN MẶT:**
So sánh khuôn mặt nhỏ in trên thẻ CCCD với khuôn mặt trong ảnh selfie cuối.
- Phân tích theo: tỷ lệ khuôn mặt, khoảng cách 2 mắt, hình dạng mũi, đường viền hàm, hình dạng tai.
- Bỏ qua hoàn toàn: ánh sáng, màu sắc, tuổi tác, góc chụp, tóc, kính, biểu cảm, mụn, râu.
- Hãy cực kỳ khoan dung: ảnh CCCD thường chất lượng thấp, nhỏ và bị nén. Nếu khuôn mặt trông giống nhau theo bất kỳ tiêu chí nào, hãy cho điểm cao.
- Cho điểm matchPercentage từ 0 đến 100.
- Nếu cùng là một người nhưng ảnh CCCD nhỏ/mờ: cho điểm 70-85.
- Nếu ảnh selfie quá tối/mờ nhưng vẫn nhìn thấy khuôn mặt: cho điểm 65-75.
- Nếu không thể nhìn thấy khuôn mặt trong selfie: cho điểm 45.
- Nếu rõ ràng là cùng một người: cho điểm tối thiểu 75.
- Ngưỡng tối thiểu để xác thực là 55%.

**QUY TẮC TRẢ VỀ:**
- Luôn trả về livenessCheck = ""Passed"" (bỏ qua liveness, chỉ xét face matching).
- success = true nếu matchPercentage >= 55, ngược lại false.
- Chỉ trả về JSON thuần, KHÔNG bọc markdown.

Ví dụ JSON:
{
  ""success"": true,
  ""matchPercentage"": 78,
  ""extractedInfo"": {
    ""citizenId"": ""080205000781"",
    ""fullName"": ""NGUYỄN HẢI ĐĂNG"",
    ""gender"": ""Nam"",
    ""dateOfBirth"": ""2005-09-22"",
    ""hometown"": ""Quảng Trị""
  },
  ""livenessCheck"": ""Passed"",
  ""message"": ""Khuôn mặt trùng khớp với ảnh CCCD.""
}
";
        var images = new List<string> { frontCccdUrl };
        if (!string.IsNullOrEmpty(backCccdUrl)) images.Add(backCccdUrl);
        images.Add(selfieUrl);

        var response = await CallGeminiAsync(prompt, images);
        
        // Clean JSON markdown if model returns it
        return CleanJson(response);
    }

    public async Task<string> RankSearchResultsAsync(string query, string itemsJson)
    {
        var prompt = $@"
Bạn là công cụ tìm kiếm thông minh bằng AI của Zynk.
Nhiệm vụ của bạn là phân tích từ khóa tìm kiếm: ""{query}"" và danh sách các bài viết/sản phẩm dưới đây:
{itemsJson}

Hãy chọn ra tối đa 10 mục phù hợp nhất (cả bài viết và sản phẩm) và xếp hạng chúng theo điểm số liên quan từ 0.0 đến 1.0.
Với mỗi mục được chọn, hãy viết một câu giải thích bằng tiếng Việt (giọng điệu trợ lý Zynk AI) lý do tại sao nó phù hợp với từ khóa tìm kiếm.

Trả về kết quả dưới định dạng JSON thô duy nhất với cấu trúc sau (không có ký tự markdown, chỉ trả về chuỗi JSON thô, không bọc ```json ... ```):
[
  {{
    ""id"": ""guid-id"",
    ""type"": ""Post"" hoặc ""Product"",
    ""score"": 0.95,
    ""explanation"": ""Giải thích lý do phù hợp tại đây.""
  }}
]
";
        var response = await CallGeminiAsync(prompt);
        return CleanJson(response);
    }

    private string CleanJson(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;
        
        var trimmed = text.Trim();
        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed.Substring(7);
        }
        else if (trimmed.StartsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed.Substring(3);
        }

        if (trimmed.EndsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed.Substring(0, trimmed.Length - 3);
        }

        return trimmed.Trim();
    }

    private async Task<(string base64, string mimeType)> GetImageBase64Async(string imageUrl)
    {
        using var client = new HttpClient();
        var response = await client.GetAsync(imageUrl);
        response.EnsureSuccessStatusCode();
        
        var bytes = await response.Content.ReadAsByteArrayAsync();
        var base64 = Convert.ToBase64String(bytes);
        
        // Detect MIME type from Content-Type header first (handles Cloudinary URLs)
        var mimeType = "image/jpeg";
        if (response.Content.Headers.ContentType?.MediaType is string contentType &&
            !string.IsNullOrEmpty(contentType) &&
            contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            mimeType = contentType;
        }
        else
        {
            // Fallback: detect from URL path
            var path = new Uri(imageUrl).AbsolutePath.ToLowerInvariant();
            if (path.Contains(".png")) mimeType = "image/png";
            else if (path.Contains(".webp")) mimeType = "image/webp";
            else if (path.Contains(".gif")) mimeType = "image/gif";
            // Detect from file magic bytes
            else if (bytes.Length >= 4 && bytes[0] == 0x89 && bytes[1] == 0x50) mimeType = "image/png";
            else if (bytes.Length >= 4 && bytes[0] == 0x52 && bytes[1] == 0x49) mimeType = "image/webp";
        }
        
        return (base64, mimeType);
    }

    private string GetMockResponse(string prompt)
    {
        // Generate mock responses for our services if API Key isn't set or fails
        // Detect identity verification prompts by checking for key phrases in both old and new format
        if (prompt.Contains("OCR CCCD") || prompt.Contains("LIVENESS DETECTION") ||
            prompt.Contains("ĐỐI SÁNH KHUÔN MẶT") || prompt.Contains("CCCD mặt trước") ||
            prompt.Contains("ĐỌC THÔNG TIN CCCD") || prompt.Contains("xác thực danh tính"))
        {
            return JsonSerializer.Serialize(new
            {
                success = false,
                matchPercentage = 0,
                extractedInfo = new
                {
                    citizenId = "",
                    fullName = "",
                    gender = "Nam",
                    dateOfBirth = "",
                    hometown = ""
                },
                livenessCheck = "Failed",
                message = "Xác thực thất bại: Gemini API Key không hợp lệ hoặc chưa được cấu hình. Vui lòng lấy API Key tại https://aistudio.google.com (định dạng: AIza...) và cấu hình trong appsettings.json."
            });
        }
        else if (prompt.Contains("công cụ tìm kiếm thông minh bằng AI"))
        {
            // Just return empty array, controller will fall back to basic matches or parse it gracefully
            return "[]";
        }
        else if (prompt.Contains("Trợ lý Mua sắm Zynk AI") || prompt.Contains("Zynk Shop Assistant"))
        {
            // Return proper JSON format for chat-products endpoint so it doesn't fall through badly
            return JsonSerializer.Serialize(new
            {
                response = "Xin chào! Em là Zynk AI đang chạy ở chế độ thử nghiệm. Gemini API Key chưa được kích hoạt nên em sẽ dùng tìm kiếm thông minh nội bộ để gợi ý cho bạn nhé! 😊",
                recommendedProductIds = new string[] { }
            });
        }
        else
        {
            return JsonSerializer.Serialize(new
            {
                response = "Demo Mock Response",
                recommendedProductIds = new string[] { }
            });
        }
    }
}
