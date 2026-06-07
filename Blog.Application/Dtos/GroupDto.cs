namespace Blog.Application.Dtos;

public class GroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public bool IsPrivate { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid OwnerId { get; set; }
    public int MemberCount { get; set; }
    public bool IsMember { get; set; }
    public string? Role { get; set; } // "Admin" or "Member"
}
