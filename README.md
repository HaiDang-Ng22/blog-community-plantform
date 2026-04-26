# Zynk - Nền tảng Mạng xã hội & Thương mại Điện tử Đa năng 🚀

Zynk là một hệ sinh thái hiện đại kết hợp giữa **Mạng xã hội hình ảnh (Instagram Style)** và **Thương mại điện tử đa người bán (TikTok Shop Style)**. Dự án được phát triển dựa trên nền tảng **.NET 8** và **Vanilla JS**, tập trung vào kiến trúc mã nguồn sạch, trải nghiệm người dùng mượt mà và khả năng quản trị mạnh mẽ.

![Tech Stack](https://img.shields.io/badge/Backend-.NET%208-blue)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)
![Architecture](https://img.shields.io/badge/Architecture-Clean%20Architecture-green)

🌍 **[Xem Live Demo tại đây](https://zynk-9al4.onrender.com/)**

---

## ✨ Các Phân hệ Tính năng

### 🛒 1. Hệ thống Thương mại Điện tử (Zynk Shop)
Hệ thống TMĐT được xây dựng theo mô hình Market-place đa người bán với các tính năng chuyên sâu:
*   **Marketplace & Discovery**: Giao diện mua sắm Glassmorphism hiện đại, hỗ trợ duyệt sản phẩm theo danh mục đa cấp (Recursive Category), lọc theo khoảng giá, và sắp xếp theo đánh giá/bán chạy.
*   **Hệ thống Tìm kiếm Toàn năng**: 
    *   **Shop Search**: Tìm kiếm sản phẩm thông minh theo tên, mô tả hoặc danh mục cha/con.
    *   **Blog Search**: Tìm kiếm bài viết và người dùng theo tên, nội dung hoặc ID.
    *   **Conditional Rendering**: Hiển thị bài viết linh hoạt theo phong cách Blog (chữ) hoặc Social (ảnh) tùy thuộc vào nội dung.
*   **Kênh Người Bán (Seller Center)**: 
    *   Quy trình đăng ký và xét duyệt Shop bởi Admin.
    *   Dashboard quản lý sản phẩm, tồn kho và theo dõi đơn hàng chuyên nghiệp.
    *   Hệ thống báo cáo doanh thu tự động cập nhật khi đơn hàng được giao thành công.
*   **Giỏ hàng & Thanh toán cực nhanh**: Luồng checkout tối ưu với hình thức thanh toán COD giả lập, tự động lưu địa chỉ giao hàng.
*   **Quản lý Đơn hàng & Đánh giá**: 
    *   Hệ thống cập nhật trạng thái đơn hàng thời gian thực. Quy trình bàn giao được kiểm soát chặt chẽ (Người bán xác nhận đơn hàng Hoàn thành sau khi đã Giao hàng).
    *   Hệ thống đánh giá sản phẩm thông minh: Mỗi đơn hàng chỉ được đánh giá một lần, yêu cầu đã nhận hàng mới được đánh giá.
*   **Dữ liệu mẫu (Seeding)**: Hệ thống tự động khởi tạo dữ liệu mẫu cho Marketplace (Danh mục, Shop, Sản phẩm) ngay khi khởi động ứng dụng lần đầu.
 
 ### 📸 2. Mạng Xã hội Tương tác
 Trải nghiệm chia sẻ nội dung được tối ưu theo phong cách hiện đại:
 *   **Multimedia Sharing**: Hỗ trợ đăng nhiều ảnh trong một bài viết với Carousel mượt mà.
 *   **Social Interactions**: Hệ thống Like, Comment đa cấp, Chia sẻ và Follow người dùng.
 *   **Kiểm duyệt Nội dung (Moderation)**: Tính năng báo cáo vi phạm và hệ thống ẩn/chặn nội dung nhạy cảm.
 *   **Thông báo (Notifications)**: Thông báo tức thời về các tương tác xã hội và cập nhật trạng thái mua sắm.

### 🛡 3. Quản trị Hệ thống (Admin Dashboard)
*   **Duyệt Cửa hàng**: Admin có quyền phê duyệt hoặc từ chối các yêu cầu mở shop.
*   **Quản lý Người dùng & Nội dung**: Theo dõi báo cáo, xử lý vi phạm và quản lý danh sách thành viên (tự động ẩn các tài khoản quản trị để bảo mật).

---

## 🛠 Kiến trúc & Kỹ thuật

Dự án áp dụng các tiêu chuẩn phát triển phần mềm hiện đại:
- **Clean Architecture**: Tách biệt rõ ràng các lớp Domain, Application, Infrastructure và API.
- **Repository Pattern**: Tối ưu việc truy xuất và xử lý dữ liệu từ Database.
- **Auto-Schema Management**: Tự động phát hiện và nâng cấp cơ sở dữ liệu qua code SQL thủ công trong `Program.cs`, không cần migrations phức tạp.
- **JWT Authentication**: Hệ thống xác thực và phân quyền (Admin/User/Seller) dựa trên Token bảo mật.
- **Responsive Design**: Giao diện hiển thị tốt trên mọi thiết bị (Mobile & Desktop).

---

## 🚀 Công nghệ sử dụng

- **Backend:** .NET 8 Web API, Entity Framework Core 8, SQL Server.
- **Frontend:** HTML5, CSS3, Javascript ES6+, UI Kit Glassmorphism.
- **Tools:** GitHub, Visual Studio 2022.

---

## 🛠 Hướng dẫn cài đặt

1. **Clone dự án:**
   ```bash
   git clone https://github.com/HaiDang-Ng22/blog-community-plantform.git
   ```

2. **Cấu hình**: Cập nhật Connection String trong `Blog.API/appsettings.json`.
3. **Chạy ứng dụng**:
   ```bash
   cd Blog.API
   dotnet run
   ```
4. **Truy cập**: `http://localhost:7000`.

---
*Dự án tâm huyết phát triển bởi HaiDang *