using Blog.Domain.Entities;

namespace Blog.Application.Services;

public sealed record VoucherCalculation(
    bool IsEligible,
    decimal ItemDiscount,
    decimal ShippingDiscount,
    decimal FinalShippingFee,
    decimal FinalTotal);

/// <summary>
/// Pure voucher calculation used by checkout, validation endpoints and tests.
/// Keeping financial rules here prevents the preview and order total from drifting apart.
/// </summary>
public static class VoucherCalculator
{
    public static VoucherCalculation Calculate(Voucher voucher, decimal orderValue, decimal shippingFee)
    {
        ArgumentNullException.ThrowIfNull(voucher);

        orderValue = Math.Max(0, orderValue);
        shippingFee = Math.Max(0, shippingFee);

        if (voucher.MinOrderValue.HasValue && orderValue < voucher.MinOrderValue.Value)
            return new(false, 0, 0, shippingFee, orderValue + shippingFee);

        decimal itemDiscount = 0;
        decimal shippingDiscount = 0;

        switch (voucher.DiscountType)
        {
            case DiscountType.Percentage:
                itemDiscount = orderValue * Math.Clamp(voucher.DiscountValue, 0, 100) / 100;
                if (voucher.MaxDiscountAmount.HasValue)
                    itemDiscount = Math.Min(itemDiscount, Math.Max(0, voucher.MaxDiscountAmount.Value));
                break;

            case DiscountType.FixedAmount:
                itemDiscount = Math.Max(0, voucher.DiscountValue);
                break;

            case DiscountType.FreeShipping:
                shippingDiscount = shippingFee;
                break;

            case DiscountType.ShippingDiscount:
                shippingDiscount = Math.Max(0, voucher.DiscountValue);
                break;
        }

        itemDiscount = Math.Min(itemDiscount, orderValue);
        shippingDiscount = Math.Min(shippingDiscount, shippingFee);
        var finalShippingFee = shippingFee - shippingDiscount;
        var finalTotal = Math.Max(0, orderValue - itemDiscount) + finalShippingFee;

        return new(true, itemDiscount, shippingDiscount, finalShippingFee, finalTotal);
    }
}
