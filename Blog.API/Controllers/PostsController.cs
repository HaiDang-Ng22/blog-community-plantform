using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Blog.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Blog.API.Extensions;
using Blog.API.Services;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly IPostRepository _postRepository; // Đổi từ IRepository sang IPostRepository
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<Tag> _tagRepository;
    private readonly AppDbContext _context;
    private readonly INotificationService _notiService;

    public PostsController(
        IPostRepository postRepository,
        IRepository<User> userRepository,
        IRepository<Tag> tagRepository,
        AppDbContext context,
        INotificationService notiService)
    {
        _postRepository = postRepository;
        _userRepository = userRepository;
        _tagRepository = tagRepository;
        _context = context;
        _notiService = notiService;
    }

    // GET: api/posts
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string type = "fyp")
    {
        // Lấy UserId an toàn từ Token
        var currentUserIdStr = User.GetUserIdStr();
                             
        Guid? currentUserId = !string.IsNullOrEmpty(currentUserIdStr) ? Guid.Parse(currentUserIdStr) : null;
 
        List<Guid> followingIds = new List<Guid>();
        List<Guid> blockedIds = new List<Guid>();
        List<Guid> savedPostIds = new List<Guid>();
        List<Guid> likedPostIds = new List<Guid>();
        List<Guid> favoriteTagIds = new List<Guid>();

        if (currentUserId.HasValue)
        {
            followingIds = await _context.Follows
                .Where(f => f.FollowerId == currentUserId.Value)
                .Select(f => f.FollowingId)
                .ToListAsync();

            blockedIds = await _context.Blocks
                .Where(b => b.BlockerId == currentUserId.Value)
                .Select(b => b.BlockedId)
                .ToListAsync();

            savedPostIds = await _context.SavedPosts
                .Where(sp => sp.UserId == currentUserId.Value)
                .Select(sp => sp.PostId)
                .ToListAsync();

            likedPostIds = await _context.PostLikes
                .Where(l => l.UserId == currentUserId.Value)
                .Select(l => l.PostId)
                .ToListAsync();

            var userInteractedPostIds = likedPostIds.Concat(savedPostIds).Distinct().ToList();

            favoriteTagIds = await _context.PostTags
                .Where(pt => userInteractedPostIds.Contains(pt.PostId))
                .Select(pt => pt.TagId)
                .Distinct()
                .ToListAsync();

            HttpContext.Items["SavedPostIds"] = savedPostIds;
        }

        IQueryable<Post> query = _context.Posts
            .Include(p => p.Author)
            .Include(p => p.Images)
            .Include(p => p.PostLikes)
            .Include(p => p.Comments)
            .Include(p => p.Poll)
                .ThenInclude(poll => poll.Options)
            .Where(p => p.Status == PostStatus.Published && !blockedIds.Contains(p.AuthorId));

        List<Post> posts = new List<Post>();

        if (type == "following")
        {
            if (!currentUserId.HasValue)
            {
                return Ok(new List<PostDto>());
            }

            Console.WriteLine($">>> DEBUG: Loading Following Feed for User {currentUserId.Value}");
            Console.WriteLine($">>> DEBUG: User is following {followingIds.Count} people");

            if (followingIds.Count > 0)
            {
                // Chỉ lấy bài viết của người mình follow HOẶC của chính mình
                var validAuthors = followingIds.ToList();
                validAuthors.Add(currentUserId.Value);
                
                query = query.Where(p => validAuthors.Contains(p.AuthorId));
                
                Console.WriteLine($">>> DEBUG: Filtering posts by {validAuthors.Count} allowed authors");
            }
            else 
            {
                Console.WriteLine(">>> DEBUG: User follows nobody, returning empty list.");
                return Ok(new List<PostDto>());
            }

            posts = await query
                .OrderByDescending(p => p.PublishedAt)
                .Take(50)
                .ToListAsync();
        }
        else if (type == "discover")
        {
            // Lấy tất cả bài viết công khai, ưu tiên người mình follow + bài viết ngẫu nhiên của người lạ
            query = query.Where(p => 
                !p.Author.IsPrivate || 
                (currentUserId.HasValue && p.AuthorId == currentUserId.Value) ||
                (currentUserId.HasValue && followingIds.Contains(p.AuthorId))
            );

            posts = await query
                .OrderByDescending(p => p.PublishedAt)
                .Take(50)
                .ToListAsync();
        }
        else if (type == "fyp")
        {
            // TikTok-like algorithm
            query = query.Where(p => 
                !p.Author.IsPrivate || 
                (currentUserId.HasValue && p.AuthorId == currentUserId.Value) ||
                (currentUserId.HasValue && followingIds.Contains(p.AuthorId))
            );

            var candidates = await query
                .OrderByDescending(p => p.PublishedAt)
                .Take(150) // Take a larger candidate pool to rank
                .ToListAsync();

            var candidateIds = candidates.Select(p => p.Id).ToList();
            var postTagsMap = await _context.PostTags
                .Where(pt => candidateIds.Contains(pt.PostId))
                .ToListAsync();

            var rand = new Random();
            
            var scored = candidates.Select(p => 
            {
                double score = 0.0;
                
                // 1. Recency Decay (Max 50 points, decays rapidly with age in hours)
                var ageInHours = (DateTime.UtcNow - p.CreatedAt).TotalHours;
                score += 100.0 / (ageInHours + 2.0);

                // 2. Social Popularity (Likes, comments, views)
                score += p.LikeCount * 5.0;
                score += p.Comments.Count * 10.0;
                score += p.ViewCount * 0.5;

                // 3. User Interest Matching (if logged in)
                if (currentUserId.HasValue)
                {
                    // Follow status bonus
                    if (followingIds.Contains(p.AuthorId))
                    {
                        score += 50.0;
                    }

                    // User has liked this author's posts before boost
                    if (p.AuthorId == currentUserId.Value)
                    {
                        score += 30.0; // Show user's own posts occasionally
                    }

                    // Tags matching favorite tags
                    var postTagIds = postTagsMap.Where(pt => pt.PostId == p.Id).Select(pt => pt.TagId).ToList();
                    var matchingTagsCount = postTagIds.Intersect(favoriteTagIds).Count();
                    score += matchingTagsCount * 30.0;
                }

                // 4. TikTok Random Exploration factor (0 - 20 points)
                score += rand.NextDouble() * 20.0;

                return new { Post = p, Score = score };
            })
            .OrderByDescending(x => x.Score)
            .Take(50)
            .ToList();

            posts = scored.Select(x => x.Post).ToList();
        }
        else
        {
            // Default to fyp
            query = query.Where(p => 
                !p.Author.IsPrivate || 
                (currentUserId.HasValue && p.AuthorId == currentUserId.Value) ||
                (currentUserId.HasValue && followingIds.Contains(p.AuthorId))
            );

            posts = await query
                .OrderByDescending(p => p.PublishedAt)
                .Take(50)
                .ToListAsync();
        }

        var postDtos = posts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ViewCount = p.ViewCount,
            LikeCount = p.LikeCount,
            Status = p.Status.ToString(),
            AuthorName = p.IsAnonymous ? "Người dùng Ẩn danh" : (p.Author?.FullName ?? "Người dùng"),
            AuthorAvatarUrl = p.IsAnonymous ? "/img/default-anonymous.png" : p.Author?.AvatarUrl,
            AuthorId = p.IsAnonymous ? Guid.Empty : p.AuthorId,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
            CommentCount = p.Comments.Count,
            IsLikedByMe = currentUserId.HasValue && p.PostLikes.Any(l => l.UserId == currentUserId.Value),
            IsSavedByMe = currentUserId.HasValue && ((List<Guid>?)HttpContext.Items["SavedPostIds"])?.Contains(p.Id) == true,
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            Type = p.Type.ToString(),
            VideoUrl = p.VideoUrl,
            IsAnonymous = p.IsAnonymous,
            Poll = p.Poll == null ? null : new PollDto
            {
                Id = p.Poll.Id,
                Question = p.Poll.Question,
                IsExpired = p.Poll.EndsAt.HasValue && p.Poll.EndsAt.Value < DateTime.UtcNow,
                TotalVotes = p.Poll.Options.Sum(o => o.VoteCount),
                Options = p.Poll.Options.Select(o => new PollOptionDto
                {
                    Id = o.Id,
                    Text = o.Text,
                    VoteCount = o.VoteCount,
                    Percentage = p.Poll.Options.Sum(x => x.VoteCount) == 0 ? 0 : (double)o.VoteCount / p.Poll.Options.Sum(x => x.VoteCount) * 100
                }).ToList(),
                HasVoted = currentUserId.HasValue && _context.PollVotes.Any(pv => pv.PollId == p.Poll.Id && pv.UserId == currentUserId.Value),
                SelectedOptionId = currentUserId.HasValue ? _context.PollVotes.FirstOrDefault(pv => pv.PollId == p.Poll.Id && pv.UserId == currentUserId.Value)?.OptionId : null
            }
        });
        
        return Ok(postDtos);
    }

    // GET: api/posts/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var currentUserIdStr = User.GetUserIdStr();
        Guid? currentUserId = !string.IsNullOrEmpty(currentUserIdStr) ? Guid.Parse(currentUserIdStr) : null;

        var post = await _context.Posts
            .Include(p => p.Author)
            .Include(p => p.Images)
            .Include(p => p.PostLikes)
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });
        
        // Tăng view count
        post.ViewCount++;
        await _context.SaveChangesAsync();
        
        var postDto = new PostDto
        {
            Id = post.Id,
            Title = post.Title,
            Slug = post.Slug,
            Content = post.Content,
            Summary = post.Summary,
            FeaturedImageUrl = post.FeaturedImageUrl,
            ViewCount = post.ViewCount,
            LikeCount = post.LikeCount,
            Status = post.Status.ToString(),
            AuthorName = post.IsAnonymous ? "Người dùng Ẩn danh" : (post.Author?.FullName ?? "Người dùng"),
            AuthorAvatarUrl = post.IsAnonymous ? "/img/default-anonymous.png" : post.Author?.AvatarUrl,
            AuthorId = post.IsAnonymous ? Guid.Empty : post.AuthorId,
            CreatedAt = post.CreatedAt,
            PublishedAt = post.PublishedAt,
            CommentCount = post.Comments.Count,
            IsLikedByMe = currentUserId.HasValue && post.PostLikes.Any(l => l.UserId == currentUserId.Value),
            ImageUrls = post.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            IsAnonymous = post.IsAnonymous
        };
        
        return Ok(postDto);
    }

    // POST: api/posts
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreatePostDto createPostDto)
    {
        // Lấy UserId từ Claims của Token
        var userId = User.GetUserId();
        if (userId == null)
            return Unauthorized(new { message = "Không xác định được người dùng" });

        // Check for banned words
        var bannedWords = await _context.BannedWords.Select(b => b.Word.ToLower()).ToListAsync();
        var postTextToHheck = $"{createPostDto.Title} {createPostDto.Summary} {createPostDto.Content}".ToLower();
        
        foreach (var word in bannedWords)
        {
            if (!string.IsNullOrWhiteSpace(word) && postTextToHheck.Contains(word))
            {
                return BadRequest(new { message = "Bài viết chứa ngôn từ không phù hợp." });
            }
        }

        var postId = Guid.NewGuid();
        // Improved slug generation - Version 2 (Robust Fix)
        var titleForSlug = string.IsNullOrWhiteSpace(createPostDto.Title) || createPostDto.Title == "Post"
            ? (!string.IsNullOrWhiteSpace(createPostDto.Content) 
                ? (createPostDto.Content.Length > 50 ? createPostDto.Content.Substring(0, 50) : createPostDto.Content)
                : "post")
            : createPostDto.Title;

        var cleanSlug = titleForSlug
            .ToLower()
            .Replace(" ", "-")
            .Replace("đ", "d")
            .Replace("Đ", "d");
        
        // Remove special characters and ensure it's not empty
        cleanSlug = new string(cleanSlug.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray()).Trim('-');
        if (string.IsNullOrWhiteSpace(cleanSlug)) cleanSlug = "post";

        // Always append 8 chars of Guid to ensure uniqueness
        var finalSlug = $"{cleanSlug}-{postId.ToString().Substring(0, 8)}";
        
        var post = new Post
        {
            Id = postId,
            Title = createPostDto.Title ?? "Post",
            Slug = finalSlug,
            Content = createPostDto.Content,
            Summary = createPostDto.Summary,
            FeaturedImageUrl = createPostDto.ImageUrls.FirstOrDefault() ?? createPostDto.FeaturedImageUrl,
            Status = PostStatus.Published,
            AuthorId = userId.Value,
            CreatedAt = DateTime.UtcNow,
            PublishedAt = DateTime.UtcNow,
            Images = createPostDto.ImageUrls.Select((url, index) => new PostImage
            {
                Id = Guid.NewGuid(),
                Url = url,
                OrderIndex = index
            }).ToList(),
            Type = Enum.TryParse<PostType>(createPostDto.Type, true, out var postType) ? postType : PostType.Standard,
            VideoUrl = createPostDto.VideoUrl,
            IsAnonymous = createPostDto.IsAnonymous,
            Poll = createPostDto.Poll == null ? null : new Poll
            {
                Question = createPostDto.Poll.Question,
                EndsAt = createPostDto.Poll.DurationHours.HasValue 
                    ? DateTime.UtcNow.AddHours(createPostDto.Poll.DurationHours.Value) 
                    : null,
                Options = createPostDto.Poll.Options.Select(o => new PollOption { Text = o }).ToList()
            }
        };
        
        await _postRepository.AddAsync(post);
        
        return Ok(new { message = "Đăng bài thành công", id = post.Id });
    }

    // GET: api/posts/user/{userId}
    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetByUser(Guid userId)
    {
        var posts = await _postRepository.GetPostsByAuthorIdAsync(userId);
        
        // Không hiển thị các bài viết ẩn danh trên trang profile công khai
        posts = posts.Where(p => !p.IsAnonymous).ToList();

        var currentUserIdStr = User.GetUserIdStr();
        Guid? currentUserId = !string.IsNullOrEmpty(currentUserIdStr) ? Guid.Parse(currentUserIdStr) : null;

        var postDtos = posts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ViewCount = p.ViewCount,
            LikeCount = p.LikeCount,
            Status = p.Status.ToString(),
            AuthorName = p.Author?.FullName ?? "Người dùng",
            AuthorAvatarUrl = p.Author?.AvatarUrl,
            AuthorId = p.AuthorId,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
            CommentCount = p.Comments.Count,
            IsLikedByMe = currentUserId.HasValue && p.PostLikes.Any(l => l.UserId == currentUserId.Value),
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            IsAnonymous = false
        });

        return Ok(postDtos);
    }

    // GET: api/posts/me
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMyPosts()
    {
        var userId = User.GetUserId();
        if (userId == null)
            return Unauthorized(new { message = "Không xác định được người dùng" });

        var posts = await _postRepository.GetPostsByAuthorIdAsync(userId.Value);
        
        var postDtos = posts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ViewCount = p.ViewCount,
            LikeCount = p.LikeCount,
            Status = p.Status.ToString(),
            AuthorName = p.IsAnonymous ? "Người dùng Ẩn danh (Bạn)" : (p.Author?.FullName ?? "Tôi"),
            AuthorAvatarUrl = p.IsAnonymous ? "/img/default-anonymous.png" : p.Author?.AvatarUrl,
            AuthorId = p.AuthorId,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
            CommentCount = p.Comments.Count,
            IsLikedByMe = p.PostLikes.Any(l => l.UserId == userId.Value),
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            IsAnonymous = p.IsAnonymous
        });

        return Ok(postDtos);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePostDto updatePostDto)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        if (post.AuthorId != userId)
            return Forbid();
            
        // Check for banned words
        var bannedWords = await _context.BannedWords.Select(b => b.Word.ToLower()).ToListAsync();
        var postTextToHheck = $"{updatePostDto.Title} {updatePostDto.Summary} {updatePostDto.Content}".ToLower();
        
        foreach (var word in bannedWords)
        {
            if (!string.IsNullOrWhiteSpace(word) && postTextToHheck.Contains(word))
            {
                return BadRequest(new { message = "Bài viết chứa ngôn từ không phù hợp." });
            }
        }
        
        post.Title = updatePostDto.Title;
        post.Content = updatePostDto.Content;
        post.Summary = updatePostDto.Summary;
        post.FeaturedImageUrl = updatePostDto.FeaturedImageUrl ?? updatePostDto.ImageUrls?.FirstOrDefault();
        post.UpdatedAt = DateTime.UtcNow;
        
        // Remove old images
        var existingImages = await _context.PostImages.Where(i => i.PostId == id).ToListAsync();
        _context.PostImages.RemoveRange(existingImages);

        // Add new images
        if (updatePostDto.ImageUrls != null && updatePostDto.ImageUrls.Any())
        {
            var newImages = updatePostDto.ImageUrls.Select((url, index) => new PostImage
            {
                Id = Guid.NewGuid(),
                PostId = id,
                Url = url,
                OrderIndex = index
            });
            await _context.PostImages.AddRangeAsync(newImages);
        }

        await _postRepository.UpdateAsync(post);
        return Ok(new { message = "Cập nhật thành công" });
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id)
    {
        var post = await _postRepository.GetByIdAsync(id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài viết" });

        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        if (post.AuthorId != userId)
            return Forbid();
        
        // Hard-delete orphaned notifications first
        var staledNotifications = await _context.Notifications.Where(n => n.TargetId == id).ToListAsync();
        if (staledNotifications.Any()) {
            _context.Notifications.RemoveRange(staledNotifications);
        }

        // Hard-delete post (cascade deletes Comments, PostLikes, PostTags, PostImages)
        await _postRepository.DeleteAsync(post); // Calls SaveChangesAsync internally, which commits the Notifications deletion as well
        
        return Ok(new { message = "Xóa thành công" });
    }

    [HttpPost("{id}/like")]
    [Authorize]
    public async Task<IActionResult> LikePost(Guid id)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty) return Unauthorized();
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();

        var existingLike = await _context.PostLikes
            .FirstOrDefaultAsync(l => l.PostId == id && l.UserId == userId);

        bool isLiked;
        if (existingLike != null)
        {
            _context.PostLikes.Remove(existingLike);
            post.LikeCount = Math.Max(0, post.LikeCount - 1);
            isLiked = false;
        }
        else
        {
            var like = new PostLike
            {
                PostId = id,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _context.PostLikes.Add(like);
            post.LikeCount++;
            isLiked = true;

            // Thông báo realtime
            await _notiService.SendNotificationAsync(post.AuthorId, userId, "Like", id, "đã thích bài viết của bạn.");
        }

        await _context.SaveChangesAsync();
        return Ok(new { isLiked, likeCount = post.LikeCount });
    }
}