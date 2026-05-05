using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Blog.Application.DTOs;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PushController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PushController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("subscribe")]
        public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionDto dto)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
                return Unauthorized();

            var existing = await _context.PushSubscriptions
                .FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint && s.UserId == userId);

            if (existing == null)
            {
                var sub = new PushSubscription
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Endpoint = dto.Endpoint,
                    P256dh = dto.P256dh,
                    Auth = dto.Auth,
                    CreatedAt = DateTime.UtcNow
                };
                _context.PushSubscriptions.Add(sub);
            }
            else
            {
                existing.P256dh = dto.P256dh;
                existing.Auth = dto.Auth;
                _context.PushSubscriptions.Update(existing);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Subscribed successfully" });
        }

        [HttpPost("unsubscribe")]
        public async Task<IActionResult> Unsubscribe([FromBody] PushSubscriptionDto dto)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
                return Unauthorized();

            var existing = await _context.PushSubscriptions
                .FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint && s.UserId == userId);

            if (existing != null)
            {
                _context.PushSubscriptions.Remove(existing);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Unsubscribed successfully" });
        }
    }
}
