using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id}/profile")]
    public async Task<IActionResult> GetUserProfile(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.Followers)
            .Include(u => u.Following)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound();

        var userIdStr = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        bool isFollowing = false;
        if (!string.IsNullOrEmpty(userIdStr))
        {
            var currentUserId = Guid.Parse(userIdStr);
            isFollowing = user.Followers.Any(f => f.FollowerId == currentUserId);
        }

        return Ok(new
        {
            user.Id,
            user.FullName,
            user.Username,
            user.AvatarUrl,
            user.CoverImageUrl,
            user.Bio,
            user.Gender,
            user.IsPrivate,
            FollowerCount = user.Followers.Count,
            FollowingCount = user.Following.Count,
            IsFollowing = isFollowing
        });
    }

    [HttpPut("me/privacy")]
    [Authorize]
    public async Task<IActionResult> UpdatePrivacy([FromBody] UpdatePrivacyRequest request)
    {
        var userIdStr = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var userId = Guid.Parse(userIdStr);
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.IsPrivate = request.IsPrivate;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Cập nhật quyền riêng tư thành công.", isPrivate = user.IsPrivate });
    }

    [HttpPost("{id}/follow")]
    [Authorize]
    public async Task<IActionResult> FollowUser(Guid id)
    {
        var followerId = Guid.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        if (followerId == id) return BadRequest(new { message = "Bạn không thể theo dõi chính mình." });

        // Check if blocked
        if (await _context.Blocks.AnyAsync(b => (b.BlockerId == followerId && b.BlockedId == id) || (b.BlockerId == id && b.BlockedId == followerId)))
        {
            return BadRequest(new { message = "Không thể theo dõi người dùng này." });
        }

        var follow = await _context.Follows
            .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == id);

        if (follow != null)
        {
            _context.Follows.Remove(follow);
            await _context.SaveChangesAsync();
            return Ok(new { isFollowing = false, message = "Đã bỏ theo dõi" });
        }

        follow = new Follow
        {
            FollowerId = followerId,
            FollowingId = id,
            CreatedAt = DateTime.UtcNow
        };

        _context.Follows.Add(follow);

        // Tạo thông báo
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = id,
            ActorId = followerId,
            Type = "Follow",
            TargetId = null,
            Message = "đã bắt đầu theo dõi bạn.",
            CreatedAt = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();
        return Ok(new { isFollowing = true, message = "Đã theo dõi" });
    }

    [HttpPost("{id}/block")]
    [Authorize]
    public async Task<IActionResult> BlockUser(Guid id)
    {
        var blockerId = Guid.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        if (blockerId == id) return BadRequest(new { message = "Bạn không thể chặn chính mình." });

        var block = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerId == blockerId && b.BlockedId == id);

        if (block != null)
        {
            _context.Blocks.Remove(block);
            await _context.SaveChangesAsync();
            return Ok(new { isBlocked = false, message = "Đã bỏ chặn người dùng này." });
        }

        block = new Block
        {
            BlockerId = blockerId,
            BlockedId = id,
            CreatedAt = DateTime.UtcNow
        };
        _context.Blocks.Add(block);

        // Xóa Follow cả hai phía
        var mutualFollows = await _context.Follows
            .Where(f => (f.FollowerId == blockerId && f.FollowingId == id) || (f.FollowerId == id && f.FollowingId == blockerId))
            .ToListAsync();
        
        if (mutualFollows.Any())
        {
            _context.Follows.RemoveRange(mutualFollows);
        }

        await _context.SaveChangesAsync();
        return Ok(new { isBlocked = true, message = "Đã chặn người dùng này." });
    }

    [HttpGet("me/blocked")]
    [Authorize]
    public async Task<IActionResult> GetBlockedUsers()
    {
        var userIdStr = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var userId = Guid.Parse(userIdStr);

        var blockedUsers = await _context.Blocks
            .Where(b => b.BlockerId == userId)
            .Include(b => b.Blocked)
            .Select(b => new
            {
                b.Blocked.Id,
                b.Blocked.FullName,
                b.Blocked.Username,
                b.Blocked.AvatarUrl,
                b.CreatedAt
            })
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        return Ok(blockedUsers);
    }

    
    [HttpGet("{id}/followers")]
    public async Task<IActionResult> GetFollowers(Guid id)
    {
        var followers = await _context.Follows
            .Where(f => f.FollowingId == id)
            .Include(f => f.Follower)
            .Select(f => new
            {
                f.Follower.Id,
                f.Follower.FullName,
                f.Follower.Username,
                f.Follower.AvatarUrl,
                f.Follower.Bio,
                CreatedAt = f.CreatedAt
            })
            .ToListAsync();
        return Ok(followers);
    }

    [HttpGet("{id}/following")]
    public async Task<IActionResult> GetFollowing(Guid id)
    {
        var following = await _context.Follows
            .Where(f => f.FollowerId == id)
            .Include(f => f.Following)
            .Select(f => new
            {
                f.Following.Id,
                f.Following.FullName,
                f.Following.Username,
                f.Following.AvatarUrl,
                f.Following.Bio,
                CreatedAt = f.CreatedAt
            })
            .ToListAsync();
        return Ok(following);
    }

    [HttpGet("{id}/friends")]
    public async Task<IActionResult> GetFriends(Guid id)
    {
        // Bạn bè = Theo dõi chéo (Reciprocal Follows)
        var followingIds = _context.Follows.Where(f => f.FollowerId == id).Select(f => f.FollowingId);
        
        var friends = await _context.Follows
            .Where(f => f.FollowingId == id && followingIds.Contains(f.FollowerId))
            .Include(f => f.Follower)
            .Select(f => new
            {
                f.Follower.Id,
                f.Follower.FullName,
                f.Follower.Username,
                f.Follower.AvatarUrl,
                f.Follower.Bio
            })
            .ToListAsync();
        
        return Ok(friends);
    }

    [HttpGet("suggested")]
    [Authorize]
    public async Task<IActionResult> GetSuggestedUsers()
    {
        try 
        {
            // Cách lấy UserId an toàn nhất cho mọi loại Token
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                          ?? User.FindFirst("sub")?.Value 
                          ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            
            if (string.IsNullOrEmpty(userIdStr)) 
            {
                Console.WriteLine(">>> GetSuggestedUsers: Unauthorized - No Sub claim found");
                return Unauthorized();
            }

            var userId = Guid.Parse(userIdStr);
            Console.WriteLine($">>> Loading suggestions for User: {userId}");

            var followingIds = await _context.Follows
                .Where(f => f.FollowerId == userId)
                .Select(f => f.FollowingId)
                .ToListAsync();
            
            // Gợi ý những người chưa theo dõi, không phải bản thân
            // Sử dụng Guid.NewGuid() nếu EF.Functions.Random() gặp vấn đề tùy phiên bản Provider
            var suggested = await _context.Users
                .Where(u => u.Id != userId && !followingIds.Contains(u.Id))
                .OrderBy(u => EF.Functions.Random()) 
                .Take(5)
                .Select(u => new {
                    u.Id,
                    u.Username,
                    u.FullName,
                    u.AvatarUrl
                })
                .ToListAsync();
            
            Console.WriteLine($">>> Found {suggested.Count} suggestions");
            return Ok(suggested);
        }
        catch (Exception ex)
        {
            Console.WriteLine($">>> CRITICAL ERROR in GetSuggestedUsers: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            // Trả về danh sách trống thay vì 500 để không làm lỗi giao diện
            return Ok(new List<object>()); 
        }
    }

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        var user = await _context.Users.FindAsync(userId);
        
        if (user == null) return NotFound();

        // Kiểm tra username duy nhất nếu thay đổi
        if (user.Username != request.Username)
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest(new { message = "Tên người dùng đã được sử dụng." });
            
            user.Username = request.Username;
        }

        user.FullName = request.FullName;
        user.Bio = request.Bio;
        user.AvatarUrl = request.AvatarUrl;
        user.CoverImageUrl = request.CoverImageUrl;
        user.Gender = request.Gender;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Cập nhật hồ sơ thành công.", username = user.Username });
    }

    [HttpDelete("me")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount()
    {
        var userIdStr = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var userId = Guid.Parse(userIdStr);
        var user = await _context.Users.FindAsync(userId);

        if (user == null) return NotFound();

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Tài khoản của bạn đã được xóa vĩnh viễn." });
    }
}
