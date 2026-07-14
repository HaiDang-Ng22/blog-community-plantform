using Blog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Blog.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<UserAddress> UserAddresses { get; set; }
    public DbSet<Post> Posts { get; set; }
    public DbSet<Comment> Comments { get; set; }
    public DbSet<Tag> Tags { get; set; }
    public DbSet<PostTag> PostTags { get; set; }
    public DbSet<PostLike> PostLikes { get; set; }
    public DbSet<Follow> Follows { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<PostImage> PostImages { get; set; }
    public DbSet<Report> Reports { get; set; }
    public DbSet<Block> Blocks { get; set; }

    // Chat Entities
    public DbSet<Conversation> Conversations { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<StoryLike> StoryLikes { get; set; }
    public DbSet<StoryView> StoryViews { get; set; }

    // Shopping Entities
    public DbSet<Category> Categories { get; set; }
    public DbSet<ShopApplication> ShopApplications { get; set; }
    public DbSet<Shop> Shops { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<ProductImage> ProductImages { get; set; }
    public DbSet<ProductVariant> ProductVariants { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<OrderStatusHistory> OrderStatusHistories { get; set; }
    public DbSet<ProductReview> ProductReviews { get; set; }
    public DbSet<ProductReviewImage> ProductReviewImages { get; set; }
    public DbSet<Story> Stories { get; set; }
    public DbSet<PushSubscription> PushSubscriptions { get; set; }
    public DbSet<SavedPost> SavedPosts { get; set; }
    public DbSet<Poll> Polls { get; set; }
    public DbSet<PollOption> PollOptions { get; set; }
    public DbSet<PollVote> PollVotes { get; set; }
    public DbSet<VerificationRequest> VerificationRequests { get; set; }
    public DbSet<Voucher> Vouchers { get; set; }
    public DbSet<ShopConversation> ShopConversations { get; set; }
    public DbSet<ShopMessage> ShopMessages { get; set; }
    public DbSet<BannedWord> BannedWords { get; set; }
    public DbSet<Banner> Banners { get; set; }
    public DbSet<UserVoucher> UserVouchers { get; set; }
    public DbSet<Auction> Auctions { get; set; }
    public DbSet<AuctionBid> AuctionBids { get; set; }
    public DbSet<PostProductTag> PostProductTags { get; set; }
    public DbSet<Group> Groups { get; set; }
    public DbSet<GroupMember> GroupMembers { get; set; }

    // AI Chat Shopping Assistant
    public DbSet<AiChatSession> AiChatSessions { get; set; }
    public DbSet<AiChatMessage> AiChatMessages { get; set; }
    public DbSet<AiRecommendationLog> AiRecommendationLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Cấu hình Poll
        modelBuilder.Entity<Poll>()
            .HasOne(p => p.Post)
            .WithOne(post => post.Poll)
            .HasForeignKey<Poll>(p => p.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PollOption>()
            .HasOne(po => po.Poll)
            .WithMany(p => p.Options)
            .HasForeignKey(po => po.PollId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PollVote>()
            .HasKey(pv => new { pv.PollId, pv.UserId });

        modelBuilder.Entity<PollVote>()
            .HasOne(pv => pv.Poll)
            .WithMany()
            .HasForeignKey(pv => pv.PollId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PollVote>()
            .HasOne(pv => pv.Option)
            .WithMany()
            .HasForeignKey(pv => pv.OptionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cấu hình SavedPost
        modelBuilder.Entity<SavedPost>()
            .HasKey(sp => sp.Id);

        modelBuilder.Entity<SavedPost>()
            .HasOne(sp => sp.User)
            .WithMany()
            .HasForeignKey(sp => sp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SavedPost>()
            .HasOne(sp => sp.Post)
            .WithMany()
            .HasForeignKey(sp => sp.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SavedPost>()
            .HasIndex(sp => new { sp.UserId, sp.PostId })
            .IsUnique();

        // Cấu hình Block
        modelBuilder.Entity<Block>()
            .HasKey(b => new { b.BlockerId, b.BlockedId });

        modelBuilder.Entity<Block>()
            .HasOne(b => b.Blocker)
            .WithMany()
            .HasForeignKey(b => b.BlockerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Block>()
            .HasOne(b => b.Blocked)
            .WithMany()
            .HasForeignKey(b => b.BlockedId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình Report
        modelBuilder.Entity<Report>()
            .HasOne(r => r.Post)
            .WithMany()
            .HasForeignKey(r => r.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.Reporter)
            .WithMany()
            .HasForeignKey(r => r.ReporterId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình PostImage
        modelBuilder.Entity<PostImage>()
            .HasOne(pi => pi.Post)
            .WithMany(p => p.Images)
            .HasForeignKey(pi => pi.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cấu hình PostTag (khóa chính composite)
        modelBuilder.Entity<PostTag>()
            .HasKey(pt => new { pt.PostId, pt.TagId });

        // Cấu hình Slug là unique
        modelBuilder.Entity<Post>()
            .HasIndex(p => p.Slug)
            .IsUnique();

        modelBuilder.Entity<Tag>()
            .HasIndex(t => t.Slug)
            .IsUnique();

        // Cấu hình quan hệ Comment tự tham chiếu
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.ParentComment)
            .WithMany(c => c.Replies)
            .HasForeignKey(c => c.ParentCommentId)
            .OnDelete(DeleteBehavior.Restrict);

        // ⭐ THÊM CẤU HÌNH NÀY - SỬA LỖI
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Author)
            .WithMany(u => u.Comments)
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);  // Không cascade, thay vào đó set null hoặc restrict

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Post)
            .WithMany(p => p.Comments)
            .HasForeignKey(c => c.PostId)
            .OnDelete(DeleteBehavior.Cascade);   // Giữ cascade cho Post

        // Cấu hình PostLike (Composite Key)
        modelBuilder.Entity<PostLike>()
            .HasKey(pl => new { pl.PostId, pl.UserId });

        modelBuilder.Entity<PostLike>()
            .HasOne(pl => pl.Post)
            .WithMany(p => p.PostLikes)
            .HasForeignKey(pl => pl.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PostLike>()
            .HasOne(pl => pl.User)
            .WithMany(u => u.PostLikes)
            .HasForeignKey(pl => pl.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình Follow (Composite Key)
        modelBuilder.Entity<Follow>()
            .HasKey(f => new { f.FollowerId, f.FollowingId });

        modelBuilder.Entity<Follow>()
            .HasOne(f => f.Follower)
            .WithMany(u => u.Following)
            .HasForeignKey(f => f.FollowerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Follow>()
            .HasOne(f => f.Following)
            .WithMany(u => u.Followers)
            .HasForeignKey(f => f.FollowingId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình Notification
        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Receiver)
            .WithMany(u => u.ReceivedNotifications)
            .HasForeignKey(n => n.ReceiverId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Actor)
            .WithMany()
            .HasForeignKey(n => n.ActorId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình UserAddress
        modelBuilder.Entity<UserAddress>()
            .HasOne(ua => ua.User)
            .WithMany(u => u.Addresses)
            .HasForeignKey(ua => ua.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- Shopping Configurations ---
        
        // Product
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Slug)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Shop)
            .WithMany(s => s.Products)
            .HasForeignKey(p => p.ShopId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Shop
        modelBuilder.Entity<Shop>()
            .HasIndex(s => s.Slug)
            .IsUnique();

        modelBuilder.Entity<Shop>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // ShopApplication
        modelBuilder.Entity<ShopApplication>()
            .HasOne(sa => sa.User)
            .WithMany()
            .HasForeignKey(sa => sa.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Order
        modelBuilder.Entity<Order>()
            .HasOne(o => o.Buyer)
            .WithMany()
            .HasForeignKey(o => o.BuyerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Category self-referencing relationship
        modelBuilder.Entity<Category>()
            .HasOne(c => c.ParentCategory)
            .WithMany(c => c.SubCategories)
            .HasForeignKey(c => c.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // OrderItem
        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Voucher
        modelBuilder.Entity<Voucher>()
            .HasOne(v => v.Shop)
            .WithMany()
            .HasForeignKey(v => v.ShopId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.Voucher)
            .WithMany()
            .HasForeignKey(o => o.VoucherId)
            .OnDelete(DeleteBehavior.SetNull);

        // ProductReview
        modelBuilder.Entity<ProductReview>()
            .HasOne(r => r.Product)
            .WithMany()
            .HasForeignKey(r => r.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductReview>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // ProductReviewImage
        modelBuilder.Entity<ProductReviewImage>()
            .HasOne(i => i.Review)
            .WithMany(r => r.Images)
            .HasForeignKey(i => i.ProductReviewId)
            .OnDelete(DeleteBehavior.Cascade);

        // UserVoucher
        modelBuilder.Entity<UserVoucher>()
            .HasOne(uv => uv.User)
            .WithMany()
            .HasForeignKey(uv => uv.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserVoucher>()
            .HasOne(uv => uv.Voucher)
            .WithMany()
            .HasForeignKey(uv => uv.VoucherId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserVoucher>()
            .HasIndex(uv => new { uv.UserId, uv.VoucherId })
            .IsUnique();

        // Conversation
        modelBuilder.Entity<Conversation>()
            .HasOne(c => c.User1)
            .WithMany()
            .HasForeignKey(c => c.User1Id)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Conversation>()
            .HasOne(c => c.User2)
            .WithMany()
            .HasForeignKey(c => c.User2Id)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique index so only 1 conversation per pair
        modelBuilder.Entity<Conversation>()
            .HasIndex(c => new { c.User1Id, c.User2Id })
            .IsUnique();

        // Message
        modelBuilder.Entity<Message>()
            .HasOne(m => m.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.ReplyToMessage)
            .WithMany()
            .HasForeignKey(m => m.ReplyToMessageId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.SharedPost)
            .WithMany()
            .HasForeignKey(m => m.SharedPostId)
            .OnDelete(DeleteBehavior.SetNull);

        // Shop Chat
        modelBuilder.Entity<ShopConversation>()
            .HasOne(c => c.Buyer)
            .WithMany()
            .HasForeignKey(c => c.BuyerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ShopConversation>()
            .HasOne(c => c.Shop)
            .WithMany()
            .HasForeignKey(c => c.ShopId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ShopMessage>()
            .HasOne(m => m.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ShopMessage>()
            .HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình Story
        modelBuilder.Entity<Story>()
            .HasOne(s => s.User)
            .WithMany(u => u.Stories)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cấu hình StoryLike
        modelBuilder.Entity<StoryLike>()
            .HasKey(sl => new { sl.StoryId, sl.UserId });

        modelBuilder.Entity<StoryLike>()
            .HasOne(sl => sl.Story)
            .WithMany(s => s.StoryLikes)
            .HasForeignKey(sl => sl.StoryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<StoryLike>()
            .HasOne(sl => sl.User)
            .WithMany()
            .HasForeignKey(sl => sl.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Cấu hình StoryView
        modelBuilder.Entity<StoryView>()
            .HasKey(sv => new { sv.StoryId, sv.UserId });

        modelBuilder.Entity<StoryView>()
            .HasOne(sv => sv.Story)
            .WithMany(s => s.StoryViews)
            .HasForeignKey(sv => sv.StoryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<StoryView>()
            .HasOne(sv => sv.User)
            .WithMany()
            .HasForeignKey(sv => sv.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Verification Requests ---
        modelBuilder.Entity<VerificationRequest>()
            .HasOne(vr => vr.User)
            .WithMany(u => u.VerificationRequests)
            .HasForeignKey(vr => vr.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- Auction ---
        modelBuilder.Entity<Auction>()
            .HasOne(a => a.Seller)
            .WithMany()
            .HasForeignKey(a => a.SellerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Auction>()
            .HasOne(a => a.HighestBidder)
            .WithMany()
            .HasForeignKey(a => a.HighestBidderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AuctionBid>()
            .HasOne(ab => ab.Auction)
            .WithMany(a => a.Bids)
            .HasForeignKey(ab => ab.AuctionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AuctionBid>()
            .HasOne(ab => ab.User)
            .WithMany()
            .HasForeignKey(ab => ab.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Affiliate & Shoppable Posts ---
        modelBuilder.Entity<PostProductTag>()
            .HasOne(pt => pt.Post)
            .WithMany(p => p.ProductTags)
            .HasForeignKey(pt => pt.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PostProductTag>()
            .HasOne(pt => pt.Product)
            .WithMany()
            .HasForeignKey(pt => pt.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- Group & Community ---
        modelBuilder.Entity<Group>()
            .HasOne(g => g.Owner)
            .WithMany(u => u.OwnedGroups)
            .HasForeignKey(g => g.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupMember>()
            .HasKey(gm => new { gm.GroupId, gm.UserId });

        modelBuilder.Entity<GroupMember>()
            .HasOne(gm => gm.Group)
            .WithMany(g => g.Members)
            .HasForeignKey(gm => gm.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GroupMember>()
            .HasOne(gm => gm.User)
            .WithMany(u => u.GroupMemberships)
            .HasForeignKey(gm => gm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Post>()
            .HasOne(p => p.Group)
            .WithMany(g => g.Posts)
            .HasForeignKey(p => p.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.Group)
            .WithMany()
            .HasForeignKey(r => r.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        // AI Chat Shopping Assistant Configurations
        modelBuilder.Entity<AiChatSession>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.AnonymousSessionId).HasMaxLength(100);
            entity.Property(s => s.Title).HasMaxLength(200);
            entity.HasIndex(s => s.AnonymousSessionId);
            entity.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiChatMessage>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Role).HasMaxLength(50);
            // Intent stores full JSON - no length limit
            entity.Property(m => m.Intent).HasMaxLength(2000);
            entity.HasIndex(m => m.ClientMessageId);
            entity.HasOne(m => m.Session)
                .WithMany(s => s.Messages)
                .HasForeignKey(m => m.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiRecommendationLog>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.Property(l => l.GroupType).HasMaxLength(50);
            entity.HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- Global DateTime UTC Converter ---
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
                        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc)));
                }
            }
        }
    }
}