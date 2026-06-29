namespace Blog.Application.Dtos;

public class GroupPendingMemberDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime RequestedAt { get; set; }
}
