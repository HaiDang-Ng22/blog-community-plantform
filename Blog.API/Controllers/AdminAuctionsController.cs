using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/admin/auctions")]
[Authorize(Roles = "Admin")]
public class AdminAuctionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminAuctionsController(AppDbContext context)
    {
        _context = context;
    }

    // ══════════════════════════════════════
    // ADMIN TẠO PHIÊN ĐẤU GIÁ
    // ══════════════════════════════════════

    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions()
    {
        var sessions = await _context.Auctions
            .Include(a => a.Seller)
            .Where(a => a.Status != AuctionStatus.PendingApproval && a.Status != AuctionStatus.Rejected)
            .OrderByDescending(a => a.StartTime)
            .Select(a => new AuctionDto
            {
                Id = a.Id,
                SellerId = a.SellerId,
                SellerName = a.Seller.FullName,
                Name = a.Name,
                Description = a.Description,
                ImageUrls = a.ImageUrls,
                StartingPrice = a.StartingPrice,
                CurrentPrice = a.CurrentPrice,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                Status = a.Status.ToString(),
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        return Ok(sessions);
    }

    [HttpPost("create-session")]
    public async Task<IActionResult> CreateSession([FromBody] CreateAuctionSessionByAdminDto dto)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminId)) return Unauthorized();

        var auction = new Auction
        {
            Id = Guid.NewGuid(),
            SellerId = Guid.Parse(adminId), // Admin là người tạo
            Name = dto.Name,
            Description = dto.Description,
            ImageUrls = dto.ImageUrls ?? new List<string>(),
            StartingPrice = dto.StartingPrice,
            CurrentPrice = dto.StartingPrice,
            RequestedDate = dto.StartTime.Date,
            StartTime = dto.StartTime.ToUniversalTime(),
            EndTime = dto.EndTime.ToUniversalTime(),
            Status = AuctionStatus.Upcoming,
            CreatedAt = DateTime.UtcNow
        };

        _context.Auctions.Add(auction);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Tạo phiên đấu giá thành công!", id = auction.Id });
    }

    [HttpDelete("sessions/{id}")]
    public async Task<IActionResult> DeleteSession(Guid id)
    {
        var auction = await _context.Auctions.FindAsync(id);
        if (auction == null) return NotFound();
        if (auction.Status == AuctionStatus.Ongoing)
            return BadRequest(new { message = "Không thể xóa phiên đang diễn ra." });

        _context.Auctions.Remove(auction);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa phiên đấu giá." });
    }

    // ══════════════════════════════════════
    // DUYỆT YÊU CẦU TỪ NGƯỜI DÙNG
    // ══════════════════════════════════════

    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingRequests()
    {
        var pending = await _context.Auctions
            .Include(a => a.Seller)
            .Where(a => a.Status == AuctionStatus.PendingApproval)
            .OrderBy(a => a.CreatedAt)
            .Select(a => new AuctionDto
            {
                Id = a.Id,
                SellerId = a.SellerId,
                SellerName = a.Seller.FullName,
                Name = a.Name,
                Description = a.Description,
                ImageUrls = a.ImageUrls,
                StartingPrice = a.StartingPrice,
                RequestedDate = a.RequestedDate,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        return Ok(pending);
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveAuction(Guid id, [FromBody] ApproveAuctionRequestDto dto)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminId)) return Unauthorized();

        var auction = await _context.Auctions.FindAsync(id);
        if (auction == null) return NotFound(new { message = "Không tìm thấy yêu cầu." });

        if (auction.Status != AuctionStatus.PendingApproval)
            return BadRequest(new { message = "Yêu cầu này đã được xử lý." });

        auction.Status = AuctionStatus.Upcoming;
        auction.StartTime = dto.StartTime.ToUniversalTime();
        auction.EndTime = dto.EndTime.ToUniversalTime();

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = auction.SellerId,
            ActorId = Guid.Parse(adminId),
            Type = "System",
            Message = $"Sản phẩm đấu giá '{auction.Name}' đã được duyệt. Phiên bắt đầu vào {auction.StartTime?.ToLocalTime().ToString("dd/MM/yyyy HH:mm")}.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã duyệt yêu cầu đấu giá thành công." });
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectAuction(Guid id)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminId)) return Unauthorized();

        var auction = await _context.Auctions.FindAsync(id);
        if (auction == null) return NotFound(new { message = "Không tìm thấy yêu cầu." });

        if (auction.Status != AuctionStatus.PendingApproval)
            return BadRequest(new { message = "Yêu cầu này đã được xử lý." });

        auction.Status = AuctionStatus.Rejected;

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = auction.SellerId,
            ActorId = Guid.Parse(adminId),
            Type = "System",
            Message = $"Yêu cầu đấu giá sản phẩm '{auction.Name}' của bạn đã bị từ chối vì không đáp ứng đủ điều kiện.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã từ chối yêu cầu đấu giá." });
    }
}
