using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Blog.Infrastructure.Repositories;

public class ShopRepository : GenericRepository<Shop>, IShopRepository
{
    public ShopRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Shop?> GetByUserIdAsync(Guid userId)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.UserId == userId);
    }

    public async Task<Shop?> GetBySlugAsync(string slug)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.Slug == slug);
    }
}
