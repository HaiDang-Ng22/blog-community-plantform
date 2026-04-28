using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blog.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddShopIdentityAndSuspension : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdentityInfo",
                table: "ShopApplications");

            migrationBuilder.AddColumn<bool>(
                name: "IsSuspended",
                table: "Shops",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CitizenId",
                table: "ShopApplications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "ShopApplications",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "ShopApplications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "ShopApplications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Hometown",
                table: "ShopApplications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Occupation",
                table: "ShopApplications",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSuspended",
                table: "Shops");

            migrationBuilder.DropColumn(
                name: "CitizenId",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "Hometown",
                table: "ShopApplications");

            migrationBuilder.DropColumn(
                name: "Occupation",
                table: "ShopApplications");

            migrationBuilder.AddColumn<string>(
                name: "IdentityInfo",
                table: "ShopApplications",
                type: "text",
                nullable: true);
        }
    }
}
