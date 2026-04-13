using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Blog.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly IPostRepository _postRepository; // Đổi từ IRepository sang IPostRepository
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Tag> _tagRepository;
    private readonly AppDbContext _context; // Giải quyết tạm thời để xử lý Like/Notification

    public PostsController(
        IPostRepository postRepository, // Đổi ở đây
        IRepository<User> userRepository,
        IRepository<Tag> tagRepository,
        AppDbContext context)
    {
        _postRepository = postRepository;
        _userRepository = userRepository;
        _tagRepository = tagRepository;
        _context = context;
    }

    // GET: api/posts
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var posts = await _postRepository.GetPublishedPostsAsync();
        
        var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid? currentUserId = !string.IsNullOrEmpty(currentUserIdStr) ? Guid.Parse(currentUserIdStr) : null;

        List<Guid> followingIds = new List<Guid>();
        List<Guid> blockedIds = new List<Guid>();
        if (currentUserId.HasValue)
        {
            followingIds = await _context.Follows
                .Where(f => f.FollowerId == currentUserId.Value)
                .Select(f => f.FollowingId)
                .ToListAsync();

            blockedIds = await _context.Blocks
                .Where(b => b.BlockerId == currentUserId.Value)
                .Select(b => b.BlockedId)
                .ToListAsync();
        }

        // Bản lọc quyền riêng tư: 
        // Lấy bài viết nếu:
        // 1. Tác giả không trong danh sách bị chặn
        // 2. Tác giả không Private
        // 3. Tác giả là chính mình
        // 4. Mình đang Follow tác giả
        var filteredPosts = posts.Where(p => 
            !blockedIds.Contains(p.AuthorId) && (
                !p.Author.IsPrivate || 
                (currentUserId.HasValue && p.AuthorId == currentUserId.Value) ||
                (currentUserId.HasValue && followingIds.Contains(p.AuthorId))
            )
        ).ToList();

        var postDtos = filteredPosts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ViewCount = p.ViewCount,
            LikeCount = p.LikeCount,
            Status = p.Status.ToString(),
            AuthorName = p.Author?.FullName ?? "Người dùng",
            AuthorAvatarUrl = p.Author?.AvatarUrl,
            AuthorId = p.AuthorId,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
            CommentCount = p.Comments.Count,
            IsLikedByMe = currentUserId.HasValue && p.PostLikes.Any(l => l.UserId == currentUserId.Value),
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList()
        });
        
        return Ok(postDtos);
    }

    // GET: api/posts/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });
        
        // Tăng view count
        post.ViewCount++;
        await _postRepository.UpdateAsync(post);
        
        var postDto = new PostDto
        {
            Id = post.Id,
            Title = post.Title,
            Slug = post.Slug,
            Content = post.Content,
            Summary = post.Summary,
            FeaturedImageUrl = post.FeaturedImageUrl,
            ViewCount = post.ViewCount,
            LikeCount = post.LikeCount,
            Status = post.Status.ToString(),
            CreatedAt = post.CreatedAt,
            PublishedAt = post.PublishedAt
        };
        
        return Ok(postDto);
    }

    // POST: api/posts
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreatePostDto createPostDto)
    {
        // Lấy UserId từ Claims của Token
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null)
            return Unauthorized(new { message = "Không xác định được người dùng" });

        var userId = Guid.Parse(userIdClaim.Value);

        // Tạo slug từ title
        var slug = createPostDto.Title
            .ToLower()
            .Replace(" ", "-")
            .Replace("đ", "d")
            .Replace("Đ", "d");
        
        var post = new Post
        {
            Id = Guid.NewGuid(),
            Title = createPostDto.Title,
            Slug = slug,
            Content = createPostDto.Content,
            Summary = createPostDto.Summary,
            FeaturedImageUrl = createPostDto.ImageUrls.FirstOrDefault() ?? createPostDto.FeaturedImageUrl,
            Status = PostStatus.Published,
            AuthorId = userId,
            CreatedAt = DateTime.UtcNow,
            Images = createPostDto.ImageUrls.Select((url, index) => new PostImage
            {
                Id = Guid.NewGuid(),
                Url = url,
                OrderIndex = index
            }).ToList()
        };
        
        await _postRepository.AddAsync(post);
        
        return Ok(new { message = "Đăng bài thành công", id = post.Id });
    }

    // GET: api/posts/me
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMyPosts()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null)
            return Unauthorized(new { message = "Không xác định được người dùng" });

        var userId = Guid.Parse(userIdClaim.Value);
        var posts = await _postRepository.GetPostsByAuthorIdAsync(userId);
        
        var postDtos = posts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ViewCount = p.ViewCount,
            LikeCount = p.LikeCount,
            Status = p.Status.ToString(),
            AuthorName = p.Author?.FullName ?? "Tôi",
            AuthorAvatarUrl = p.Author?.AvatarUrl,
            AuthorId = p.AuthorId,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
            CommentCount = p.Comments.Count,
            IsLikedByMe = p.PostLikes.Any(l => l.UserId == userId),
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList()
        });

        return Ok(postDtos);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePostDto updatePostDto)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (post.AuthorId != userId)
            return Forbid();
        
        post.Title = updatePostDto.Title;
        post.Content = updatePostDto.Content;
        post.Summary = updatePostDto.Summary;
        post.FeaturedImageUrl = updatePostDto.FeaturedImageUrl ?? updatePostDto.ImageUrls?.FirstOrDefault();
        post.UpdatedAt = DateTime.UtcNow;
        
        // Remove old images
        var existingImages = await _context.PostImages.Where(i => i.PostId == id).ToListAsync();
        _context.PostImages.RemoveRange(existingImages);

        // Add new images
        if (updatePostDto.ImageUrls != null && updatePostDto.ImageUrls.Any())
        {
            var newImages = updatePostDto.ImageUrls.Select((url, index) => new PostImage
            {
                Id = Guid.NewGuid(),
                PostId = id,
                Url = url,
                OrderIndex = index
            });
            await _context.PostImages.AddRangeAsync(newImages);
        }

        await _postRepository.UpdateAsync(post);
        return Ok(new { message = "Cập nhật thành công" });
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (post.AuthorId != userId)
            return Forbid();
        
        // Hard-delete orphaned notifications first
        var staledNotifications = await _context.Notifications.Where(n => n.TargetId == id).ToListAsync();
        if (staledNotifications.Any()) {
            _context.Notifications.RemoveRange(staledNotifications);
        }

        // Hard-delete post (cascade deletes Comments, PostLikes, PostTags, PostImages)
        await _postRepository.DeleteAsync(post); // Calls SaveChangesAsync internally, which commits the Notifications deletion as well
        
        return Ok(new { message = "Xóa thành công" });
    }

    [HttpPost("{id}/like")]
    [Authorize]
    public async Task<IActionResult> LikePost(Guid id)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();

        var existingLike = await _context.PostLikes
            .FirstOrDefaultAsync(l => l.PostId == id && l.UserId == userId);

        bool isLiked;
        if (existingLike != null)
        {
            _context.PostLikes.Remove(existingLike);
            post.LikeCount = Math.Max(0, post.LikeCount - 1);
            isLiked = false;
        }
        else
        {
            var like = new PostLike
            {
                PostId = id,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _context.PostLikes.Add(like);
            post.LikeCount++;
            isLiked = true;

            // Thông báo
            if (post.AuthorId != userId)
            {
                var notification = new Notification
                {
                    Id = Guid.NewGuid(),
                    ReceiverId = post.AuthorId,
                    ActorId = userId,
                    Type = "Like",
                    TargetId = id,
                    Message = "đã thích bài viết của bạn.",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Notifications.Add(notification);
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { isLiked, likeCount = post.LikeCount });
    }
}