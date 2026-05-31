using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blog.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAiBiometrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AiMatchPercentage",
                table: "ShopApplications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "CccdBackUrl",
                table: "ShopApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CccdFrontUrl",
                table: "ShopApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAiVerified",
                table: "ShopApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SelfieUrl",
                table: "ShopApplications",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiMatchPercentage",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "CccdBackUrl",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "CccdFrontUrl",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "IsAiVerified",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "SelfieUrl",
                table: "ShopApplications");
        }
    }
}
