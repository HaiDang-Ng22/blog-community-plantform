namespace Blog.Domain.Entities;

public class Comment
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid PostId { get; set; }
    public Guid AuthorId { get; set; }
    public Guid? ParentCommentId { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsApproved { get; set; } = true;

    // Navigation properties
    public virtual Post Post { get; set; } = null!;
    public virtual User Author { get; set; } = null!;
    public virtual Comment? ParentComment { get; set; }
    public virtual ICollection<Comment> Replies { get; set; } = new List<Comment>();
}