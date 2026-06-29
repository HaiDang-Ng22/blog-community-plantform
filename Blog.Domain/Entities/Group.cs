namespace Blog.Domain.Entities;

public class Group
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? AvatarImageUrl { get; set; }
    public bool IsPrivate { get; set; } = false;
    public DateTime CreatedAt { get; set; }

    public Guid OwnerId { get; set; }
    public virtual User Owner { get; set; } = null!;

    public virtual ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();
    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();
}
