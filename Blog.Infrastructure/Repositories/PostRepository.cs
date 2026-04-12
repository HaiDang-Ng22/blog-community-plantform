using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Blog.Infrastructure.Repositories;

public class PostRepository : GenericRepository<Post>, IPostRepository
{
    public PostRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Post>> GetPublishedPostsAsync()
    {
        return await _dbSet
            .Where(p => p.Status == PostStatus.Published)
            .Include(p => p.Author)
            .Include(p => p.PostLikes)
            .Include(p => p.Comments)
            .Include(p => p.Images)
            .OrderByDescending(p => p.PublishedAt)
            .ToListAsync();
    }

    public async Task<Post?> GetPostBySlugAsync(string slug)
    {
        return await _dbSet
            .Include(p => p.Author)
            .Include(p => p.Comments)
            .Include(p => p.PostLikes)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Slug == slug);
    }

    public async Task<IEnumerable<Post>> GetPostsByAuthorIdAsync(Guid authorId)
    {
        return await _dbSet
            .Where(p => p.AuthorId == authorId)
            .Include(p => p.Author)
            .Include(p => p.PostLikes)
            .Include(p => p.Comments)
            .Include(p => p.Images)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }
}