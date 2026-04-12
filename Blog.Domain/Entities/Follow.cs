namespace Blog.Domain.Entities;

public class Follow
{
    public Guid FollowerId { get; set; } // Người theo dõi
    public Guid FollowingId { get; set; } // Người được theo dõi
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public virtual User Follower { get; set; } = null!;
    public virtual User Following { get; set; } = null!;
}
