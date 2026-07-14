using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blog.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAiShoppingChat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AiChatSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AnonymousSessionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiChatSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiChatSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiRecommendationLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    MessageId = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<double>(type: "double precision", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    GroupType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsClicked = table.Column<bool>(type: "boolean", nullable: false),
                    IsAddedToCart = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiRecommendationLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiRecommendationLogs_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiChatMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    Intent = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    MetadataJson = table.Column<string>(type: "text", nullable: true),
                    ClientMessageId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiChatMessages_AiChatSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "AiChatSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AiChatMessages_ClientMessageId",
                table: "AiChatMessages",
                column: "ClientMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatMessages_SessionId",
                table: "AiChatMessages",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatSessions_AnonymousSessionId",
                table: "AiChatSessions",
                column: "AnonymousSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatSessions_UserId",
                table: "AiChatSessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AiRecommendationLogs_ProductId",
                table: "AiRecommendationLogs",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AiChatMessages");

            migrationBuilder.DropTable(
                name: "AiRecommendationLogs");

            migrationBuilder.DropTable(
                name: "AiChatSessions");
        }
    }
}
