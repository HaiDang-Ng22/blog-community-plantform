using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System;
using System.Linq;

namespace Debugger;

class Program {
    static async Task Main(string[] args) {
        var builder = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("e:/Social/Blog.API/appsettings.json")
            .Build();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(builder.GetConnectionString("DefaultConnection")));

        var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var shop = await db.Shops.Include(s => s.User).FirstOrDefaultAsync();
        if (shop != null) {
            Console.WriteLine($"Shop: {shop.Name}, User Email: {shop.User.Email}");
            // Find an order for this shop
            var orderId = await db.OrderItems
                .Where(i => i.Product.ShopId == shop.Id)
                .Select(i => i.OrderId)
                .FirstOrDefaultAsync();
            Console.WriteLine($"Associated Order ID: {orderId}");
        } else {
            Console.WriteLine("No shops found");
        }
    }
}
