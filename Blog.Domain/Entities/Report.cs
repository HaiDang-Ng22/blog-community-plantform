namespace Blog.Domain.Entities;

public class Report
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Guid ReporterId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsResolved { get; set; } = false;

    // Navigation properties
    public virtual Post Post { get; set; } = null!;
    public virtual User Reporter { get; set; } = null!;
}
