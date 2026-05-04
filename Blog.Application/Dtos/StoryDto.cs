namespace Blog.Application.Dtos;

public class StoryDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatarUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string MediaType { get; set; } = "Image";
    public string? Content { get; set; }
    public string? Background { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string Privacy { get; set; } = "Public";
    
    // Interactions
    public bool IsLiked { get; set; }
    public int LikeCount { get; set; }
    public int ViewCount { get; set; }
    public List<StoryInteractionDto>? Likes { get; set; } // Only populated for author
    public List<StoryInteractionDto>? Viewers { get; set; } // Only populated for author
}

public class StoryInteractionDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

public class CreateStoryDto
{
    public string? MediaUrl { get; set; }
    public string MediaType { get; set; } = "Image"; // Image, Video, Text
    public string? Content { get; set; }
    public string? Background { get; set; }
    public int DurationHours { get; set; } = 24; // 12, 18, 24
    public string Privacy { get; set; } = "Public"; // Public, Friends
}
