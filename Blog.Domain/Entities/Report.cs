namespace Blog.Domain.Entities;

public enum ReportTargetType
{
    Post,
    Group
}

public class Report
{
    public Guid Id { get; set; }
    public Guid? PostId { get; set; }
    public Guid? GroupId { get; set; }
    public ReportTargetType TargetType { get; set; } = ReportTargetType.Post;
    public Guid ReporterId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsResolved { get; set; } = false;

    // Navigation properties
    public virtual Post? Post { get; set; }
    public virtual Group? Group { get; set; }
    public virtual User Reporter { get; set; } = null!;
}
