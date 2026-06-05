namespace Blog.Application.Dtos;

public class PostDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public int ViewCount { get; set; }
    public int LikeCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public bool AuthorIsPremium { get; set; }
    public string? AuthorAvatarUrl { get; set; }
    public Guid AuthorId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int CommentCount { get; set; }
    public bool IsLikedByMe { get; set; }
    public bool IsSavedByMe { get; set; }
    public List<string> ImageUrls { get; set; } = new List<string>();
    public string Type { get; set; } = "Standard";
    public string? VideoUrl { get; set; }
    public PollDto? Poll { get; set; }
    public bool IsAnonymous { get; set; }
}

public class PollDto
{
    public Guid Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public List<PollOptionDto> Options { get; set; } = new();
    public bool HasVoted { get; set; }
    public Guid? SelectedOptionId { get; set; }
    public int TotalVotes { get; set; }
    public bool IsExpired { get; set; }
}

public class PollOptionDto
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public int VoteCount { get; set; }
    public double Percentage { get; set; }
}

public class CreatePollDto
{
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public int? DurationHours { get; set; }
}

public class CreatePostDto
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public List<string> ImageUrls { get; set; } = new List<string>();
    public string? VideoUrl { get; set; }
    public string Type { get; set; } = "Standard";
    public CreatePollDto? Poll { get; set; }
    public bool IsAnonymous { get; set; }
}

public class UpdatePostDto
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public List<string> ImageUrls { get; set; } = new List<string>();
}