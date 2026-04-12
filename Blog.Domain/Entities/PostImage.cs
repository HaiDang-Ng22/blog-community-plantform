using System.ComponentModel.DataAnnotations;

namespace Blog.Domain.Entities;

public class PostImage
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public string Url { get; set; } = string.Empty;
    public int OrderIndex { get; set; } = 0;

    // Navigation property
    public virtual Post Post { get; set; } = null!;
}
