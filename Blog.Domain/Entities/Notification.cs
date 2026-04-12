namespace Blog.Domain.Entities;

public class Notification
{
    public Guid Id { get; set; }
    public Guid ReceiverId { get; set; } // Người nhận thông báo
    public Guid ActorId { get; set; }    // Người tác động (VD: người thả tim)
    public string Type { get; set; } = string.Empty; // Like, Comment, Follow
    public Guid? TargetId { get; set; }  // ID của Post hoặc Comment liên quan
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public virtual User Receiver { get; set; } = null!;
    public virtual User Actor { get; set; } = null!;
}
