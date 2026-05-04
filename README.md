# Zynk - Nền tảng Mạng xã hội & Thương mại Điện tử Hiện đại 🚀

Zynk là một hệ sinh thái mạng xã hội tích hợp thương mại điện tử (All-in-one), kết hợp tinh hoa từ phong cách thẩm mỹ của **Instagram** và mô hình vận hành của **TikTok Shop**. Dự án được xây dựng trên nền tảng công nghệ mới nhất (**ASP.NET Core 9**), tập trung vào hiệu năng cao, trải nghiệm người dùng cao cấp (Glassmorphism UI) và khả năng tương tác thời gian thực.

![Tech Stack](https://img.shields.io/badge/Backend-.NET%209-blue)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)
![Realtime](https://img.shields.io/badge/Realtime-SignalR-orange)
![UI](https://img.shields.io/badge/UI-Glassmorphism-purple)
![Stories](https://img.shields.io/badge/Stories-Instagram%20Style-e1306c)

🌍 **[Xem Live Demo tại đây](https://zynk-9al4.onrender.com/)**

---

## ✨ Tính năng Nổi bật

### 📸 1. Mạng Xã hội Tương tác (Instagram Style)
*   **Multimedia Feed**: Chia sẻ bài viết với nhiều hình ảnh (Carousel), hỗ trợ hiển thị linh hoạt theo dạng Blog (chữ) hoặc Social (ảnh).
*   **Tương tác Thời gian thực**: Like, Comment đa cấp và Follow người dùng.
*   **Hệ thống Thông báo (Real-time)**: Nhận thông báo tức thì khi có người tim, bình luận hoặc nhắc tên.
*   **Nhắn tin Trực tiếp (Direct Message)**: Hệ thống Chat 1-1 realtime sử dụng SignalR, hỗ trợ xem trạng thái tin nhắn và danh sách hộp thư thông minh.
*   **Trang cá nhân Chuyên nghiệp**: Quản lý bài viết, bộ sưu tập và thông tin cá nhân với giao diện hiện đại.

### 📖 2. Zynk Stories (Instagram Style)
*   **Đăng tin đa phương tiện**: Đăng ảnh, video hoặc tin văn bản với nền màu/gradient cá nhân hoá.
*   **Quyền riêng tư linh hoạt**: Công khai hoặc chỉ bạn bè (Followers) mới xem được.
*   **Thời gian hiển thị tuỳ chỉnh**: Tin tự động biến mất sau 12h, 18h hoặc 24h.
*   **Tương tác phong phú**: Thả tim ❤️, gửi trả lời trực tiếp qua tin nhắn riêng tư.
*   **Phân tích lượt xem & tim**: Chủ tin xem được danh sách người đã xem và tim. 
*   **Hiệu ứng trái tim bay**: Khi có lượt tim mới, hiệu ứng động xuất hiện ngay lập tức.
*   **Điều khiển thông minh**: Nhấn giữ để tạm dừng, thả ra để tiếp tục; chuyển tin bằng nút trái/phải.
*   **Privacy feed**: Thanh Story trang chủ chỉ hiển thị tin của người dùng đang theo dõi. Xem tin người lạ qua trang cá nhân của họ.
*   **Thông báo**: Tác giả nhận thông báo ngay khi có người thả tim.

### 🛒 3. Thương mại Điện tử (Zynk Shop)
*   **Marketplace Đa dạng**: Khám phá sản phẩm theo danh mục đa cấp, lọc giá và sắp xếp thông minh.
*   **Kênh Người Bán (Seller Center)**: 
    *   Quy trình đăng ký Shop và xét duyệt bởi Admin.
    *   Quản lý sản phẩm, tồn kho và xử lý đơn hàng chuyên nghiệp.
    *   Dashboard thống kê doanh thu và hiệu quả kinh doanh.
*   **Thanh toán VietQR Tự động**: Tích hợp tạo mã QR thanh toán ngân hàng tự động cho từng đơn hàng, giúp người mua thanh toán chỉ trong vài giây.
*   **Đánh giá & Phản hồi**: Hệ thống đánh giá sản phẩm kèm hình ảnh thực tế từ người mua.

### 🛡 4. Quản trị & Bảo mật
*   **Admin Dashboard**: Phê duyệt Shop, quản lý báo cáo vi phạm và kiểm duyệt nội dung toàn hệ thống.
*   **Xác thực JWT**: Hệ thống bảo mật Token đảm bảo an toàn thông tin người dùng và phân quyền (User/Seller/Admin).
*   **Responsive Design**: Tối ưu hóa 100% giao diện cho Mobile, Tablet và Desktop.

---

## 🛠 Công nghệ Sử dụng

### Backend
- **Framework**: ASP.NET Core 9 (Web API)
- **Database**: PostgreSQL (Npgsql)
- **ORM**: Entity Framework Core 9
- **Real-time**: SignalR
- **Authentication**: JWT Bearer Token
- **Storage**: Cloudinary Integration (Xử lý hình ảnh)

### Frontend
- **Core**: Vanilla Javascript (ES6+), HTML5, CSS3
- **Design System**: Glassmorphism UI Kit (Tự phát triển)
- **Icons**: FontAwesome 6
- **Typography**: Inter & Outfit (Google Fonts)

---

## 🚀 Lộ trình Phát triển (Roadmap)

### ✅ Đã Hoàn thành
- [x] Kiến trúc Clean Architecture & Database Core.
- [x] Hệ thống Marketplace & Giỏ hàng.
- [x] Thanh toán VietQR.
- [x] Chức năng Blog, Like, Comment, Follow.
- [x] **Real-time Chat (SignalR)**.
- [x] **Hệ thống Thông báo thời gian thực**.
- [x] **Tối ưu hóa UI Mobile & Tablet**.
- [x] Admin Center & Seller Center.
- [x] **Zynk Stories (Instagram Style)** — Đã hoàn thiện toàn bộ:
  - Đăng tin ảnh/video/văn bản, quyền riêng tư công khai & bạn bè.
  - Thả tim, trả lời, xem danh sách người tương tác.
  - Hiệu ứng trái tim bay, nhấn giữ để dừng, thông báo realtime.
  - Phân quyền hiển thị: Feed chỉ hiện tin người đang Follow; tin người lạ xem qua trang cá nhân.
  - Giao diện full-screen tối ưu cho cả mobile và desktop.

### 🏗 Sắp tới
- [ ] **Mã giảm giá (Vouchers)**: Shop có thể tạo khuyến mãi riêng.
- [ ] **AI Recommendation**: Gợi ý sản phẩm và bài viết theo sở thích.
- [ ] **PWA (Progressive Web App)**: Cài đặt ứng dụng trực tiếp lên điện thoại.

---

## 🛠 Hướng dẫn Cài đặt

1. **Clone dự án**:
   ```bash
   git clone https://github.com/HaiDang-Ng22/blog-community-plantform.git
   ```

2. **Cấu hình**: 
   Cập nhật thông tin kết nối PostgreSQL và các khóa bí mật (JWT, Cloudinary) trong file `Blog.API/appsettings.json`.

3. **Chạy ứng dụng**:
   ```bash
   # Di chuyển vào thư mục API
   cd Blog.API
   # Chạy dự án (Backend sẽ tự động serve Frontend từ thư mục Blog.Web)
   dotnet run
   ```

4. **Truy cập**: 
   Mở trình duyệt và truy cập `http://localhost:7000`.

---
*Dự án tâm huyết được phát triển và duy trì bởi **HaiDang**.* 