using System;

namespace Blog.Application.Dtos.AiChat;

/// <summary>
/// A lightweight order summary returned by the AI Shopping Assistant
/// when the user asks about their orders.
/// </summary>
public class AiOrderSummaryDto
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public string? ShippingAddress { get; set; }
}
