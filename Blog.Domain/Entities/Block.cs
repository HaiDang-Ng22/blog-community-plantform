namespace Blog.Domain.Entities;

public class Block
{
    public Guid BlockerId { get; set; } // Người thực hiện chặn
    public Guid BlockedId { get; set; } // Người bị chặn
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public virtual User Blocker { get; set; } = null!;
    public virtual User Blocked { get; set; } = null!;
}
