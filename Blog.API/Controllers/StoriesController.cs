using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;
using Blog.API.Services;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StoriesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notiService;

    public StoriesController(AppDbContext context, INotificationService notiService)
    {
        _context = context;
        _notiService = notiService;
    }

    // GET: api/stories/feed
    [HttpGet("feed")]
    [Authorize]
    public async Task<IActionResult> GetFeed()
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        // Get IDs of users the current user follows
        var followingIds = await _context.Follows
            .Where(f => f.FollowerId == userId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        // Always include self
        followingIds.Add(userId);

        var now = DateTime.UtcNow;

        // Fetch stories ONLY from people followed or self
        var stories = await _context.Stories
            .Include(s => s.User)
            .Include(s => s.StoryLikes)
                .ThenInclude(l => l.User)
            .Include(s => s.StoryViews)
                .ThenInclude(v => v.User)
            .Where(s => followingIds.Contains(s.UserId) && s.ExpiresAt > now)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var result = stories.Select(s => new StoryDto
        {
            Id = s.Id,
            UserId = s.UserId,
            AuthorName = s.User?.FullName ?? "Người dùng",
            AuthorAvatarUrl = s.User?.AvatarUrl,
            MediaUrl = s.MediaUrl,
            MediaType = s.MediaType,
            Content = s.Content,
            Background = s.Background,
            CreatedAt = s.CreatedAt,
            ExpiresAt = s.ExpiresAt,
            Privacy = s.Privacy.ToString(),
            IsLiked = s.StoryLikes.Any(l => l.UserId == userId),
            LikeCount = s.StoryLikes.Count,
            ViewCount = s.StoryViews.Count,
            Likes = s.UserId == userId ? s.StoryLikes.Select(l => new StoryInteractionDto {
                UserId = l.UserId,
                FullName = l.User?.FullName ?? "Người dùng",
                AvatarUrl = l.User?.AvatarUrl
            }).ToList() : null,
            Viewers = s.UserId == userId ? s.StoryViews.Select(v => new StoryInteractionDto {
                UserId = v.UserId,
                FullName = v.User?.FullName ?? "Người dùng",
                AvatarUrl = v.User?.AvatarUrl
            }).ToList() : null
        });

        return Ok(result);
    }

    // GET: api/stories/user/{userId}
    [HttpGet("user/{userId}")]
    [Authorize]
    public async Task<IActionResult> GetUserStories(Guid userId)
    {
        var currentUserId = User.GetUserId() ?? Guid.Empty;
        var now = DateTime.UtcNow;

        var isFollowing = await _context.Follows.AnyAsync(f => f.FollowerId == currentUserId && f.FollowingId == userId);

        var stories = await _context.Stories
            .Include(s => s.User)
            .Include(s => s.StoryLikes)
            .Include(s => s.StoryViews)
            .Where(s => s.UserId == userId && s.ExpiresAt > now)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        // Filter by privacy: Owner, Public, or Friends (if following)
        var filtered = stories.Where(s => 
            s.UserId == currentUserId || 
            s.Privacy == StoryPrivacy.Public || 
            (s.Privacy == StoryPrivacy.Friends && isFollowing)
        ).Select(s => new StoryDto {
            Id = s.Id,
            UserId = s.UserId,
            AuthorName = s.User?.FullName ?? "Người dùng",
            AuthorAvatarUrl = s.User?.AvatarUrl,
            MediaUrl = s.MediaUrl,
            MediaType = s.MediaType,
            Content = s.Content,
            Background = s.Background,
            CreatedAt = s.CreatedAt,
            ExpiresAt = s.ExpiresAt,
            Privacy = s.Privacy.ToString(),
            IsLiked = s.StoryLikes.Any(l => l.UserId == currentUserId),
            LikeCount = s.StoryLikes.Count,
            ViewCount = s.StoryViews.Count
        });

        return Ok(filtered);
    }

    // GET: api/stories/me
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMyStories()
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var now = DateTime.UtcNow;
        var stories = await _context.Stories
            .Include(s => s.StoryLikes)
                .ThenInclude(l => l.User)
            .Include(s => s.StoryViews)
                .ThenInclude(v => v.User)
            .Where(s => s.UserId == userId && s.ExpiresAt > now)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var result = stories.Select(s => new StoryDto
        {
            Id = s.Id,
            UserId = s.UserId,
            MediaUrl = s.MediaUrl,
            MediaType = s.MediaType,
            Content = s.Content,
            Background = s.Background,
            CreatedAt = s.CreatedAt,
            ExpiresAt = s.ExpiresAt,
            Privacy = s.Privacy.ToString(),
            IsLiked = s.StoryLikes.Any(l => l.UserId == userId),
            LikeCount = s.StoryLikes.Count,
            ViewCount = s.StoryViews.Count,
            Likes = s.StoryLikes.Select(l => new StoryInteractionDto {
                UserId = l.UserId,
                FullName = l.User?.FullName ?? "Người dùng",
                AvatarUrl = l.User?.AvatarUrl
            }).ToList(),
            Viewers = s.StoryViews.Select(v => new StoryInteractionDto {
                UserId = v.UserId,
                FullName = v.User?.FullName ?? "Người dùng",
                AvatarUrl = v.User?.AvatarUrl
            }).ToList()
        });

        return Ok(result);
    }

    // POST: api/stories
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateStoryDto dto)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var story = new Story
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MediaUrl = dto.MediaUrl,
            MediaType = dto.MediaType,
            Content = dto.Content,
            Background = dto.Background,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(dto.DurationHours),
            Privacy = Enum.Parse<StoryPrivacy>(dto.Privacy)
        };

        _context.Stories.Add(story);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã đăng tin thành công", id = story.Id });
    }

    // POST: api/stories/{id}/like
    [HttpPost("{id}/like")]
    [Authorize]
    public async Task<IActionResult> ToggleLike(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var story = await _context.Stories.FindAsync(id);
        if (story == null) return NotFound();

        var existingLike = await _context.StoryLikes
            .FirstOrDefaultAsync(l => l.StoryId == id && l.UserId == userId);

        if (existingLike != null)
        {
            _context.StoryLikes.Remove(existingLike);
            await _context.SaveChangesAsync();
            return Ok(new { liked = false });
        }

        var like = new StoryLike { StoryId = id, UserId = userId };
        _context.StoryLikes.Add(like);
        await _context.SaveChangesAsync();
        
        if (story.UserId != userId)
        {
            await _notiService.SendNotificationAsync(
                story.UserId,
                userId,
                "LikeStory",
                story.Id,
                "đã thả tim tin của bạn ❤️"
            );
        }

        return Ok(new { liked = true });
    }

    // POST: api/stories/{id}/view
    [HttpPost("{id}/view")]
    [Authorize]
    public async Task<IActionResult> RecordView(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var story = await _context.Stories.FindAsync(id);
        if (story == null) return NotFound();

        var existingView = await _context.StoryViews
            .FirstOrDefaultAsync(v => v.StoryId == id && v.UserId == userId);

        if (existingView == null)
        {
            var view = new StoryView { StoryId = id, UserId = userId, ViewedAt = DateTime.UtcNow };
            _context.StoryViews.Add(view);
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    // DELETE: api/stories/{id}
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();

        var story = await _context.Stories.FindAsync(id);
        if (story == null) return NotFound();

        if (story.UserId != userId) return Forbid();

        _context.Stories.Remove(story);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xóa tin" });
    }
}
