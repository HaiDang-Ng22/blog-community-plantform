using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Caching.Memory;

namespace Blog.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;
    private readonly IMemoryCache _cache;

    public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService, IMemoryCache cache)
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

        // Generate 6-digit OTP
        var otp = new Random().Next(100000, 999999).ToString();
        
        // Store in cache for 5 minutes (Tuple: Code, RegistrationData)
        _cache.Set($"OTP_{request.Email}", (Otp: otp, Data: request), TimeSpan.FromMinutes(5));

        try 
        {
            await _emailService.SendEmailAsync(request.Email, "Xác thực tài khoản Zynk Social", 
                $@"<div style='font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                    <h2 style='color: #6366f1;'>Chào mừng bạn đến với Zynk!</h2>
                    <p>Mã xác thực của bạn là:</p>
                    <div style='font-size: 2.5rem; font-weight: 800; color: #6366f1; letter-spacing: 5px; margin: 20px 0;'>{otp}</div>
                    <p style='color: #64748b; font-size: 0.85rem;'>Mã này sẽ hết hạn trong 5 phút.</p>
                   </div>");
            return Ok(new { message = "Mã xác thực đã được gửi về email của bạn." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Lỗi gửi mail: " + ex.Message });
        }
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        if (!_cache.TryGetValue($"OTP_{request.Email}", out (string Otp, RegisterRequest Data) cachedData))
            return BadRequest(new { message = "Mã xác thực đã hết hạn hoặc không tồn tại." });

        if (cachedData.Otp != request.Otp)
            return BadRequest(new { message = "Mã xác thực không chính xác." });

        // OTP is correct, create user
        var regData = cachedData.Data;
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = regData.Email,
            Username = regData.Email.Split('@')[0],
            FullName = regData.FullName,
            Gender = regData.Gender,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(regData.Password),
            CreatedAt = DateTime.UtcNow,
            IsEmailConfirmed = true,
            Role = "User"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _cache.Remove($"OTP_{request.Email}");

        return Ok(new { message = "Xác thực và đăng ký thành công!" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse { Id = user.Id, Token = token, Email = user.Email, Username = user.Username, FullName = user.FullName, AvatarUrl = user.AvatarUrl, Role = user.Role, IsVerified = user.IsVerified, IsPremium = user.IsPremium, PremiumExpiryDate = user.PremiumExpiryDate });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
            return BadRequest(new { message = "Email này không tồn tại trên hệ thống." });

        var otp = new Random().Next(100000, 999999).ToString();
        _cache.Set($"RESET_OTP_{request.Email}", otp, TimeSpan.FromMinutes(10));

        try
        {
            await _emailService.SendEmailAsync(request.Email, "Khôi phục mật khẩu Zynk Social",
                $@"<div style='font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                    <h2 style='color: #6366f1;'>Yêu cầu khôi phục mật khẩu</h2>
                    <p>Mã xác thực của bạn là:</p>
                    <div style='font-size: 2rem; font-weight: 800; color: #ef4444; letter-spacing: 5px; margin: 20px 0;'>{otp}</div>
                    <p style='color: #64748b; font-size: 0.85rem;'>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
                   </div>");
            return Ok(new { message = "Mã xác thực đã được gửi về email của bạn." });
        }
        catch (Exception ex) { return BadRequest(new { message = "Lỗi gửi mail: " + ex.Message }); }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (!_cache.TryGetValue($"RESET_OTP_{request.Email}", out string? cachedOtp) || cachedOtp != request.Otp)
            return BadRequest(new { message = "Mã xác thực không chính xác hoặc đã hết hạn." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null) return NotFound();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        _cache.Remove($"RESET_OTP_{request.Email}");
        return Ok(new { message = "Đổi mật khẩu thành công. Hãy đăng nhập lại." });
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
            CoverImageUrl = user.CoverImageUrl,
            Bio = user.Bio,
            Gender = user.Gender,
            CreatedAt = user.CreatedAt,
            IsPrivate = user.IsPrivate,
            Role = user.Role,
            IsVerified = user.IsVerified,
            IsPremium = user.IsPremium,
            PremiumExpiryDate = user.PremiumExpiryDate
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

        if (!string.IsNullOrEmpty(user.PasswordHash) && !BCrypt.Net.BCrypt.Verify(request.OldPassword, user.PasswordHash))
            return BadRequest(new { message = "Mật khẩu cũ không chính xác." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đổi mật khẩu thành công." });
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
                    Role = "User",
                    IsEmailConfirmed = true
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            var token = GenerateJwtToken(user);
            return Ok(new AuthResponse { Id = user.Id, Token = token, Email = user.Email, Username = user.Username, FullName = user.FullName, AvatarUrl = user.AvatarUrl, Role = user.Role, IsVerified = user.IsVerified, IsPremium = user.IsPremium, PremiumExpiryDate = user.PremiumExpiryDate });
        }
        catch (InvalidJwtException)
        {
            return BadRequest(new { message = "Token Google không hợp lệ." });
        }
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
