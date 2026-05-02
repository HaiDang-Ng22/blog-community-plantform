using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Extensions;
using Blog.API.Services;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/posts/{postId}/comments")]
public class CommentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notiService;

    public CommentsController(AppDbContext context, INotificationService notiService)
    {
        _context = context;
        _notiService = notiService;
    }

    [HttpGet]
    public async Task<IActionResult> GetComments(Guid postId)
    {
        var comments = await _context.Comments
            .Include(c => c.Author)
            .Include(c => c.Replies)
                .ThenInclude(r => r.Author)
            .Where(c => c.PostId == postId && c.ParentCommentId == null)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        var commentDtos = comments.Select(c => MapToDto(c)).ToList();
        return Ok(commentDtos);
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> AddComment(Guid postId, [FromBody] CreateCommentRequest request)
    {
        try 
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            if (userId == Guid.Empty) return Unauthorized();
            
            var post = await _context.Posts.FindAsync(postId);
            if (post == null) return NotFound("Không tìm thấy bài viết");

            var comment = new Comment
            {
                Id = Guid.NewGuid(),
                Content = request.Content,
                PostId = postId,
                AuthorId = userId,
                ParentCommentId = request.ParentCommentId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            
            // Notification logic in a safe block
            try 
            {
                if (request.ParentCommentId.HasValue)
                {
                    var parent = await _context.Comments.FindAsync(request.ParentCommentId.Value);
                    if (parent != null)
                    {
                        await _notiService.SendNotificationAsync(parent.AuthorId, userId, "Reply", postId, "đã trả lời bình luận của bạn.");
                    }
                }
                else
                {
                    await _notiService.SendNotificationAsync(post.AuthorId, userId, "Comment", postId, "đã bình luận vào bài viết của bạn.");
                }
            }
            catch (Exception ex)
            {
                // Log notification failure but don't fail the comment
                Console.WriteLine($"Notification error: {ex.Message}");
            }

            await _context.SaveChangesAsync();
            
            // Reload to get Author info
            await _context.Entry(comment).Reference(c => c.Author).LoadAsync();

            return Ok(MapToDto(comment));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Lỗi server: {ex.Message}");
        }
    }

    private CommentDto MapToDto(Comment c)
    {
        return new CommentDto
        {
            Id = c.Id,
            Content = c.Content,
            AuthorId = c.AuthorId,
            AuthorName = c.Author?.FullName ?? "Người dùng",
            AuthorAvatarUrl = c.Author?.AvatarUrl,
            CreatedAt = c.CreatedAt,
            Replies = c.Replies?.Select(r => MapToDto(r)).ToList() ?? new List<CommentDto>()
        };
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteComment(Guid postId, Guid id)
    {
        try 
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            if (userId == Guid.Empty) return Unauthorized();

            var comment = await _context.Comments.FindAsync(id);
            if (comment == null) return NotFound("Không tìm thấy bình luận");
            if (comment.PostId != postId) return BadRequest("Bình luận không thuộc bài viết này");

            var post = await _context.Posts.FindAsync(postId);
            
            // Quyền xóa: chủ bài viết hoặc chủ bình luận
            if (comment.AuthorId != userId && post?.AuthorId != userId)
            {
                return Forbid();
            }

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa bình luận" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Lỗi khi xóa: {ex.Message}");
        }
    }
}
