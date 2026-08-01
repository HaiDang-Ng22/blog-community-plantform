using Blog.Application.Services;
using Blog.Domain.Entities;

namespace Blog.Tests;

[TestClass]
public sealed class VoucherCalculatorTests
{
    [TestMethod]
    public void PercentageDiscount_UsesConfiguredPercentage()
    {
        var result = Calculate(DiscountType.Percentage, 10, orderValue: 500_000);

        Assert.AreEqual(50_000m, result.ItemDiscount);
        Assert.AreEqual(475_000m, result.FinalTotal);
    }

    [TestMethod]
    public void PercentageDiscount_RespectsMaximumDiscount()
    {
        var result = Calculate(DiscountType.Percentage, 20, orderValue: 1_000_000, maxDiscount: 80_000);

        Assert.AreEqual(80_000m, result.ItemDiscount);
        Assert.AreEqual(945_000m, result.FinalTotal);
    }

    [TestMethod]
    public void PercentageDiscount_IsCappedAtOneHundredPercent()
    {
        var result = Calculate(DiscountType.Percentage, 150, orderValue: 200_000);

        Assert.AreEqual(200_000m, result.ItemDiscount);
        Assert.AreEqual(25_000m, result.FinalTotal);
    }

    [TestMethod]
    public void FixedAmount_CannotExceedOrderValue()
    {
        var result = Calculate(DiscountType.FixedAmount, 500_000, orderValue: 200_000);

        Assert.AreEqual(200_000m, result.ItemDiscount);
        Assert.AreEqual(25_000m, result.FinalTotal);
    }

    [TestMethod]
    public void FreeShipping_RemovesTheWholeShippingFee()
    {
        var result = Calculate(DiscountType.FreeShipping, 0, orderValue: 300_000, shippingFee: 32_000);

        Assert.AreEqual(32_000m, result.ShippingDiscount);
        Assert.AreEqual(0m, result.FinalShippingFee);
        Assert.AreEqual(300_000m, result.FinalTotal);
    }

    [TestMethod]
    public void ShippingDiscount_OnlyReducesShippingFee()
    {
        var result = Calculate(DiscountType.ShippingDiscount, 15_000, orderValue: 300_000, shippingFee: 25_000);

        Assert.AreEqual(0m, result.ItemDiscount);
        Assert.AreEqual(15_000m, result.ShippingDiscount);
        Assert.AreEqual(10_000m, result.FinalShippingFee);
        Assert.AreEqual(310_000m, result.FinalTotal);
    }

    [TestMethod]
    public void ShippingDiscount_CannotCreateNegativeShippingFee()
    {
        var result = Calculate(DiscountType.ShippingDiscount, 50_000, orderValue: 300_000, shippingFee: 25_000);

        Assert.AreEqual(25_000m, result.ShippingDiscount);
        Assert.AreEqual(0m, result.FinalShippingFee);
    }

    [TestMethod]
    public void MinimumOrder_NotReached_ReturnsIneligibleResult()
    {
        var voucher = NewVoucher(DiscountType.FixedAmount, 50_000, minOrder: 500_000);

        var result = VoucherCalculator.Calculate(voucher, 300_000, 25_000);

        Assert.IsFalse(result.IsEligible);
        Assert.AreEqual(0m, result.ItemDiscount);
        Assert.AreEqual(325_000m, result.FinalTotal);
    }

    [TestMethod]
    public void MinimumOrder_ExactlyReached_IsEligible()
    {
        var voucher = NewVoucher(DiscountType.FixedAmount, 50_000, minOrder: 300_000);

        var result = VoucherCalculator.Calculate(voucher, 300_000, 25_000);

        Assert.IsTrue(result.IsEligible);
        Assert.AreEqual(275_000m, result.FinalTotal);
    }

    [TestMethod]
    public void NegativeInputs_AreNormalizedToZero()
    {
        var result = Calculate(DiscountType.FixedAmount, -10_000, orderValue: -100, shippingFee: -20);

        Assert.AreEqual(0m, result.ItemDiscount);
        Assert.AreEqual(0m, result.FinalShippingFee);
        Assert.AreEqual(0m, result.FinalTotal);
    }

    [TestMethod]
    public void NegativeMaxDiscount_DoesNotCreateNegativeTotal()
    {
        var result = Calculate(DiscountType.Percentage, 20, orderValue: 100_000, maxDiscount: -1);

        Assert.AreEqual(0m, result.ItemDiscount);
        Assert.AreEqual(125_000m, result.FinalTotal);
    }

    [TestMethod]
    public void Calculation_DoesNotMutateVoucher()
    {
        var voucher = NewVoucher(DiscountType.ShippingDiscount, 15_000);

        _ = VoucherCalculator.Calculate(voucher, 300_000, 25_000);

        Assert.AreEqual(15_000m, voucher.DiscountValue);
        Assert.AreEqual(DiscountType.ShippingDiscount, voucher.DiscountType);
    }

    private static VoucherCalculation Calculate(
        DiscountType type,
        decimal discountValue,
        decimal orderValue,
        decimal shippingFee = 25_000,
        decimal? maxDiscount = null) =>
        VoucherCalculator.Calculate(NewVoucher(type, discountValue, maxDiscount: maxDiscount), orderValue, shippingFee);

    private static Voucher NewVoucher(
        DiscountType type,
        decimal discountValue,
        decimal? minOrder = null,
        decimal? maxDiscount = null) => new()
        {
            DiscountType = type,
            DiscountValue = discountValue,
            MinOrderValue = minOrder,
            MaxDiscountAmount = maxDiscount
        };
}
