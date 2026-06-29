namespace Blog.Application.Dtos;

public class UpdateGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? AvatarImageUrl { get; set; }
    public bool IsPrivate { get; set; }
}
