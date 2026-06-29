using Blog.Application.Dtos;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Blog.Application.Services;

namespace Blog.Infrastructure.Services;

public class GroupService : IGroupService
{
    private readonly AppDbContext _context;
    
    // Tùy theo cách dự án implement AI, có thể inject IAIService 
    // private readonly IAIService _aiService;

    public GroupService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<GroupDto>> GetAllGroupsAsync(Guid currentUserId)
    {
        var groups = await _context.Groups
            .Include(g => g.Members)
            .ToListAsync();

        return groups.Select(g => MapToDto(g, currentUserId));
    }

    public async Task<IEnumerable<GroupDto>> GetMyGroupsAsync(Guid currentUserId)
    {
        var groups = await _context.Groups
            .Include(g => g.Members)
            .Where(g => g.Members.Any(m => m.UserId == currentUserId))
            .ToListAsync();

        return groups.Select(g => MapToDto(g, currentUserId));
    }

    public async Task<GroupDto?> GetGroupByIdAsync(Guid groupId, Guid currentUserId)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return null;

        return MapToDto(group, currentUserId);
    }

    public async Task<GroupDto> CreateGroupAsync(CreateGroupRequest request, Guid currentUserId)
    {
        var group = new Group
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            CoverImageUrl = request.CoverImageUrl,
            AvatarImageUrl = request.AvatarImageUrl,
            IsPrivate = request.IsPrivate,
            CreatedAt = DateTime.UtcNow,
            OwnerId = currentUserId
        };

        _context.Groups.Add(group);

        var member = new GroupMember
        {
            GroupId = group.Id,
            UserId = currentUserId,
            Role = GroupRole.Admin,
            Status = GroupMemberStatus.Approved,
            JoinedAt = DateTime.UtcNow
        };

        _context.GroupMembers.Add(member);
        await _context.SaveChangesAsync();

        group.Members.Add(member);
        return MapToDto(group, currentUserId);
    }

    public async Task<bool> JoinGroupAsync(Guid groupId, Guid currentUserId)
    {
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null) return false;

        var existingMember = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == currentUserId);

        if (existingMember != null) return true; // Already member

        var member = new GroupMember
        {
            GroupId = groupId,
            UserId = currentUserId,
            Role = GroupRole.Member,
            JoinedAt = DateTime.UtcNow,
            Status = group.IsPrivate ? GroupMemberStatus.Pending : GroupMemberStatus.Approved
        };

        _context.GroupMembers.Add(member);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> LeaveGroupAsync(Guid groupId, Guid currentUserId)
    {
        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == currentUserId);

        if (member == null) return false;
        
        // Cannot leave if you are the owner (maybe need transfer ownership later, for now block it)
        var group = await _context.Groups.FindAsync(groupId);
        if (group?.OwnerId == currentUserId) return false;

        _context.GroupMembers.Remove(member);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ReportGroupAsync(Guid groupId, ReportGroupRequest request, Guid currentUserId)
    {
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null) return false;

        var report = new Report
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TargetType = ReportTargetType.Group,
            ReporterId = currentUserId,
            Reason = request.Reason,
            CreatedAt = DateTime.UtcNow,
            IsResolved = false
        };

        _context.Reports.Add(report);

        // Notify Admins
        var adminRoleUsers = await _context.Users.Where(u => u.Role == "Admin").ToListAsync();
        foreach (var admin in adminRoleUsers)
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                ReceiverId = admin.Id,
                ActorId = currentUserId,
                Type = "SystemAlert",
                Message = $"Group '{group.Name}' has been reported for: {request.Reason}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                TargetId = groupId
            };
            _context.Notifications.Add(notification);
        }

        await _context.SaveChangesAsync();

        // ----------------------------------------------------
        // TODO: Gọi AI Service để review Group ở background task
        // _aiService.ReviewGroupContentAsync(groupId);
        // ----------------------------------------------------

        return true;
    }

    public async Task<IEnumerable<PostDto>?> GetGroupPostsAsync(Guid groupId, Guid currentUserId)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return null;

        // If group is private, only approved members can see posts. Owner is always approved.
        bool isApprovedMember = group.OwnerId == currentUserId || group.Members.Any(m => m.UserId == currentUserId && m.Status == GroupMemberStatus.Approved);
        if (group.IsPrivate && !isApprovedMember)
            return new List<PostDto>();

        var posts = await _context.Posts
            .Include(p => p.Author)
            .Include(p => p.Images)
            .Include(p => p.PostLikes)
            .Include(p => p.Comments)
            .Include(p => p.Poll).ThenInclude(poll => poll.Options)
            .Where(p => p.GroupId == groupId && p.Status == PostStatus.Published)
            .OrderByDescending(p => p.CreatedAt)
            .Take(50)
            .ToListAsync();

        var likedPostIds = currentUserId != Guid.Empty
            ? await _context.PostLikes.Where(l => l.UserId == currentUserId).Select(l => l.PostId).ToListAsync()
            : new List<Guid>();

        return posts.Select(p => new PostDto
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            FeaturedImageUrl = p.FeaturedImageUrl,
            ViewCount = p.ViewCount,
            LikeCount = p.LikeCount,
            Status = p.Status.ToString(),
            AuthorName = p.IsAnonymous ? "Người dùng Ẩn danh" : (p.Author?.FullName ?? "Người dùng"),
            AuthorIsPremium = !p.IsAnonymous && (p.Author?.IsPremium ?? false),
            AuthorAvatarUrl = p.IsAnonymous ? null : p.Author?.AvatarUrl,
            AuthorId = p.IsAnonymous ? Guid.Empty : p.AuthorId,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
            CommentCount = p.Comments.Count,
            IsLikedByMe = likedPostIds.Contains(p.Id),
            ImageUrls = p.Images.OrderBy(i => i.OrderIndex).Select(i => i.Url).ToList(),
            Type = p.Type.ToString(),
            VideoUrl = p.VideoUrl,
            IsAnonymous = p.IsAnonymous,
            Poll = p.Poll == null ? null : new PollDto
            {
                Id = p.Poll.Id,
                Question = p.Poll.Question,
                IsExpired = p.Poll.EndsAt.HasValue && p.Poll.EndsAt.Value < DateTime.UtcNow,
                TotalVotes = p.Poll.Options.Sum(o => o.VoteCount),
                Options = p.Poll.Options.Select(o => new PollOptionDto
                {
                    Id = o.Id,
                    Text = o.Text,
                    VoteCount = o.VoteCount,
                    Percentage = p.Poll.Options.Sum(x => x.VoteCount) == 0 ? 0
                        : (double)o.VoteCount / p.Poll.Options.Sum(x => x.VoteCount) * 100
                }).ToList()
            }
        }).ToList();
    }

    public async Task<GroupDto?> UpdateGroupAsync(Guid groupId, UpdateGroupRequest request, Guid currentUserId)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return null;

        // Check if user is the owner or an admin
        var isAuthorized = group.OwnerId == currentUserId || 
                           group.Members.Any(m => m.UserId == currentUserId && m.Role == GroupRole.Admin && m.Status == GroupMemberStatus.Approved);
        
        if (!isAuthorized) return null;

        group.Name = request.Name;
        group.Description = request.Description;
        group.CoverImageUrl = request.CoverImageUrl;
        group.AvatarImageUrl = request.AvatarImageUrl;
        group.IsPrivate = request.IsPrivate;

        _context.Groups.Update(group);
        await _context.SaveChangesAsync();

        return MapToDto(group, currentUserId);
    }

    public async Task<IEnumerable<GroupPendingMemberDto>?> GetPendingMembersAsync(Guid groupId, Guid currentUserId)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return null;

        var isAuthorized = group.OwnerId == currentUserId || 
                           group.Members.Any(m => m.UserId == currentUserId && m.Role == GroupRole.Admin && m.Status == GroupMemberStatus.Approved);

        if (!isAuthorized) return null;

        var pendingMembers = await _context.GroupMembers
            .Include(gm => gm.User)
            .Where(gm => gm.GroupId == groupId && gm.Status == GroupMemberStatus.Pending)
            .OrderBy(gm => gm.JoinedAt)
            .Select(gm => new GroupPendingMemberDto
            {
                UserId = gm.UserId,
                FullName = gm.User.FullName,
                Username = gm.User.Username,
                AvatarUrl = gm.User.AvatarUrl,
                RequestedAt = gm.JoinedAt
            })
            .ToListAsync();

        return pendingMembers;
    }

    public async Task<bool> ApproveMemberAsync(Guid groupId, Guid userIdToApprove, Guid currentUserId)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return false;

        var isAuthorized = group.OwnerId == currentUserId || 
                           group.Members.Any(m => m.UserId == currentUserId && m.Role == GroupRole.Admin && m.Status == GroupMemberStatus.Approved);

        if (!isAuthorized) return false;

        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userIdToApprove && gm.Status == GroupMemberStatus.Pending);

        if (member == null) return false;

        member.Status = GroupMemberStatus.Approved;
        member.JoinedAt = DateTime.UtcNow;

        _context.GroupMembers.Update(member);

        // Send a notification to the approved user
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            ReceiverId = userIdToApprove,
            ActorId = currentUserId,
            Type = "SystemAlert",
            Message = $"Yêu cầu tham gia nhóm '{group.Name}' của bạn đã được phê duyệt.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            TargetId = groupId
        };
        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RejectMemberAsync(Guid groupId, Guid userIdToReject, Guid currentUserId)
    {
        var group = await _context.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return false;

        var isAuthorized = group.OwnerId == currentUserId || 
                           group.Members.Any(m => m.UserId == currentUserId && m.Role == GroupRole.Admin && m.Status == GroupMemberStatus.Approved);

        if (!isAuthorized) return false;

        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userIdToReject && gm.Status == GroupMemberStatus.Pending);

        if (member == null) return false;

        _context.GroupMembers.Remove(member);
        await _context.SaveChangesAsync();
        return true;
    }

    private GroupDto MapToDto(Group group, Guid currentUserId)
    {
        var memberInfo = group.Members?.FirstOrDefault(m => m.UserId == currentUserId);
        bool isOwner = group.OwnerId == currentUserId;
        
        return new GroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            CoverImageUrl = group.CoverImageUrl,
            AvatarImageUrl = group.AvatarImageUrl,
            IsPrivate = group.IsPrivate,
            CreatedAt = group.CreatedAt,
            OwnerId = group.OwnerId,
            MemberCount = group.Members?.Count(m => m.Status == GroupMemberStatus.Approved) ?? 0,
            IsMember = isOwner || memberInfo != null,
            Role = isOwner ? "Admin" : memberInfo?.Role.ToString(),
            MemberStatus = isOwner ? "Approved" : memberInfo?.Status.ToString()
        };
    }
}
