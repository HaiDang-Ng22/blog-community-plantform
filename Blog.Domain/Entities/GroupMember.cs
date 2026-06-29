namespace Blog.Domain.Entities;

public enum GroupRole
{
    Member,
    Admin
}

public enum GroupMemberStatus
{
    Pending,
    Approved
}

public class GroupMember
{
    public Guid GroupId { get; set; }
    public virtual Group Group { get; set; } = null!;

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    public GroupRole Role { get; set; } = GroupRole.Member;
    public GroupMemberStatus Status { get; set; } = GroupMemberStatus.Approved;
    public DateTime JoinedAt { get; set; }
}
