namespace Blog.Domain.Entities;

public class Tag
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }

    public virtual ICollection<PostTag> PostTags { get; set; } = new List<PostTag>();
}

public class PostTag
{
    public Guid PostId { get; set; }
    public Guid TagId { get; set; }

    public virtual Post Post { get; set; } = null!;
    public virtual Tag Tag { get; set; } = null!;
}