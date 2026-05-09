using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Blog.API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SavedPostsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavedPostsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetSavedPosts([FromQuery] string? collection = null)
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            var query = _context.SavedPosts
                .Include(sp => sp.Post)
                    .ThenInclude(p => p.Author)
                .Include(sp => sp.Post)
                    .ThenInclude(p => p.Images)
                .Include(sp => sp.Post)
                    .ThenInclude(p => p.Comments)
                .Where(sp => sp.UserId == userId);

            if (!string.IsNullOrEmpty(collection))
            {
                query = query.Where(sp => sp.CollectionName == collection);
            }

            var savedEntries = await query
                .OrderByDescending(sp => sp.SavedAt)
                .ToListAsync();

            var posts = savedEntries.Select(sp => new {
                sp.Post.Id,
                sp.Post.Title,
                sp.Post.Content,
                sp.Post.CreatedAt,
                AuthorId = sp.Post.Author.Id,
                AuthorName = sp.Post.Author.FullName ?? sp.Post.Author.Username,
                AuthorAvatarUrl = sp.Post.Author.AvatarUrl,
                ImageUrls = sp.Post.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
                IsSavedByMe = true,
                LikeCount = sp.Post.LikeCount,
                CommentCount = sp.Post.Comments.Count,
                Type = sp.Post.Type.ToString()
            });

            return Ok(posts);
        }

        [HttpPost("{postId}")]
        public async Task<IActionResult> ToggleSavePost(Guid postId, [FromQuery] string? collection = "Mặc định")
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            var existing = await _context.SavedPosts
                .FirstOrDefaultAsync(sp => sp.UserId == userId && sp.PostId == postId);

            if (existing != null)
            {
                _context.SavedPosts.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { saved = false });
            }

            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists) return NotFound("Post not found");

            var savedPost = new SavedPost
            {
                UserId = userId,
                PostId = postId,
                CollectionName = collection ?? "Mặc định"
            };

            _context.SavedPosts.Add(savedPost);
            await _context.SaveChangesAsync();

            return Ok(new { saved = true });
        }

        [HttpGet("collections")]
        public async Task<IActionResult> GetCollections()
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            var collections = await _context.SavedPosts
                .Where(sp => sp.UserId == userId)
                .Select(sp => sp.CollectionName)
                .Distinct()
                .ToListAsync();

            return Ok(collections);
        }
        
        [HttpGet("check/{postId}")]
        public async Task<IActionResult> CheckIsSaved(Guid postId)
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            var exists = await _context.SavedPosts
                .AnyAsync(sp => sp.UserId == userId && sp.PostId == postId);
            return Ok(new { saved = exists });
        }
    }
}
