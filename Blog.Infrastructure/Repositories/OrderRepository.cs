using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Blog.Infrastructure.Repositories;

public class ProductRepository : GenericRepository<Product>, IProductRepository
{
    public ProductRepository(AppDbContext context) : base(context)
    {
    }

    public override async Task<Product?> GetByIdAsync(Guid id)
    {
        return await _dbSet
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<IEnumerable<Product>> GetProductsByShopIdAsync(Guid shopId)
    {
        return await _dbSet
            .Where(p => p.ShopId == shopId)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .ToListAsync();
    }

    public async Task<IEnumerable<Product>> GetFeaturedProductsAsync(int count)
    {
        return await _dbSet
            .Where(p => p.Status == ProductStatus.Active)
            .Include(p => p.Shop)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .OrderByDescending(p => p.CreatedAt)
            .Take(count)
            .ToListAsync();
    }

    public async Task<IEnumerable<Product>> GetProductsByCategoryAsync(Guid categoryId)
    {
        return await _dbSet
            .Where(p => p.CategoryId == categoryId && p.Status == ProductStatus.Active)
            .Include(p => p.Shop)
            .Include(p => p.Images)
            .ToListAsync();
    }
}

public class OrderRepository : GenericRepository<Order>, IOrderRepository
{
    public OrderRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Order>> GetOrdersByBuyerIdAsync(Guid buyerId)
    {
        return await _dbSet
            .Where(o => o.BuyerId == buyerId)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<Order>> GetOrdersByShopIdAsync(Guid shopId)
    {
        // Get orders that contain products from this shop
        return await _dbSet
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Where(o => o.Items.Any(i => i.Product.ShopId == shopId))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<Order?> GetOrderDetailAsync(Guid id)
    {
        return await _dbSet
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items)
                .ThenInclude(i => i.Variant)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<IEnumerable<Order>> SearchOrdersAsync(Guid shopId, string? status = null, string? keyword = null)
    {
        var query = _dbSet
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Where(o => o.Items.Any(i => i.Product.ShopId == shopId));

        if (!string.IsNullOrEmpty(status) && status != "All")
        {
            if (Enum.TryParse<OrderStatus>(status, true, out var statusEnum))
            {
                // When filtering by Completed, also include Delivered orders
                // since "Delivered" is effectively a completed/finished state
                if (statusEnum == OrderStatus.Completed)
                {
                    query = query.Where(o => o.Status == OrderStatus.Completed || o.Status == OrderStatus.Delivered);
                }
                else
                {
                    query = query.Where(o => o.Status == statusEnum);
                }
            }
        }

        if (!string.IsNullOrEmpty(keyword))
        {
            var k = keyword.ToLower();
            query = query.Where(o => 
                o.Id.ToString().Contains(k) || 
                o.CustomerName.ToLower().Contains(k) || 
                o.PhoneNumber.Contains(k));
        }

        return await query
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }
}
