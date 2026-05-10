using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Blog.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly Blog.Domain.Interfaces.IEmailService _emailService;
    private readonly Microsoft.Extensions.Caching.MemoryCache.IMemoryCache _cache;

    public AuthController(AppDbContext context, IConfiguration configuration, Blog.Domain.Interfaces.IEmailService emailService, Microsoft.Extensions.Caching.MemoryCache.IMemoryCache cache)
    {
        _context = context;
        _configuration = configuration;
        _emailService = emailService;
        _cache = cache;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest(new { message = "Email đã được sử dụng." });

        if (request.Password.Length < 8 || 
            !request.Password.Any(char.IsUpper) || 
            !request.Password.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            return BadRequest(new { message = "Mật khẩu không thỏa mãn yêu cầu bảo mật (8 ký tự, có chữ hoa và ký tự đặc biệt)." });
        }

        // Generate 6-digit OTP
        var otp = new Random().Next(100000, 999999).ToString();
        
        // Store in cache for 5 minutes
        _cache.Set($"OTP_{request.Email}", new { Otp = otp, Data = request }, TimeSpan.FromMinutes(5));

        try 
        {
            await _emailService.SendEmailAsync(request.Email, "Mã xác thực đăng ký Zynk Social", 
                $@"<div style='font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                    <h2 style='color: #6366f1;'>Chào mừng bạn đến với Zynk!</h2>
                    <p>Mã xác thực đăng ký của bạn là:</p>
                    <div style='font-size: 2rem; font-weight: 800; color: #1e293b; letter-spacing: 5px; margin: 20px 0;'>{otp}</div>
                    <p style='color: #64748b; font-size: 0.85rem;'>Mã này sẽ hết hạn sau 5 phút.</p>
                   </div>");

            return Ok(new { message = "Mã xác thực đã được gửi về email của bạn." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Không thể gửi mail xác thực: " + ex.Message });
        }
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        if (!_cache.TryGetValue($"OTP_{request.Email}", out dynamic cachedData))
            return BadRequest(new { message = "Mã xác thực đã hết hạn hoặc không tồn tại." });

        if (cachedData.Otp != request.Otp)
            return BadRequest(new { message = "Mã xác thực không chính xác." });

        // OTP is correct, create user
        var regData = (RegisterRequest)cachedData.Data;
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = regData.Email,
            Username = regData.Email.Split('@')[0],
            FullName = regData.FullName,
            Gender = regData.Gender,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(regData.Password),
            IsEmailConfirmed = true, // Marked as confirmed
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Clear cache
        _cache.Remove($"OTP_{request.Email}");

        return Ok(new { message = "Xác thực thành công. Tài khoản của bạn đã được tạo." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse { Id = user.Id, Token = token, Email = user.Email, Username = user.Username, FullName = user.FullName, AvatarUrl = user.AvatarUrl, Role = user.Role });
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);
            if (user == null)
            {
                user = new User
                {
                    Id = Guid.NewGuid(),
                    Email = payload.Email,
                    Username = payload.Email.Split('@')[0],
                    FullName = payload.Name,
                    AvatarUrl = payload.Picture,
                    Gender = "Other",
                    PasswordHash = string.Empty, 
                    GoogleId = payload.Subject,
                    CreatedAt = DateTime.UtcNow,
                    Role = "User"
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            var token = GenerateJwtToken(user);
            return Ok(new AuthResponse { Id = user.Id, Token = token, Email = user.Email, Username = user.Username, FullName = user.FullName, AvatarUrl = user.AvatarUrl, Role = user.Role });
        }
        catch (InvalidJwtException)
        {
            return BadRequest(new { message = "Token Google không hợp lệ." });
        }
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile()
    {
        var userId = User.GetUserId();
        if (userId == null)
            return Unauthorized(new { message = "Không xác định được người dùng" });

        var user = await _context.Users.FindAsync(userId.Value);

        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại" });

        return Ok(new UserProfileResponse
        {
            Id = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            Email = user.Email,
            AvatarUrl = user.AvatarUrl,
            Bio = user.Bio,
            Gender = user.Gender,
            CreatedAt = user.CreatedAt,
            IsPrivate = user.IsPrivate,
            Role = user.Role
        });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.GetUserId();
        if (userId == null)
            return Unauthorized(new { message = "Không xác định được người dùng" });

        var user = await _context.Users.FindAsync(userId.Value);

        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại" });

        // Verify old password
        if (!string.IsNullOrEmpty(user.PasswordHash) && !BCrypt.Net.BCrypt.Verify(request.OldPassword, user.PasswordHash))
            return BadRequest(new { message = "Mật khẩu cũ không chính xác." });

        // Validate new password rules (8+ chars, uppercase, special)
        if (request.NewPassword.Length < 8 || 
            !request.NewPassword.Any(char.IsUpper) || 
            !request.NewPassword.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            return BadRequest(new { message = "Mật khẩu mới không thỏa mãn yêu cầu (8 ký tự, có chữ hoa và ký tự đặc biệt)." });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đổi mật khẩu thành công." });
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("FullName", user.FullName)
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
