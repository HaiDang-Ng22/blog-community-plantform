using System.Collections.Generic;
using System.Threading.Tasks;

namespace Blog.Domain.Interfaces;

public interface IGeminiService
{
    Task<string> CallGeminiAsync(string prompt, List<string>? imageUrls = null);
    Task<string> VerifyIdentityAsync(string frontCccdUrl, string backCccdUrl, string selfieUrl);
    Task<string> RankSearchResultsAsync(string query, string itemsJson);
}
