using System.ComponentModel.DataAnnotations;

namespace Blog.Domain.Entities;

public class UserVoucher
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VoucherId { get; set; }
    
    public bool IsUsed { get; set; } = false;
    public DateTime? UsedAt { get; set; }
    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;

    public virtual User User { get; set; } = null!;
    public virtual Voucher Voucher { get; set; } = null!;
}
