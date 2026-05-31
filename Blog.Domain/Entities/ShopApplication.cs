namespace Blog.Domain.Entities;

public enum ShopApplicationStatus
{
    Pending,
    Approved,
    Rejected
}

public class ShopApplication
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ShopName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    // New Identity Fields
    public string CitizenId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Hometown { get; set; } = string.Empty;
    public string Occupation { get; set; } = string.Empty;

    // AI Biometric & Verification Fields
    public string? CccdFrontUrl { get; set; }
    public string? CccdBackUrl { get; set; }
    public string? SelfieUrl { get; set; }
    public int AiMatchPercentage { get; set; }
    public bool IsAiVerified { get; set; }

    public ShopApplicationStatus Status { get; set; } = ShopApplicationStatus.Pending;
    public string? AdminNote { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
