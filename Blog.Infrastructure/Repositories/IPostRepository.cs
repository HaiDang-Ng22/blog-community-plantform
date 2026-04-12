using Blog.Domain.Entities;
using Blog.Domain.Interfaces;

namespace Blog.Infrastructure.Repositories;

public interface IPostRepository : IRepository<Post>
{
    Task<IEnumerable<Post>> GetPublishedPostsAsync();
    Task<Post?> GetPostBySlugAsync(string slug);
    Task<IEnumerable<Post>> GetPostsByAuthorIdAsync(Guid authorId);
}