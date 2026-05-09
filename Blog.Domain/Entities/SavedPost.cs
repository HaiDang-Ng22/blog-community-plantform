using System;

namespace Blog.Domain.Entities
{
    public class SavedPost
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
        public Guid PostId { get; set; }
        public Post Post { get; set; } = null!;
        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
        
        // Optional: Collection name for categorization
        public string CollectionName { get; set; } = "Mặc định";
    }
}
