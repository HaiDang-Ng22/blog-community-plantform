using Blog.Domain.Entities;
using Blog.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly IPostRepository _postRepository;

    public PostsController(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    // GET: api/posts
    [HttpGet]
    public async Task<IActionResult> GetAllPosts()
    {
        var posts = await _postRepository.GetPublishedPostsAsync();
        return Ok(posts);
    }

    // GET: api/posts/my-posts
    [HttpGet("my-posts")]
    [Authorize]
    public async Task<IActionResult> GetMyPosts()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var authorId))
        {
            return Unauthorized(new { message = "Không xác định được danh tính người dùng." });
        }

        var posts = await _postRepository.GetPostsByAuthorIdAsync(authorId);
        return Ok(posts);
    }

    // GET: api/posts/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPostById(Guid id)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        return Ok(post);
    }

    // GET: api/posts/slug/{slug}
    [HttpGet("slug/{slug}")]
    public async Task<IActionResult> GetPostBySlug(string slug)
    {
        var post = await _postRepository.GetPostBySlugAsync(slug);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        return Ok(post);
    }

    // POST: api/posts
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest request)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var authorId))
        {
            return Unauthorized(new { message = "Bạn cần đăng nhập để viết bài." });
        }

        // Tạo slug từ title
        var slug = request.Title.ToLower()
            .Replace(" ", "-")
            .Replace("đ", "d")
            .Replace("Đ", "d")
            .Normalize();

        var post = new Post
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Slug = slug,
            Content = request.Content,
            Summary = request.Summary,
            FeaturedImageUrl = request.FeaturedImageUrl,
            Status = PostStatus.Published,
            AuthorId = authorId,
            CreatedAt = DateTime.UtcNow,
            PublishedAt = DateTime.UtcNow
        };

        await _postRepository.AddAsync(post);
        await _postRepository.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPostById), new { id = post.Id }, post);
    }

    // PUT: api/posts/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(Guid id, [FromBody] UpdatePostRequest request)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        post.Title = request.Title;
        post.Content = request.Content;
        post.Summary = request.Summary;
        post.FeaturedImageUrl = request.FeaturedImageUrl;
        post.UpdatedAt = DateTime.UtcNow;

        _postRepository.Update(post);
        await _postRepository.SaveChangesAsync();

        return Ok(post);
    }

    // DELETE: api/posts/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(Guid id)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        _postRepository.Delete(post);
        await _postRepository.SaveChangesAsync();

        return Ok(new { message = "Đã xóa bài viết" });
    }
}

// Request models
public class CreatePostRequest
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? FeaturedImageUrl { get; set; }
}

public class UpdatePostRequest
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? FeaturedImageUrl { get; set; }
}