-- ============================================================
-- DATABASE SCHEMA - Blog Social Platform
-- Generated from EF Core Migrations
-- PostgreSQL (Supabase)
-- Date: 2026-06-04
-- ============================================================

-- Xóa các bảng cũ nếu tồn tại (theo thứ tự FK)
DROP TABLE IF EXISTS "PostProductTags" CASCADE;
DROP TABLE IF EXISTS "AuctionBids" CASCADE;
DROP TABLE IF EXISTS "Auctions" CASCADE;
DROP TABLE IF EXISTS "UserVouchers" CASCADE;
DROP TABLE IF EXISTS "Banners" CASCADE;
DROP TABLE IF EXISTS "BannedWords" CASCADE;
DROP TABLE IF EXISTS "ShopMessages" CASCADE;
DROP TABLE IF EXISTS "ShopConversations" CASCADE;
DROP TABLE IF EXISTS "VerificationRequests" CASCADE;
DROP TABLE IF EXISTS "PollVotes" CASCADE;
DROP TABLE IF EXISTS "PollOptions" CASCADE;
DROP TABLE IF EXISTS "Polls" CASCADE;
DROP TABLE IF EXISTS "SavedPosts" CASCADE;
DROP TABLE IF EXISTS "PushSubscriptions" CASCADE;
DROP TABLE IF EXISTS "StoryViews" CASCADE;
DROP TABLE IF EXISTS "StoryLikes" CASCADE;
DROP TABLE IF EXISTS "Stories" CASCADE;
DROP TABLE IF EXISTS "Messages" CASCADE;
DROP TABLE IF EXISTS "Conversations" CASCADE;
DROP TABLE IF EXISTS "Vouchers" CASCADE;
DROP TABLE IF EXISTS "ProductReviewImages" CASCADE;
DROP TABLE IF EXISTS "ProductReviews" CASCADE;
DROP TABLE IF EXISTS "OrderItems" CASCADE;
DROP TABLE IF EXISTS "Orders" CASCADE;
DROP TABLE IF EXISTS "ProductVariants" CASCADE;
DROP TABLE IF EXISTS "ProductImages" CASCADE;
DROP TABLE IF EXISTS "Products" CASCADE;
DROP TABLE IF EXISTS "UserAddresses" CASCADE;
DROP TABLE IF EXISTS "ShopApplications" CASCADE;
DROP TABLE IF EXISTS "Shops" CASCADE;
DROP TABLE IF EXISTS "Reports" CASCADE;
DROP TABLE IF EXISTS "PostTags" CASCADE;
DROP TABLE IF EXISTS "PostLikes" CASCADE;
DROP TABLE IF EXISTS "PostImages" CASCADE;
DROP TABLE IF EXISTS "Comments" CASCADE;
DROP TABLE IF EXISTS "Posts" CASCADE;
DROP TABLE IF EXISTS "Notifications" CASCADE;
DROP TABLE IF EXISTS "Follows" CASCADE;
DROP TABLE IF EXISTS "Blocks" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;
DROP TABLE IF EXISTS "Tags" CASCADE;
DROP TABLE IF EXISTS "Categories" CASCADE;
DROP TABLE IF EXISTS "__EFMigrationsHistory" CASCADE;

-- ============================================================
-- MIGRATION HISTORY TABLE
-- ============================================================
CREATE TABLE "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- ============================================================
-- BẢNG GỐC (Không phụ thuộc bảng khác)
-- ============================================================

-- Categories (self-referencing)
CREATE TABLE "Categories" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Slug" text NOT NULL,
    "Icon" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ParentCategoryId" uuid,
    CONSTRAINT "PK_Categories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Categories_Categories_ParentCategoryId"
        FOREIGN KEY ("ParentCategoryId") REFERENCES "Categories" ("Id")
        ON DELETE RESTRICT
);
CREATE INDEX "IX_Categories_ParentCategoryId" ON "Categories" ("ParentCategoryId");

-- Tags
CREATE TABLE "Tags" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Slug" text NOT NULL,
    "Description" text,
    CONSTRAINT "PK_Tags" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "IX_Tags_Slug" ON "Tags" ("Slug");

