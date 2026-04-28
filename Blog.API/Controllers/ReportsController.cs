using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReportsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateReport([FromBody] ReportRequest request)
    {
        var reporterId = Guid.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        
        var post = await _context.Posts.FindAsync(request.PostId);
        if (post == null) return NotFound(new { message = "Không tìm thấy bài viết" });

        var report = new Report
        {
            Id = Guid.NewGuid(),
            PostId = request.PostId,
            ReporterId = reporterId,
            Reason = request.Reason,
            CreatedAt = DateTime.UtcNow
        };

        _context.Reports.Add(report);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Cám ơn bạn đã báo cáo. Chúng tôi sẽ xem xét nội dung này sớm nhất." });
    }
}

public class ReportRequest
{
    public Guid PostId { get; set; }
    public string Reason { get; set; } = string.Empty;
}
