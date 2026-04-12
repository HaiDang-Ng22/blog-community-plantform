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

        var users = await _context.Users
            .Where(u => u.Username.ToLower().Contains(query) || u.FullName.ToLower().Contains(query))
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
            .Where(p => p.Title.ToLower().Contains(query) || p.Content.ToLower().Contains(query))
            .Include(p => p.Author)
            .Take(10)
            .Select(p => new PostSearchResult
            {
                Id = p.Id,
                Title = p.Title,
                Summary = p.Summary,
                AuthorName = p.Author != null ? p.Author.FullName : "Người dùng",
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
