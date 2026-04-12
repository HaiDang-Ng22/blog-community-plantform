# Zynk - Modern Social Community Platform 🚀

Zynk là một nền tảng mạng xã hội hiện đại được xây dựng trên nền tảng .NET 8, tập trung vào trải nghiệm chia sẻ hình ảnh và tương tác cộng đồng với giao diện lấy cảm hứng từ Instagram.

![Instagram Style](https://img.shields.io/badge/UI-Instagram--Style-purple)
![Tech Stack](https://img.shields.io/badge/Backend-.NET%208-blue)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)

## ✨ Tính năng nổi bật

### 📸 Trải nghiệm Multimedia (Instagram Style)
- **Đăng nhiều ảnh:** Hỗ trợ tải lên và hiển thị nhiều hình ảnh trong một bài viết.
- **Giao diện Carousel:** Thanh trượt ảnh mượt mà với hiệu ứng Scroll Snap và dấu chấm điều hướng.
- **Tỉ lệ khung hình chuẩn:** Hình ảnh được tối ưu hóa theo tỉ lệ 1:1, mang lại cảm giác chuyên nghiệp.
- **Upload trực tiếp:** Hệ thống tải ảnh trực tiếp lên máy chủ thông qua Multipart API.

### 🔐 Bảo mật & Xác thực
- **Bảo mật đăng ký:** Ràng buộc mật khẩu mạnh (8+ ký tự, chữ hoa, ký tự đặc biệt).
- **Xác nhận mật khẩu:** Ngăn chặn sai sót khi đăng ký tài khoản.
- **JWT Auth:** Hệ thống xác thực dựa trên Token bảo mật.

### 🌐 Chức năng Mạng xã hội
- **Bảng tin thông minh:** Tự động cập nhật bài viết mới nhất.
- **Tương tác:** Thích (Like), Bình luận đa cấp (Reply), Chia sẻ.
- **Thông báo:** Hệ thống thông báo thời gian thực về các tương tác.
- **Tìm kiếm:** Tìm kiếm bài viết và người dùng linh hoạt.
- **Hồ sơ cá nhân:** Tùy chỉnh Avatar, Ảnh bìa và tiểu sử (Bio).

### 🛠 Kỹ thuật & Hệ thống
- **Auto-Schema Update:** Tự động phát hiện và nâng cấp cơ sở dữ liệu khi khởi động, không cần Migration thủ công.
- **Clean Architecture:** Phân tách rõ ràng giữa Domain, Application, Infrastructure và API.
- **Unified Server:** .NET API phục vụ trực tiếp các tệp tĩnh (HTML/JS), dễ dàng triển khai.

## 🚀 Công nghệ sử dụng

- **Backend:** .NET 8 Web API
- **Database:** SQL Server, Entity Framework Core
- **Frontend:** Vanilla HTML5, CSS3 (Modern Flexbox/Grid), Javascript (ES6+)
- **Icons:** Font Awesome 6
- **Fonts:** Google Fonts (Inter)

## 🛠 Hướng dẫn cài đặt

1. **Clone dự án:**
   ```bash
   git clone https://github.com/HaiDang-Ng22/blog-community-plantform.git
   ```

2. **Cấu hình Database:**
   Cập nhật chuỗi kết nối trong `Blog.API/appsettings.json`.

3. **Chạy ứng dụng:**
   ```bash
   cd Blog.API
   dotnet run
   ```

4. **Truy cập:**
   Mở trình duyệt và truy cập `http://localhost:7000`.

---
*Made with ❤️ for developers by Hai Dang.*