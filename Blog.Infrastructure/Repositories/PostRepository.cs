using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Blog.Infrastructure.Repositories;

public class PostRepository : Repository<Post>, IPostRepository
{
    public PostRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Post>> GetPublishedPostsAsync()
    {
        return await _dbSet
            .Where(p => p.Status == PostStatus.Published)
            .Include(p => p.Author)
            .OrderByDescending(p => p.PublishedAt)
            .ToListAsync();
    }

    public async Task<Post?> GetPostBySlugAsync(string slug)
    {
        return await _dbSet
            .Include(p => p.Author)
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Slug == slug);
    }

    public async Task<IEnumerable<Post>> GetPostsByAuthorIdAsync(Guid authorId)
    {
        return await _dbSet
            .Where(p => p.AuthorId == authorId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }
}