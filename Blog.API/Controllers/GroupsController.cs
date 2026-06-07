using Blog.Application.Dtos;
using Blog.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GroupsController : ControllerBase
{
    private readonly IGroupService _groupService;

    public GroupsController(IGroupService groupService)
    {
        _groupService = groupService;
    }

    private Guid GetCurrentUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAllGroups()
    {
        var userId = GetCurrentUserId(); // Will be empty if not logged in
        var groups = await _groupService.GetAllGroupsAsync(userId);
        return Ok(groups);
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyGroups()
    {
        var groups = await _groupService.GetMyGroupsAsync(GetCurrentUserId());
        return Ok(groups);
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetGroupById(Guid id)
    {
        var userId = GetCurrentUserId();
        var group = await _groupService.GetGroupByIdAsync(id, userId);
        if (group == null) return NotFound("Group not found");
        return Ok(group);
    }

    [HttpPost]
    public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required");

        var group = await _groupService.CreateGroupAsync(request, GetCurrentUserId());
        return CreatedAtAction(nameof(GetGroupById), new { id = group.Id }, group);
    }

    [HttpPost("{id}/join")]
    public async Task<IActionResult> JoinGroup(Guid id)
    {
        var success = await _groupService.JoinGroupAsync(id, GetCurrentUserId());
        if (!success) return BadRequest("Unable to join group or already joined.");
        return Ok(new { message = "Joined successfully" });
    }

    [HttpPost("{id}/leave")]
    public async Task<IActionResult> LeaveGroup(Guid id)
    {
        var success = await _groupService.LeaveGroupAsync(id, GetCurrentUserId());
        if (!success) return BadRequest("Unable to leave group. Either you are the owner or not a member.");
        return Ok(new { message = "Left successfully" });
    }

    [HttpPost("{id}/report")]
    public async Task<IActionResult> ReportGroup(Guid id, [FromBody] ReportGroupRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest("Reason is required");

        var success = await _groupService.ReportGroupAsync(id, request, GetCurrentUserId());
        if (!success) return NotFound("Group not found");
        return Ok(new { message = "Report submitted successfully" });
    }

    [HttpGet("{id}/posts")]
    [AllowAnonymous]
    public async Task<IActionResult> GetGroupPosts(Guid id)
    {
        var userId = GetCurrentUserId();
        var posts = await _groupService.GetGroupPostsAsync(id, userId);
        if (posts == null) return NotFound("Group not found");
        return Ok(posts);
    }
}
