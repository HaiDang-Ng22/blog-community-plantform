namespace Blog.Application.Dtos;

public class CreateGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public bool IsPrivate { get; set; } = false;
}
