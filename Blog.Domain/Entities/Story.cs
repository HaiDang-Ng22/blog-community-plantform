namespace Blog.Domain.Entities;

public enum StoryPrivacy
{
    Public,
    Friends
}

public class Story
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? MediaUrl { get; set; }
    public string MediaType { get; set; } = "Image"; // Image, Video, Text
    public string? Content { get; set; } // For Text Story
    public string? Background { get; set; } // Gradient or Color hex
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public StoryPrivacy Privacy { get; set; } = StoryPrivacy.Public;

    public virtual User User { get; set; } = null!;
    public virtual ICollection<StoryLike> StoryLikes { get; set; } = new List<StoryLike>();
    public virtual ICollection<StoryView> StoryViews { get; set; } = new List<StoryView>();
}

public class StoryLike
{
    public Guid StoryId { get; set; }
    public Guid UserId { get; set; }
    public virtual Story Story { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}

public class StoryView
{
    public Guid StoryId { get; set; }
    public Guid UserId { get; set; }
    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;
    public virtual Story Story { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
