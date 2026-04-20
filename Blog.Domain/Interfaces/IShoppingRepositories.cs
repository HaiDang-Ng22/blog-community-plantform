using Blog.Domain.Entities;

namespace Blog.Domain.Interfaces;

public interface IShopRepository : IRepository<Shop>
{
    Task<Shop?> GetByUserIdAsync(Guid userId);
    Task<Shop?> GetBySlugAsync(string slug);
}

public interface IProductRepository : IRepository<Product>
{
    Task<IEnumerable<Product>> GetProductsByShopIdAsync(Guid shopId);
    Task<IEnumerable<Product>> GetFeaturedProductsAsync(int count);
    Task<IEnumerable<Product>> GetProductsByCategoryAsync(Guid categoryId);
}

public interface IOrderRepository : IRepository<Order>
{
    Task<IEnumerable<Order>> GetOrdersByBuyerIdAsync(Guid buyerId);
    Task<IEnumerable<Order>> GetOrdersByShopIdAsync(Guid shopId);
    Task<Order?> GetOrderDetailAsync(Guid id);
    Task<IEnumerable<Order>> SearchOrdersAsync(Guid shopId, string? status = null, string? keyword = null);
}
