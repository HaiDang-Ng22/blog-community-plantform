using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace Blog.API.Services;

/// <summary>
/// Releases stock and vouchers held by abandoned payment sessions.
/// PayOS sessions expire quickly; direct transfers get a longer verification window.
/// </summary>
public sealed class PendingPaymentExpirationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PendingPaymentExpirationService> _logger;

    public PendingPaymentExpirationService(
        IServiceScopeFactory scopeFactory,
        ILogger<PendingPaymentExpirationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExpirePendingPaymentsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not expire abandoned payment sessions");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // A normal application shutdown cancels the timer. Treat that as a
                // clean stop instead of letting BackgroundService stop the host.
                break;
            }
        }
    }

    private async Task ExpirePendingPaymentsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var now = DateTime.UtcNow;
        var payOsCutoff = now.AddMinutes(-15);
        var directTransferCutoff = now.AddHours(-24);

        var orders = await context.Orders
            .Include(o => o.Items)
            .Include(o => o.Voucher)
            .Where(o => (o.Status == OrderStatus.Unpaid ||
                         o.Status == OrderStatus.PendingPayment ||
                         o.Status == OrderStatus.AwaitingBankVerification) &&
                ((o.PaymentMethod.ToUpper() == "PAYOS" && o.CreatedAt <= payOsCutoff) ||
                 (o.PaymentMethod.ToUpper() == "BANK_TRANSFER" && o.CreatedAt <= directTransferCutoff)))
            .ToListAsync(cancellationToken);

        if (orders.Count == 0) return;

        var productIds = orders.SelectMany(o => o.Items).Select(i => i.ProductId).Distinct().ToList();
        var products = await context.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        foreach (var order in orders)
        {
            var previousStatus = order.Status;
            order.Status = OrderStatus.PaymentExpired;
            order.UpdatedAt = now;
            context.OrderStatusHistories.Add(new OrderStatusHistory
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                FromStatus = previousStatus,
                ToStatus = OrderStatus.PaymentExpired,
                ChangedByUserId = null,
                Note = "Phiên thanh toán hết hạn vì chưa nhận được tiền."
            });

            foreach (var item in order.Items)
            {
                if (!products.TryGetValue(item.ProductId, out var product)) continue;
                product.Stock += item.Quantity;
                product.SalesCount = Math.Max(0, product.SalesCount - item.Quantity);
            }

            if (order.Voucher != null && order.Voucher.UsedCount > 0)
                order.Voucher.UsedCount--;
        }

        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        _logger.LogInformation("Expired {Count} abandoned payment sessions", orders.Count);
    }
}
