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
public class AuctionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AuctionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("request")]
    [Authorize]
    public async Task<IActionResult> CreateAuctionRequest([FromBody] CreateAuctionRequestDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        if (dto.ImageUrls == null || dto.ImageUrls.Count < 3)
        {
            return BadRequest(new { message = "Vui lòng cung cấp ít nhất 3 hình ảnh cho sản phẩm đấu giá." });
        }

        var auction = new Auction
        {
            Id = Guid.NewGuid(),
            SellerId = Guid.Parse(userIdStr),
            Name = dto.Name,
            Description = dto.Description,
            ImageUrls = dto.ImageUrls,
            StartingPrice = dto.StartingPrice,
            CurrentPrice = dto.StartingPrice,
            RequestedDate = dto.RequestedDate.ToUniversalTime(),
            Status = AuctionStatus.PendingApproval,
            CreatedAt = DateTime.UtcNow
        };

        _context.Auctions.Add(auction);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Gửi yêu cầu đấu giá thành công. Vui lòng chờ Admin duyệt." });
    }

    [HttpGet("upcoming")]
    public async Task<IActionResult> GetUpcomingAuctions()
    {
        // Lấy 3 sản phẩm đấu giá sắp diễn ra (của ngày tiếp theo)
        var upcoming = await _context.Auctions
            .Include(a => a.Seller)
            .Where(a => a.Status == AuctionStatus.Upcoming || a.Status == AuctionStatus.Ongoing)
            .OrderBy(a => a.StartTime)
            .Take(3)
            .Select(a => new AuctionDto
            {
                Id = a.Id,
                SellerId = a.SellerId,
                SellerName = a.Seller.FullName,
                Name = a.Name,
                Description = a.Description.Length > 100 ? a.Description.Substring(0, 100) + "..." : a.Description,
                ImageUrls = a.ImageUrls,
                StartingPrice = a.StartingPrice,
                CurrentPrice = a.CurrentPrice,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                Status = a.Status.ToString()
            })
            .ToListAsync();

        return Ok(upcoming);
    }

    [HttpGet("date/{date}")]
    public async Task<IActionResult> GetAuctionsByDate(DateTime date)
    {
        var startOfDay = date.Date.ToUniversalTime();
        var endOfDay = startOfDay.AddDays(1);

        var auctions = await _context.Auctions
            .Include(a => a.Seller)
            .Where(a => (a.Status == AuctionStatus.Upcoming || a.Status == AuctionStatus.Ongoing || a.Status == AuctionStatus.Ended) 
                        && a.StartTime >= startOfDay && a.StartTime < endOfDay)
            .OrderBy(a => a.StartTime)
            .Select(a => new AuctionDto
            {
                Id = a.Id,
                SellerId = a.SellerId,
                SellerName = a.Seller.FullName,
                Name = a.Name,
                ImageUrls = a.ImageUrls,
                StartingPrice = a.StartingPrice,
                CurrentPrice = a.CurrentPrice,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                Status = a.Status.ToString()
            })
            .ToListAsync();

        return Ok(auctions);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAuctionDetails(Guid id)
    {
        var auction = await _context.Auctions
            .Include(a => a.Seller)
            .Include(a => a.HighestBidder)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (auction == null) return NotFound();

        var dto = new AuctionDto
        {
            Id = auction.Id,
            SellerId = auction.SellerId,
            SellerName = auction.Seller.FullName,
            SellerAvatar = auction.Seller.AvatarUrl ?? "",
            Name = auction.Name,
            Description = auction.Description,
            ImageUrls = auction.ImageUrls,
            StartingPrice = auction.StartingPrice,
            CurrentPrice = auction.CurrentPrice,
            HighestBidderId = auction.HighestBidderId,
            HighestBidderName = auction.HighestBidder?.FullName,
            StartTime = auction.StartTime,
            EndTime = auction.EndTime,
            Status = auction.Status.ToString()
        };

        return Ok(dto);
    }
}
