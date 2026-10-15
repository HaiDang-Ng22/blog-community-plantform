using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Blog.Infrastructure.Data;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Caching.Memory;

namespace Blog.API.Controllers;

public record OtpCacheRecord<T>(string Otp, T Data, int FailedAttempts = 0);

[Route("api/[controller]")]
[ApiController]
[EnableRateLimiting("AuthPolicy")]
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

    private static bool IsValidPassword(string? password, out string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            errorMessage = "Mật khẩu phải có độ dài tối thiểu 8 ký tự.";
            return false;
        }
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
        {
            errorMessage = "Mật khẩu phải bao gồm cả chữ cái và chữ số để đảm bảo an toàn.";
            return false;
        }
        errorMessage = string.Empty;
        return true;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return BadRequest(new { message = "Email không hợp lệ." });

        if (!IsValidPassword(request.Password, out var passwordError))
            return BadRequest(new { message = passwordError });

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail))
            return BadRequest(new { message = "Email đã được sử dụng." });

        // Generate 6-digit cryptographically secure OTP
        var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        request.Email = normalizedEmail;

        try 
        {
            await _emailService.SendEmailAsync(normalizedEmail, "Xác thực tài khoản Zynk Social", 
                $@"<div style='font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                    <h2 style='color: #6366f1;'>Chào mừng bạn đến với Zynk!</h2>
                    <p>Mã xác thực của bạn là:</p>
                    <div style='font-size: 2.5rem; font-weight: 800; color: #6366f1; letter-spacing: 5px; margin: 20px 0;'>{otp}</div>
                    <p style='color: #64748b; font-size: 0.85rem;'>Mã này sẽ hết hạn trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
                   </div>");

            // Cache OTP only after email is successfully sent
            _cache.Set($"OTP_{normalizedEmail}", new OtpCacheRecord<RegisterRequest>(otp, request, 0), TimeSpan.FromMinutes(5));
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
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!_cache.TryGetValue($"OTP_{normalizedEmail}", out OtpCacheRecord<RegisterRequest>? cachedData) || cachedData == null)
            return BadRequest(new { message = "Mã xác thực đã hết hạn hoặc không tồn tại." });

        if (cachedData.Otp != request.Otp)
        {
            var attempts = cachedData.FailedAttempts + 1;
            if (attempts >= 5)
            {
                _cache.Remove($"OTP_{normalizedEmail}");
                return BadRequest(new { message = "Bạn đã nhập sai mã xác thực quá 5 lần. Mã này đã bị vô hiệu hóa vì lý do bảo mật." });
            }

            _cache.Set($"OTP_{normalizedEmail}", cachedData with { FailedAttempts = attempts }, TimeSpan.FromMinutes(5));
            return BadRequest(new { message = $"Mã xác thực không chính xác. Bạn còn lại {5 - attempts} lần thử." });
        }

        // OTP is correct, create user with strictly User role
        var regData = cachedData.Data;
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            Username = normalizedEmail.Split('@')[0].Trim(),
            FullName = regData.FullName?.Trim() ?? string.Empty,
            Gender = regData.Gender,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(regData.Password),
            CreatedAt = DateTime.UtcNow,
            IsEmailConfirmed = true,
            Role = "User",
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _cache.Remove($"OTP_{normalizedEmail}");

        return Ok(new { message = "Xác thực và đăng ký thành công!" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        
        if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

        if (!user.IsActive)
            return Unauthorized(new { message = "Tài khoản của bạn đã bị khóa hoặc tạm ngưng." });

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse { Id = user.Id, Token = token, Email = user.Email, Username = user.Username, FullName = user.FullName, AvatarUrl = user.AvatarUrl, Role = user.Role, IsVerified = user.IsVerified, IsPremium = user.IsPremium, PremiumExpiryDate = user.PremiumExpiryDate });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        if (user == null)
            return BadRequest(new { message = "Email này không tồn tại trên hệ thống." });

        // Generate 6-digit cryptographically secure OTP
        var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

        try
        {
            await _emailService.SendEmailAsync(normalizedEmail, "Khôi phục mật khẩu Zynk Social",
                $@"<div style='font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                    <h2 style='color: #6366f1;'>Yêu cầu khôi phục mật khẩu</h2>
                    <p>Mã xác thực của bạn là:</p>
                    <div style='font-size: 2rem; font-weight: 800; color: #ef4444; letter-spacing: 5px; margin: 20px 0;'>{otp}</div>
                    <p style='color: #64748b; font-size: 0.85rem;'>Mã có hiệu lực trong 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
                   </div>");

            _cache.Set($"RESET_OTP_{normalizedEmail}", new OtpCacheRecord<string>(otp, normalizedEmail, 0), TimeSpan.FromMinutes(10));
            return Ok(new { message = "Mã xác thực đã được gửi về email của bạn." });
        }
        catch (Exception ex) { return BadRequest(new { message = "Lỗi gửi mail: " + ex.Message }); }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!_cache.TryGetValue($"RESET_OTP_{normalizedEmail}", out OtpCacheRecord<string>? cachedData) || cachedData == null)
            return BadRequest(new { message = "Mã xác thực không chính xác hoặc đã hết hạn." });

        if (cachedData.Otp != request.Otp)
        {
            var attempts = cachedData.FailedAttempts + 1;
            if (attempts >= 5)
            {
                _cache.Remove($"RESET_OTP_{normalizedEmail}");
                return BadRequest(new { message = "Bạn đã nhập sai mã xác thực quá 5 lần. Yêu cầu khôi phục mật khẩu đã bị hủy." });
            }

            _cache.Set($"RESET_OTP_{normalizedEmail}", cachedData with { FailedAttempts = attempts }, TimeSpan.FromMinutes(10));
            return BadRequest(new { message = $"Mã xác thực không chính xác. Bạn còn lại {5 - attempts} lần thử." });
        }

        if (!IsValidPassword(request.NewPassword, out var passwordError))
            return BadRequest(new { message = passwordError });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        if (user == null) return NotFound();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        _cache.Remove($"RESET_OTP_{normalizedEmail}");
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

        if (!IsValidPassword(request.NewPassword, out var passwordError))
            return BadRequest(new { message = passwordError });

        if (request.OldPassword == request.NewPassword)
            return BadRequest(new { message = "Mật khẩu mới không được trùng với mật khẩu cũ." });

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
                    Email = payload.Email.Trim().ToLowerInvariant(),
                    Username = payload.Email.Split('@')[0].Trim(),
                    FullName = payload.Name,
                    AvatarUrl = payload.Picture,
                    Gender = "Other",
                    PasswordHash = string.Empty, 
                    GoogleId = payload.Subject,
                    CreatedAt = DateTime.UtcNow,
                    Role = "User",
                    IsEmailConfirmed = true,
                    IsActive = true
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            if (!user.IsActive)
                return Unauthorized(new { message = "Tài khoản của bạn đã bị khóa hoặc tạm ngưng." });

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
            new Claim("FullName", user.FullName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
