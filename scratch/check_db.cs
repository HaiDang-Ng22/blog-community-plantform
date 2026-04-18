using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

var builder = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json")
    .Build();

var services = new ServiceCollection();
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.GetConnectionString("DefaultConnection")));

var provider = services.BuildServiceProvider();
using var scope = provider.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

var order = await db.Orders.FirstOrDefaultAsync();
if (order != null) {
    Console.WriteLine($"Found Order: {order.Id}, Status: {order.Status}");
} else {
    Console.WriteLine("No orders found");
}
