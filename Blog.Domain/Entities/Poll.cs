using System;
using System.Collections.Generic;

namespace Blog.Domain.Entities
{
    public class Poll
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PostId { get; set; }
        public Post Post { get; set; } = null!;
        public string Question { get; set; } = string.Empty;
        public DateTime? EndsAt { get; set; }
        public List<PollOption> Options { get; set; } = new();
    }

    public class PollOption
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PollId { get; set; }
        public Poll Poll { get; set; } = null!;
        public string Text { get; set; } = string.Empty;
        public int VoteCount { get; set; }
    }

    public class PollVote
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PollId { get; set; }
        public Poll Poll { get; set; } = null!;
        public Guid OptionId { get; set; }
        public PollOption Option { get; set; } = null!;
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
        public DateTime VotedAt { get; set; } = DateTime.UtcNow;
    }
}