-- Users
CREATE TABLE "Users" (
    "Id" uuid NOT NULL,
    "Username" text NOT NULL,
    "FullName" text NOT NULL,
    "Gender" text NOT NULL,
    "GoogleId" text,
    "Email" text NOT NULL,
    "PasswordHash" text NOT NULL,
    "AvatarUrl" text,
    "CoverImageUrl" text,
    "Bio" text,
    "PhoneNumber" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "IsActive" boolean NOT NULL,
    "IsPrivate" boolean NOT NULL,
    "Role" text NOT NULL,
    -- Added in later migrations:
    "IsEmailConfirmed" boolean NOT NULL DEFAULT false,
    "FaceDescriptor" text,
    "BiometricEnabled" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
);

-- ============================================================
-- BẢNG XÃ HỘI (Social)
-- ============================================================

-- Follows
CREATE TABLE "Follows" (
    "FollowerId" uuid NOT NULL,
    "FollowingId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Follows" PRIMARY KEY ("FollowerId", "FollowingId"),
    CONSTRAINT "FK_Follows_Users_FollowerId"
        FOREIGN KEY ("FollowerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Follows_Users_FollowingId"
        FOREIGN KEY ("FollowingId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_Follows_FollowingId" ON "Follows" ("FollowingId");

-- Blocks
CREATE TABLE "Blocks" (
    "BlockerId" uuid NOT NULL,
    "BlockedId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Blocks" PRIMARY KEY ("BlockerId", "BlockedId"),
    CONSTRAINT "FK_Blocks_Users_BlockerId"
        FOREIGN KEY ("BlockerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Blocks_Users_BlockedId"
        FOREIGN KEY ("BlockedId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_Blocks_BlockedId" ON "Blocks" ("BlockedId");

-- Notifications
CREATE TABLE "Notifications" (
    "Id" uuid NOT NULL,
    "ReceiverId" uuid NOT NULL,
    "ActorId" uuid NOT NULL,
    "Type" text NOT NULL,
    "TargetId" uuid,
    "Message" text NOT NULL,
    "IsRead" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Notifications_Users_ReceiverId"
        FOREIGN KEY ("ReceiverId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Notifications_Users_ActorId"
        FOREIGN KEY ("ActorId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_Notifications_ReceiverId" ON "Notifications" ("ReceiverId");
CREATE INDEX "IX_Notifications_ActorId" ON "Notifications" ("ActorId");

-- UserAddresses
CREATE TABLE "UserAddresses" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "FullName" text NOT NULL,
    "PhoneNumber" text NOT NULL,
    "Province" text NOT NULL,
    "DistrictWard" text NOT NULL,
    "SpecificAddress" text NOT NULL,
    "IsDefault" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_UserAddresses" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_UserAddresses_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_UserAddresses_UserId" ON "UserAddresses" ("UserId");

-- ============================================================
-- BẢNG BÀI VIẾT (Posts)
-- ============================================================

-- Posts
CREATE TABLE "Posts" (
    "Id" uuid NOT NULL,
    "Title" text NOT NULL,
    "Slug" text NOT NULL,
    "Content" text NOT NULL,
    "Summary" text,
    "FeaturedImageUrl" text,
    "ViewCount" integer NOT NULL DEFAULT 0,
    "LikeCount" integer NOT NULL DEFAULT 0,
    "Status" integer NOT NULL,
    "AuthorId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "PublishedAt" timestamp with time zone,
    "UpdatedAt" timestamp with time zone,
    -- Added in later migrations:
    "PostType" text NOT NULL DEFAULT 'blog',
    "Visibility" integer NOT NULL DEFAULT 0,
    "ShareCount" integer NOT NULL DEFAULT 0,
    "CommentCount" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_Posts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Posts_Users_AuthorId"
        FOREIGN KEY ("AuthorId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_Posts_AuthorId" ON "Posts" ("AuthorId");
CREATE UNIQUE INDEX "IX_Posts_Slug" ON "Posts" ("Slug");

-- Comments
CREATE TABLE "Comments" (
    "Id" uuid NOT NULL,
    "Content" text NOT NULL,
    "PostId" uuid NOT NULL,
    "AuthorId" uuid NOT NULL,
    "ParentCommentId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "IsApproved" boolean NOT NULL DEFAULT true,
    CONSTRAINT "PK_Comments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Comments_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Comments_Users_AuthorId"
        FOREIGN KEY ("AuthorId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Comments_Comments_ParentCommentId"
        FOREIGN KEY ("ParentCommentId") REFERENCES "Comments" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_Comments_PostId" ON "Comments" ("PostId");
CREATE INDEX "IX_Comments_AuthorId" ON "Comments" ("AuthorId");
CREATE INDEX "IX_Comments_ParentCommentId" ON "Comments" ("ParentCommentId");

-- PostImages
CREATE TABLE "PostImages" (
    "Id" uuid NOT NULL,
    "PostId" uuid NOT NULL,
    "Url" text NOT NULL,
    "OrderIndex" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_PostImages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PostImages_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_PostImages_PostId" ON "PostImages" ("PostId");

-- PostLikes (composite key)
CREATE TABLE "PostLikes" (
    "PostId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PostLikes" PRIMARY KEY ("PostId", "UserId"),
    CONSTRAINT "FK_PostLikes_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PostLikes_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_PostLikes_UserId" ON "PostLikes" ("UserId");

-- PostTags (composite key)
CREATE TABLE "PostTags" (
    "PostId" uuid NOT NULL,
    "TagId" uuid NOT NULL,
    CONSTRAINT "PK_PostTags" PRIMARY KEY ("PostId", "TagId"),
    CONSTRAINT "FK_PostTags_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PostTags_Tags_TagId"
        FOREIGN KEY ("TagId") REFERENCES "Tags" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_PostTags_TagId" ON "PostTags" ("TagId");

-- Reports
CREATE TABLE "Reports" (
    "Id" uuid NOT NULL,
    "PostId" uuid NOT NULL,
    "ReporterId" uuid NOT NULL,
    "Reason" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "IsResolved" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_Reports" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Reports_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Reports_Users_ReporterId"
        FOREIGN KEY ("ReporterId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_Reports_PostId" ON "Reports" ("PostId");
CREATE INDEX "IX_Reports_ReporterId" ON "Reports" ("ReporterId");

-- SavedPosts
CREATE TABLE "SavedPosts" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "PostId" uuid NOT NULL,
    "SavedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SavedPosts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SavedPosts_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SavedPosts_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "IX_SavedPosts_UserId_PostId" ON "SavedPosts" ("UserId", "PostId");

-- Polls
CREATE TABLE "Polls" (
    "Id" uuid NOT NULL,
    "PostId" uuid NOT NULL,
    "Question" text NOT NULL,
    "EndsAt" timestamp with time zone,
    CONSTRAINT "PK_Polls" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Polls_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE
);

-- PollOptions
CREATE TABLE "PollOptions" (
    "Id" uuid NOT NULL,
    "PollId" uuid NOT NULL,
    "Text" text NOT NULL,
    "VoteCount" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_PollOptions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PollOptions_Polls_PollId"
        FOREIGN KEY ("PollId") REFERENCES "Polls" ("Id") ON DELETE CASCADE
);

-- PollVotes (composite key)
CREATE TABLE "PollVotes" (
    "PollId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "OptionId" uuid NOT NULL,
    CONSTRAINT "PK_PollVotes" PRIMARY KEY ("PollId", "UserId"),
    CONSTRAINT "FK_PollVotes_Polls_PollId"
        FOREIGN KEY ("PollId") REFERENCES "Polls" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PollVotes_PollOptions_OptionId"
        FOREIGN KEY ("OptionId") REFERENCES "PollOptions" ("Id") ON DELETE CASCADE
);

-- ============================================================
-- BẢNG SHOPPING (E-commerce)
-- ============================================================

-- Shops
CREATE TABLE "Shops" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Slug" text NOT NULL,
    "Description" text NOT NULL,
    "LogoUrl" text,
    "CoverUrl" text,
    "Rating" double precision NOT NULL DEFAULT 0,
    "CreatedAt" timestamp with time zone NOT NULL,
    -- Added in later migrations:
    "IdentityVerified" boolean NOT NULL DEFAULT false,
    "IsSuspended" boolean NOT NULL DEFAULT false,
    "SuspensionReason" text,
    "TotalRevenue" numeric NOT NULL DEFAULT 0,
    "PlatformFeeRate" double precision NOT NULL DEFAULT 0.05,
    CONSTRAINT "PK_Shops" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Shops_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "IX_Shops_Slug" ON "Shops" ("Slug");
CREATE INDEX "IX_Shops_UserId" ON "Shops" ("UserId");

-- ShopApplications
CREATE TABLE "ShopApplications" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "ShopName" text NOT NULL,
    "Description" text NOT NULL,
    "IdentityInfo" text,
    "Status" integer NOT NULL DEFAULT 0,
    "AdminNote" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ShopApplications" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ShopApplications_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_ShopApplications_UserId" ON "ShopApplications" ("UserId");

-- Products
CREATE TABLE "Products" (
    "Id" uuid NOT NULL,
    "ShopId" uuid NOT NULL,
    "CategoryId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Slug" text NOT NULL,
    "Description" text NOT NULL,
    "Price" numeric NOT NULL,
    "Stock" integer NOT NULL DEFAULT 0,
    "FeaturedImageUrl" text,
    "Status" integer NOT NULL DEFAULT 0,
    "Rating" double precision NOT NULL DEFAULT 0,
    "SalesCount" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "VariantGroupName1" text,
    "VariantGroupName2" text,
    CONSTRAINT "PK_Products" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Products_Shops_ShopId"
        FOREIGN KEY ("ShopId") REFERENCES "Shops" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Products_Categories_CategoryId"
        FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "IX_Products_Slug" ON "Products" ("Slug");
CREATE INDEX "IX_Products_ShopId" ON "Products" ("ShopId");
CREATE INDEX "IX_Products_CategoryId" ON "Products" ("CategoryId");

-- ProductImages
CREATE TABLE "ProductImages" (
    "Id" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "Url" text NOT NULL,
    "OrderIndex" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_ProductImages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductImages_Products_ProductId"
        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_ProductImages_ProductId" ON "ProductImages" ("ProductId");

-- ProductVariants
CREATE TABLE "ProductVariants" (
    "Id" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Color" text,
    "Size" text,
    "ImageUrl" text,
    "PriceOverride" numeric NOT NULL,
    "Stock" integer NOT NULL DEFAULT 0,
    "OptionValue1" text,
    "OptionValue2" text,
    CONSTRAINT "PK_ProductVariants" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductVariants_Products_ProductId"
        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_ProductVariants_ProductId" ON "ProductVariants" ("ProductId");

-- ProductReviews
CREATE TABLE "ProductReviews" (
    "Id" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Rating" integer NOT NULL,
    "Comment" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_ProductReviews" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductReviews_Products_ProductId"
        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductReviews_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_ProductReviews_ProductId" ON "ProductReviews" ("ProductId");
CREATE INDEX "IX_ProductReviews_UserId" ON "ProductReviews" ("UserId");

-- ProductReviewImages
CREATE TABLE "ProductReviewImages" (
    "Id" uuid NOT NULL,
    "ProductReviewId" uuid NOT NULL,
    "Url" text NOT NULL,
    CONSTRAINT "PK_ProductReviewImages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductReviewImages_ProductReviews_ProductReviewId"
        FOREIGN KEY ("ProductReviewId") REFERENCES "ProductReviews" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_ProductReviewImages_ProductReviewId" ON "ProductReviewImages" ("ProductReviewId");

-- Vouchers
CREATE TABLE "Vouchers" (
    "Id" uuid NOT NULL,
    "ShopId" uuid NOT NULL,
    "Code" text NOT NULL,
    "DiscountType" integer NOT NULL,
    "DiscountValue" numeric NOT NULL,
    "MinOrderValue" numeric NOT NULL DEFAULT 0,
    "MaxDiscountAmount" numeric,
    "UsageLimit" integer NOT NULL DEFAULT 0,
    "UsedCount" integer NOT NULL DEFAULT 0,
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Vouchers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Vouchers_Shops_ShopId"
        FOREIGN KEY ("ShopId") REFERENCES "Shops" ("Id") ON DELETE CASCADE
);

-- UserVouchers
CREATE TABLE "UserVouchers" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "VoucherId" uuid NOT NULL,
    "ClaimedAt" timestamp with time zone NOT NULL,
    "IsUsed" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_UserVouchers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_UserVouchers_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_UserVouchers_Vouchers_VoucherId"
        FOREIGN KEY ("VoucherId") REFERENCES "Vouchers" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "IX_UserVouchers_UserId_VoucherId" ON "UserVouchers" ("UserId", "VoucherId");

-- Orders
CREATE TABLE "Orders" (
    "Id" uuid NOT NULL,
    "BuyerId" uuid NOT NULL,
    "ShopId" uuid,
    "VoucherId" uuid,
    "TotalAmount" numeric NOT NULL,
    "Status" integer NOT NULL DEFAULT 0,
    "PaymentMethod" text NOT NULL,
    "CustomerName" text NOT NULL,
    "PhoneNumber" text NOT NULL,
    "Province" text NOT NULL,
    "DistrictWard" text NOT NULL,
    "SpecificAddress" text NOT NULL,
    "ShippingAddress" text NOT NULL,
    "CustomerNote" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    -- Added later:
    "PlatformFee" numeric NOT NULL DEFAULT 0,
    "PayOSOrderCode" bigint,
    CONSTRAINT "PK_Orders" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Orders_Users_BuyerId"
        FOREIGN KEY ("BuyerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Orders_Vouchers_VoucherId"
        FOREIGN KEY ("VoucherId") REFERENCES "Vouchers" ("Id") ON DELETE SET NULL
);
CREATE INDEX "IX_Orders_BuyerId" ON "Orders" ("BuyerId");

-- OrderItems
CREATE TABLE "OrderItems" (
    "Id" uuid NOT NULL,
    "OrderId" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "VariantId" uuid,
    "Quantity" integer NOT NULL,
    "UnitPrice" numeric NOT NULL,
    "ShopId" uuid,
    "Status" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_OrderItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OrderItems_Orders_OrderId"
        FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OrderItems_Products_ProductId"
        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OrderItems_ProductVariants_VariantId"
        FOREIGN KEY ("VariantId") REFERENCES "ProductVariants" ("Id")
);
CREATE INDEX "IX_OrderItems_OrderId" ON "OrderItems" ("OrderId");
CREATE INDEX "IX_OrderItems_ProductId" ON "OrderItems" ("ProductId");
CREATE INDEX "IX_OrderItems_VariantId" ON "OrderItems" ("VariantId");

-- ============================================================
-- BẢNG STORIES
-- ============================================================

CREATE TABLE "Stories" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "MediaUrl" text NOT NULL,
    "MediaType" text NOT NULL,
    "Caption" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ViewCount" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_Stories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Stories_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_Stories_UserId" ON "Stories" ("UserId");

-- StoryLikes (composite key)
CREATE TABLE "StoryLikes" (
    "StoryId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_StoryLikes" PRIMARY KEY ("StoryId", "UserId"),
    CONSTRAINT "FK_StoryLikes_Stories_StoryId"
        FOREIGN KEY ("StoryId") REFERENCES "Stories" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StoryLikes_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

-- StoryViews (composite key)
CREATE TABLE "StoryViews" (
    "StoryId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "ViewedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_StoryViews" PRIMARY KEY ("StoryId", "UserId"),
    CONSTRAINT "FK_StoryViews_Stories_StoryId"
        FOREIGN KEY ("StoryId") REFERENCES "Stories" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_StoryViews_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

-- ============================================================
-- BẢNG CHAT / MESSAGES
-- ============================================================

-- Conversations (User-to-User)
CREATE TABLE "Conversations" (
    "Id" uuid NOT NULL,
    "User1Id" uuid NOT NULL,
    "User2Id" uuid NOT NULL,
    "LastMessageAt" timestamp with time zone,
    "LastMessagePreview" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Conversations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Conversations_Users_User1Id"
        FOREIGN KEY ("User1Id") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Conversations_Users_User2Id"
        FOREIGN KEY ("User2Id") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "IX_Conversations_User1Id_User2Id" ON "Conversations" ("User1Id", "User2Id");

-- Messages
CREATE TABLE "Messages" (
    "Id" uuid NOT NULL,
    "ConversationId" uuid NOT NULL,
    "SenderId" uuid NOT NULL,
    "Content" text,
    "ImageUrl" text,
    "MessageType" text NOT NULL DEFAULT 'text',
    "IsRead" boolean NOT NULL DEFAULT false,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ReplyToMessageId" uuid,
    "SharedPostId" uuid,
    "IsUnsent" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_Messages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Messages_Conversations_ConversationId"
        FOREIGN KEY ("ConversationId") REFERENCES "Conversations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Messages_Users_SenderId"
        FOREIGN KEY ("SenderId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Messages_Messages_ReplyToMessageId"
        FOREIGN KEY ("ReplyToMessageId") REFERENCES "Messages" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Messages_Posts_SharedPostId"
        FOREIGN KEY ("SharedPostId") REFERENCES "Posts" ("Id") ON DELETE SET NULL
);
CREATE INDEX "IX_Messages_ConversationId" ON "Messages" ("ConversationId");
CREATE INDEX "IX_Messages_SenderId" ON "Messages" ("SenderId");

-- ShopConversations (Buyer-to-Shop)
CREATE TABLE "ShopConversations" (
    "Id" uuid NOT NULL,
    "BuyerId" uuid NOT NULL,
    "ShopId" uuid NOT NULL,
    "LastMessageAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_ShopConversations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ShopConversations_Users_BuyerId"
        FOREIGN KEY ("BuyerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ShopConversations_Shops_ShopId"
        FOREIGN KEY ("ShopId") REFERENCES "Shops" ("Id") ON DELETE CASCADE
);

-- ShopMessages
CREATE TABLE "ShopMessages" (
    "Id" uuid NOT NULL,
    "ConversationId" uuid NOT NULL,
    "SenderId" uuid NOT NULL,
    "SenderType" text NOT NULL,
    "Content" text NOT NULL,
    "IsRead" boolean NOT NULL DEFAULT false,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_ShopMessages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ShopMessages_ShopConversations_ConversationId"
        FOREIGN KEY ("ConversationId") REFERENCES "ShopConversations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ShopMessages_Users_SenderId"
        FOREIGN KEY ("SenderId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

-- ============================================================
-- BẢNG KHÁC
-- ============================================================

-- PushSubscriptions
CREATE TABLE "PushSubscriptions" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Endpoint" text NOT NULL,
    "P256dh" text NOT NULL,
    "Auth" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PushSubscriptions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PushSubscriptions_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

-- VerificationRequests
CREATE TABLE "VerificationRequests" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Status" integer NOT NULL DEFAULT 0,
    "FullName" text NOT NULL,
    "IdCardNumber" text NOT NULL,
    "IdCardFrontUrl" text NOT NULL,
    "IdCardBackUrl" text NOT NULL,
    "SelfieUrl" text NOT NULL,
    "AdminNote" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_VerificationRequests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_VerificationRequests_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

-- BannedWords
CREATE TABLE "BannedWords" (
    "Id" uuid NOT NULL,
    "Word" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_BannedWords" PRIMARY KEY ("Id")
);

-- Banners
CREATE TABLE "Banners" (
    "Id" uuid NOT NULL,
    "Title" text NOT NULL,
    "ImageUrl" text NOT NULL,
    "LinkUrl" text,
    "IsActive" boolean NOT NULL DEFAULT true,
    "DisplayOrder" integer NOT NULL DEFAULT 0,
    "StartDate" timestamp with time zone,
    "EndDate" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Banners" PRIMARY KEY ("Id")
);

-- ============================================================
-- BẢNG ĐẤU GIÁ (Auction)
-- ============================================================

CREATE TABLE "Auctions" (
    "Id" uuid NOT NULL,
    "SellerId" uuid NOT NULL,
    "Title" text NOT NULL,
    "Description" text NOT NULL,
    "ImageUrl" text,
    "StartingPrice" numeric NOT NULL,
    "CurrentPrice" numeric NOT NULL,
    "BuyNowPrice" numeric,
    "HighestBidderId" uuid,
    "Status" integer NOT NULL DEFAULT 0,
    "StartTime" timestamp with time zone NOT NULL,
    "EndTime" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CategoryId" uuid,
    "Condition" text,
    "MinBidIncrement" numeric NOT NULL DEFAULT 0,
    CONSTRAINT "PK_Auctions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Auctions_Users_SellerId"
        FOREIGN KEY ("SellerId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Auctions_Users_HighestBidderId"
        FOREIGN KEY ("HighestBidderId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_Auctions_SellerId" ON "Auctions" ("SellerId");

CREATE TABLE "AuctionBids" (
    "Id" uuid NOT NULL,
    "AuctionId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Amount" numeric NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AuctionBids" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AuctionBids_Auctions_AuctionId"
        FOREIGN KEY ("AuctionId") REFERENCES "Auctions" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_AuctionBids_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE INDEX "IX_AuctionBids_AuctionId" ON "AuctionBids" ("AuctionId");

-- ============================================================
-- BẢNG SHOPPABLE POSTS (Affiliate / Tag sản phẩm)
-- ============================================================

CREATE TABLE "PostProductTags" (
    "Id" uuid NOT NULL,
    "PostId" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PostProductTags" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PostProductTags_Posts_PostId"
        FOREIGN KEY ("PostId") REFERENCES "Posts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PostProductTags_Products_ProductId"
        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_PostProductTags_PostId" ON "PostProductTags" ("PostId");
CREATE INDEX "IX_PostProductTags_ProductId" ON "PostProductTags" ("ProductId");

-- ============================================================
-- MIGRATION HISTORY RECORDS
-- ============================================================
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES
('20260422104304_InitialCreate', '8.0.0'),
('20260427122316_AddShopIdentityAndSuspension', '8.0.0'),
('20260428105505_AddPaymentAndShippingFields', '8.0.0'),
('20260502115526_AddChatFeature', '8.0.0'),
('20260502153714_AddMessageImageUrl', '8.0.0'),
('20260503082639_UpdateMessageFeaturesFinal', '8.0.0'),
('20260504121620_UpdateStoryEntity', '8.0.0'),
('20260504161816_AddStoryLikes', '8.0.0'),
('20260504162954_AddStoryViews', '8.0.0'),
('20260505091850_AddPushSubscriptions', '8.0.0'),
('20260509153406_AddSavedPostsAndPolls', '8.0.0'),
('20260510114627_AddIsEmailConfirmedToUser', '8.0.0'),
('20260510115943_FinalizeUserModel', '8.0.0'),
('20260510121111_RestoreFeaturesSync', '8.0.0'),
('20260510151555_AddVerificationRequests', '8.0.0'),
('20260511054101_AddVoucherSystem', '8.0.0'),
('20260511061040_AddShopFeatures', '8.0.0'),
('20260515112543_AddBannedWords', '8.0.0'),
('20260515134757_AddOrderPlatformFee', '8.0.0'),
('20260515163330_AddPayOSOrderCode', '8.0.0'),
('20260516152422_AddBannersTable', '8.0.0'),
('20260516180822_AddVoucherManagement', '8.0.0'),
('20260521101645_AddAuctionAndAffiliate', '8.0.0'),
('20260521124539_UpdateAuctionFields', '8.0.0'),
('20260528164029_AddSocialFeaturesV1', '8.0.0'),
('20260531131450_AddAiBiometrics', '8.0.0');
