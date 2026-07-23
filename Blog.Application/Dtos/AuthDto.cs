namespace Blog.Application.Dtos;

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Gender { get; set; } = "Other";
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class GoogleLoginRequest
{
    public string IdToken { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class AuthResponse
{
    public Guid Id { get; set; }
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = "User";
    public bool IsVerified { get; set; } = false;
    public bool IsPremium { get; set; } = false;
    public DateTime? PremiumExpiryDate { get; set; }
}

public class UserProfileResponse
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? Bio { get; set; }
    public string Gender { get; set; } = "Other";
    public DateTime CreatedAt { get; set; }
    public bool IsPrivate { get; set; }
    public string Role { get; set; } = "User";
    public bool IsVerified { get; set; } = false;
    public bool IsPremium { get; set; } = false;
    public DateTime? PremiumExpiryDate { get; set; }
}

public class UpdatePrivacyRequest
{
    public bool IsPrivate { get; set; }
}

public class UpdateProfileRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public string? CoverImageUrl { get; set; }
    public string Gender { get; set; } = "Other";
}

public class SearchResultDto
{
    public List<UserSearchResult> Users { get; set; } = new();
    public List<PostSearchResult> Posts { get; set; } = new();
    public List<ReelSearchResult> Reels { get; set; } = new();
    public List<HashtagSearchResult> Hashtags { get; set; } = new();
    public List<GroupSearchResult> Groups { get; set; } = new();
    public List<ProductSearchResult> Products { get; set; } = new();
    public List<ShopSearchResult> Shops { get; set; } = new();
}

public class UserSearchResult
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
}

public class PostSearchResult
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Content { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatarUrl { get; set; }
    public int LikeCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ReelSearchResult
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? VideoUrl { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatarUrl { get; set; }
    public int LikeCount { get; set; }
}

public class HashtagSearchResult
{
    public string Name { get; set; } = string.Empty;
    public int PostCount { get; set; }
}

public class GroupSearchResult
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? AvatarUrl { get; set; }
    public int MemberCount { get; set; }
    public bool IsPublic { get; set; }
}

public class ProductSearchResult
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string ShopName { get; set; } = string.Empty;
}

public class ShopSearchResult
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsVerified { get; set; }
    public double Rating { get; set; } = 5.0;
    public int FollowerCount { get; set; }
    public int ProductCount { get; set; }
}

public class AiSearchResultItemDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public double Score { get; set; }
    public string Explanation { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class VerifyOtpRequest
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public RegisterRequest? RegistrationData { get; set; }
}
