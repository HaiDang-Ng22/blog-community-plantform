🚀 Zynk - Blog Social System
📌 Overview

Zynk là một hệ thống blog/mạng xã hội mini được xây dựng bằng ASP.NET Core theo mô hình Clean Architecture.

Hệ thống cho phép người dùng:

Đăng ký / đăng nhập
Tạo và quản lý bài viết
Bình luận bài viết
Gắn tag cho nội dung
🏗️ Architecture

Dự án được thiết kế theo Clean Architecture, giúp tách biệt rõ ràng giữa các layer:

Social/
│── Blog.API            # API Layer (Controllers)
│── Blog.Application    # Business Logic
│── Blog.Domain         # Entities + Interfaces
│── Blog.Infrastructure # Database + Repository
│── Blog.Web            # Frontend (HTML/JS)
│── Zynk                # Startup Project
🔹 Mô tả
Domain
Chứa các entity: User, Post, Comment, Tag
Định nghĩa interface
Application
Xử lý logic nghiệp vụ
DTOs và Services
Infrastructure
Entity Framework Core
Database Context
Repository Implementation
API
RESTful API
Swagger documentation
Web
Giao diện đơn giản (HTML, CSS, JS)
⚙️ Technologies
ASP.NET Core Web API (.NET)
Entity Framework Core
SQL Server
Swagger (API Docs)
JavaScript (Frontend)
🚀 Getting Started
1. Clone project
git clone <your-repo-url>
cd Social
2. Configure Database

Mở file appsettings.json và chỉnh:

"ConnectionStrings": {
  "DefaultConnection": "Server=.;Database=ZynkDb;Trusted_Connection=True;"
}
3. Apply Migration
dotnet ef database update
4. Run project
dotnet run --project Blog.API
5. Swagger API

Truy cập:

https://localhost:<port>/swagger
🔑 Main Features
🔐 Authentication
Register
Login
📝 Post Management
Create post
Update post
Delete post
Get all posts
💬 Comment
Add comment
View comments
🗄️ Database Structure

Các bảng chính:

Users
Posts
Comments
Tags
🧠 Design Patterns
Clean Architecture
Repository Pattern
Dependency Injection
📈 Future Improvements
JWT Authentication
Role-based Authorization
Upload images
Realtime (SignalR)
Deploy Cloud (Azure / Railway)
👨‍💻 Author

Nguyễn Hải Đăng
Backend Developer / Game Developer