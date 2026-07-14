using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Blog.Application.Dtos.AiChat;
using Blog.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/ai-chat")]
public class AiChatController : ControllerBase
{
    private readonly IAiShoppingAssistantService _aiShoppingAssistantService;

    public AiChatController(IAiShoppingAssistantService aiShoppingAssistantService)
    {
        _aiShoppingAssistantService = aiShoppingAssistantService;
    }

    [HttpPost("sessions")]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        try
        {
            var session = await _aiShoppingAssistantService.CreateSessionAsync(userId, request.AnonymousSessionId, cancellationToken);
            return Ok(session);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpGet("sessions")]
    [Authorize]
    public async Task<IActionResult> GetUserSessions([FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        try
        {
            var sessions = await _aiShoppingAssistantService.GetUserSessionsAsync(userId.Value, page, pageSize, cancellationToken);
            return Ok(sessions);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpGet("sessions/{sessionId}/messages")]
    public async Task<IActionResult> GetSessionMessages(Guid sessionId, [FromQuery] string? anonymousSessionId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        try
        {
            var messages = await _aiShoppingAssistantService.GetSessionMessagesAsync(sessionId, userId, anonymousSessionId, cancellationToken);
            return Ok(messages);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("sessions/{sessionId}")]
    public async Task<IActionResult> DeleteSession(Guid sessionId, [FromQuery] string? anonymousSessionId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        try
        {
            var success = await _aiShoppingAssistantService.DeleteSessionAsync(sessionId, userId, anonymousSessionId, cancellationToken);
            if (!success) return NotFound(new { message = "Session không tồn tại hoặc đã bị xóa." });
            return Ok(new { message = "Xóa session thành công." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("messages")]
    [EnableRateLimiting("AiChatPolicy")]
    public async Task<IActionResult> SendMessage([FromBody] AiChatRequestDto request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        try
        {
            var response = await _aiShoppingAssistantService.SendMessageAsync(userId, request, cancellationToken);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception)
        {
            // Internal safety fallback response
            return StatusCode(500, new
            {
                code = "AI_SERVICE_TEMPORARILY_UNAVAILABLE",
                message = "Zynk AI đang bận. Vui lòng thử lại sau.",
                traceId = HttpContext.TraceIdentifier
            });
        }
    }

    [HttpPost("recommendations/{recommendationLogId}/click")]
    public async Task<IActionResult> TrackClick(Guid recommendationLogId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var success = await _aiShoppingAssistantService.TrackClickAsync(recommendationLogId, userId, cancellationToken);
        if (!success) return NotFound(new { message = "Log không tồn tại." });
        return Ok(new { message = "Ghi nhận click thành công." });
    }

    [HttpPost("recommendations/{recommendationLogId}/add-to-cart")]
    public async Task<IActionResult> TrackAddToCart(Guid recommendationLogId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var success = await _aiShoppingAssistantService.TrackAddToCartAsync(recommendationLogId, userId, cancellationToken);
        if (!success) return NotFound(new { message = "Log không tồn tại." });
        return Ok(new { message = "Ghi nhận add-to-cart thành công." });
    }

    // --- Private Helpers ---
    private Guid? GetUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return null;
        return Guid.TryParse(userIdStr, out var userId) ? userId : null;
    }
}

public class CreateSessionRequest
{
    public string? AnonymousSessionId { get; set; }
}
