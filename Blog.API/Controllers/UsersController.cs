using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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

        var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        bool isFollowing = false;
        if (!string.IsNullOrEmpty(currentUserIdStr))
        {
            var currentUserId = Guid.Parse(currentUserIdStr);
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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
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
        var followerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
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
        var blockerId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
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
    
    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var userId = Guid.Parse(userIdStr);
        var user = await _context.Users.FindAsync(userId);

        if (user == null) return NotFound();

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Tài khoản của bạn đã được xóa vĩnh viễn." });
    }
}
