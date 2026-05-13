using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Blog.API.Extensions;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/verifications")]
[Authorize]
public class VerificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public VerificationsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// User gửi yêu cầu xác minh danh tính (tích xanh)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SubmitVerification([FromBody] SubmitVerificationDto dto)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        // Kiểm tra đã có yêu cầu Pending chưa
        var existing = await _context.VerificationRequests
            .FirstOrDefaultAsync(v => v.UserId == userId.Value && v.Status == "Pending");
        if (existing != null)
            return BadRequest(new { message = "Bạn đã có một yêu cầu đang chờ xét duyệt." });

        var request = new VerificationRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            FullName = dto.FullName,
            DocumentType = dto.DocumentType,
            DocumentUrl = dto.DocumentUrl,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.VerificationRequests.Add(request);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Yêu cầu đã được gửi thành công! Admin sẽ xem xét sớm nhất.", id = request.Id });
    }

    /// <summary>
    /// Lấy trạng thái xác minh hiện tại của user đang đăng nhập
    /// </summary>
    [HttpGet("my-status")]
    public async Task<IActionResult> GetMyStatus()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var req = await _context.VerificationRequests
            .Where(v => v.UserId == userId.Value)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();

        var user = await _context.Users.FindAsync(userId.Value);

        return Ok(new
        {
            isVerified = user?.IsVerified ?? false,
            status = req?.Status ?? "None",
            submittedAt = req?.CreatedAt
        });
    }
}

public class SubmitVerificationDto
{
    public string FullName { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string DocumentUrl { get; set; } = string.Empty;
}
