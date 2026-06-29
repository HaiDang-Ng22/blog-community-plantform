using Blog.Application.Dtos;

namespace Blog.Application.Services;

public interface IGroupService
{
    Task<IEnumerable<GroupDto>> GetAllGroupsAsync(Guid currentUserId);
    Task<IEnumerable<GroupDto>> GetMyGroupsAsync(Guid currentUserId);
    Task<GroupDto?> GetGroupByIdAsync(Guid groupId, Guid currentUserId);
    Task<GroupDto> CreateGroupAsync(CreateGroupRequest request, Guid currentUserId);
    Task<bool> JoinGroupAsync(Guid groupId, Guid currentUserId);
    Task<bool> LeaveGroupAsync(Guid groupId, Guid currentUserId);
    Task<IEnumerable<PostDto>?> GetGroupPostsAsync(Guid groupId, Guid currentUserId);
    Task<bool> ReportGroupAsync(Guid groupId, ReportGroupRequest request, Guid currentUserId);
    Task<GroupDto?> UpdateGroupAsync(Guid groupId, UpdateGroupRequest request, Guid currentUserId);
    Task<IEnumerable<GroupPendingMemberDto>?> GetPendingMembersAsync(Guid groupId, Guid currentUserId);
    Task<bool> ApproveMemberAsync(Guid groupId, Guid userIdToApprove, Guid currentUserId);
    Task<bool> RejectMemberAsync(Guid groupId, Guid userIdToReject, Guid currentUserId);
}
