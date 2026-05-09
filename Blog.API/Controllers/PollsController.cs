using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Blog.API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Blog.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PollsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PollsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("{pollId}/vote/{optionId}")]
        public async Task<IActionResult> Vote(Guid pollId, Guid optionId)
        {
            var userId = User.GetUserId() ?? Guid.Empty;
            
            var poll = await _context.Polls
                .Include(p => p.Options)
                .FirstOrDefaultAsync(p => p.Id == pollId);

            if (poll == null) return NotFound("Poll not found");
            if (poll.EndsAt.HasValue && poll.EndsAt.Value < DateTime.UtcNow)
                return BadRequest("Poll has expired");

            var option = poll.Options.FirstOrDefault(o => o.Id == optionId);
            if (option == null) return BadRequest("Invalid option");

            var existingVote = await _context.PollVotes
                .FirstOrDefaultAsync(pv => pv.PollId == pollId && pv.UserId == userId);

            if (existingVote != null)
            {
                if (existingVote.OptionId == optionId)
                {
                    // Unvote
                    _context.PollVotes.Remove(existingVote);
                    option.VoteCount = Math.Max(0, option.VoteCount - 1);
                }
                else
                {
                    // Change vote
                    var oldOption = poll.Options.FirstOrDefault(o => o.Id == existingVote.OptionId);
                    if (oldOption != null) oldOption.VoteCount = Math.Max(0, oldOption.VoteCount - 1);
                    
                    existingVote.OptionId = optionId;
                    option.VoteCount++;
                }
            }
            else
            {
                // New vote
                var vote = new PollVote
                {
                    PollId = pollId,
                    OptionId = optionId,
                    UserId = userId
                };
                _context.PollVotes.Add(vote);
                option.VoteCount++;
            }

            await _context.SaveChangesAsync();

            // Return updated poll info
            var totalVotes = poll.Options.Sum(o => o.VoteCount);
            var updatedOptions = poll.Options.Select(o => new {
                o.Id,
                o.Text,
                o.VoteCount,
                Percentage = totalVotes == 0 ? 0 : (double)o.VoteCount / totalVotes * 100
            });

            return Ok(new { 
                totalVotes, 
                options = updatedOptions,
                selectedOptionId = (await _context.PollVotes.FirstOrDefaultAsync(pv => pv.PollId == pollId && pv.UserId == userId))?.OptionId
            });
        }
    }
}
