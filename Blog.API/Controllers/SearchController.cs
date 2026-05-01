using Blog.Application.Dtos;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/search")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _context;

    public SearchController(AppDbContext context)
    {
        _context = context;
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
}
