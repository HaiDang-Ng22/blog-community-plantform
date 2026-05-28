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
*   **Chế độ tối (Dark Mode)**: Giao diện tối cao cấp, sang trọng, giúp bảo vệ mắt và tiết kiệm pin.
*   **Thăm dò ý kiến (Polls)**: Tạo các cuộc khảo sát trực tiếp trong bài viết với kết quả cập nhật thời gian thực.
*   **Hệ thống "Bộ sưu tập" (Saved Collections)**: Lưu trữ các nội dung yêu thích và phân loại theo từng chủ đề cá nhân.

### 📖 2. Zynk Stories (Instagram Style)
*   **Trải nghiệm Tạo tin Cao cấp**: Mở rộng không gian làm việc (Canvas lớn) với Layout 2 cột trực quan.
*   **Công cụ Inline Text**: Nhấn và gõ chữ trực tiếp lên ảnh, kéo thả tự do, hỗ trợ đổi đa dạng màu sắc (Color Palette) và Phông chữ (Font Family) giống hệt Instagram.
*   **Công cụ Vẽ tay (Doodle)**: Tự do phác họa trực tiếp lên hình ảnh/video bằng chuột hoặc ngón tay với nhiều tùy chọn màu sắc thời thượng và hỗ trợ tính năng Hoàn tác (Undo).
*   **Live Filters & Compositing**: Hiển thị bộ lọc màu (CSS Filters) thời gian thực và tự động ghép (bake) toàn bộ các lớp (Hình, Chữ, Nét vẽ) thành một bức ảnh nguyên khối ngay trên trình duyệt (Client-side) trước khi tải lên.
*   **Quyền riêng tư linh hoạt**: Công khai hoặc chỉ bạn bè (Followers) mới xem được.
*   **Thời gian hiển thị tuỳ chỉnh**: Tin tự động biến mất sau 12h, 18h hoặc 24h.
*   **Tương tác phong phú**: Thả tim ❤️, gửi trả lời trực tiếp qua tin nhắn riêng tư.
*   **Zynk Reels (Video Short)**: Trải nghiệm xem video ngắn cuộn dọc sống động, hỗ trợ tải lên video từ thiết bị với quy trình phân loại thông minh.

### 🛒 3. Thương mại Điện tử (Zynk Shop)
*   **Marketplace Hiện đại**: Khám phá sản phẩm với bố cục Full-width cao cấp, loại bỏ sidebar tĩnh để tối ưu không gian hiển thị.
*   **Danh mục Drill-down Đa cấp**: Hệ thống khám phá ngành hàng thông minh, cho phép đi sâu vào từng cấp độ danh mục (Cha -> Con -> Cháu...) kèm theo lọc sản phẩm tương ứng.
*   **Banner Slider Động**: Hệ thống quảng cáo chuyên nghiệp hỗ trợ tự động chuyển slide với thời gian tùy chỉnh.
*   **Kênh Người Bán (Seller Center)**: 
    *   Quy trình đăng ký Shop và xét duyệt bởi Admin.
    *   Quản lý sản phẩm, tồn kho và xử lý đơn hàng chuyên nghiệp.
    *   Dashboard thống kê doanh thu và hiệu quả kinh doanh.
*   **Thanh toán VietQR Tự động**: Tích hợp tạo mã QR thanh toán ngân hàng tự động cho từng đơn hàng, giúp người mua thanh toán chỉ trong vài giây.
*   **Đánh giá & Phản hồi**: Hệ thống đánh giá sản phẩm kèm hình ảnh thực tế từ người mua.

### 🛡 4. Quản trị & Bảo mật (Admin Center)
*   **Modern Dashboard**: Hệ thống thống kê chuyên nghiệp sử dụng **Chart.js**, theo dõi doanh thu 7 ngày gần nhất và top cửa hàng kinh doanh hiệu quả.
*   **Hệ thống Thông báo Thông minh**: Tự động hiển thị chấm đỏ (Badges) thời gian thực trên sidebar cho các mục cần xử lý gấp (Báo cáo vi phạm, Yêu cầu mở Shop).
*   **Quản lý Danh mục Đa cấp**: Tìm kiếm đệ quy (recursive search) và cấu trúc cây thư mục giúp quản lý hàng nghìn ngành hàng dễ dàng.
*   **Quản lý Banners Marketplace**: Giao diện quản trị Banner chuyên nghiệp với tính năng kéo thả (Drag & Drop) để sắp xếp thứ tự, xem trước trực tiếp (Live Preview) và cấu hình tốc độ chuyển slide.
*   **Kiểm duyệt Nội dung Chặt chẽ**: 
    *   Xem chi tiết bài viết bị báo cáo và đưa ra quyết định Xóa/Bỏ qua ngay lập tức.
    *   Quản lý danh sách người dùng, hỗ trợ tìm kiếm nhanh và xóa tài khoản vi phạm.
*   **Đặc quyền Admin**: Toàn quyền xem các bài viết riêng tư khi có báo cáo vi phạm để đảm bảo an toàn cộng đồng.
*   **Duyệt Tích Xanh (Verification)**: Chức năng xem xét và cấp tích xanh (Blue Tick) cho tài khoản đã xác minh giấy tờ.
*   **Xác thực & Bảo mật Cao cấp (Auth V2)**: 
    *   Sử dụng Token JWT bảo mật phân quyền (User/Seller/Admin).
    *   Đăng ký tài khoản và Khôi phục mật khẩu bảo mật bằng mã OTP gửi qua Email thực (Gmail SMTP).
    *   Tích hợp Đăng nhập nhanh bằng Google (Google OAuth 2.0).
*   **Responsive Design**: Tối ưu hóa 100% giao diện cho Mobile, Tablet và Desktop (Trang Admin được khóa trên Mobile để đảm bảo an toàn).

---

## 🛠 Công nghệ Sử dụng

### Backend
- **Framework**: ASP.NET Core 9 (Web API)
- **Database**: PostgreSQL (Npgsql)
- **ORM**: Entity Framework Core 9
- **Real-time**: SignalR
- **Analytics**: Chart.js Integration
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
- [x] **Admin Center Hiện đại (V4)**:
    - Thống kê doanh thu biểu đồ Chart.js.
    - Tìm kiếm danh mục đa cấp & Quản lý người dùng nâng cao.
    - Hệ thống thông báo chấm đỏ (Badges) cho báo cáo vi phạm.
    - Bổ sung Quản lý và duyệt cấp Tích xanh.
- [x] **Auth V2 & Bảo mật**:
    - Giao diện Premium Auth (Glassmorphism).
    - Xác minh Email OTP & Quên mật khẩu qua SMTP.
    - Đăng nhập bằng tài khoản Google.
- [x] **Zynk Stories (Instagram Style)**.
- [x] **Hệ thống Hashtags**: Tự động nhận diện hashtag (#) trong bài viết và bình luận.
- [x] **Hiện đại hóa các Trang Thông tin Footer (V6)**:
    - Thiết kế lại 7 trang thông tin: Giới thiệu (`about.html`), Trợ giúp (`help.html`), Báo chí (`press.html`), API (`api.html`), Việc làm (`jobs.html`), Quyền riêng tư (`privacy.html`), Điều khoản (`terms.html`).
    - Phong cách phẳng, tối giản, sáng sủa và chuyên nghiệp chuẩn Meta/Instagram/TikTok.
    - Đồng bộ hóa tuyệt đối với chế độ tối (`dark-mode`) và thanh Sidebar của hệ thống Zynk.
    - FAQ Accordion tương tác kèm lọc tìm kiếm tức thời, bộ lọc phân loại công việc mượt mà và khung tài liệu API RESTful chuẩn chỉnh.

### 🏗 Sắp tới

#### 📸 Mạng xã hội Nâng cao (Ưu tiên)
- [x] **Zynk Reels**: Trải nghiệm video ngắn cuộn dọc sống động.
- [x] **Hệ thống "Bộ sưu tập" (Collections)**: Cho phép người dùng lưu trữ bài viết theo từng chủ đề.
- [x] **Thăm dò ý kiến (Polls)**: Tăng tính tương tác thông qua các câu hỏi bình chọn trực tiếp.
- [x] **Chế độ tối (Dark Mode)**: Giao diện Dark sang trọng phủ rộng toàn hệ thống.

#### 🚀 Nâng cấp & Mở rộng (Roadmap mở rộng)
- [x] **Mã giảm giá (Vouchers)**: Shop có thể tạo khuyến mãi riêng để thu hút khách hàng.
- [ ] **Live Stream Bán hàng**: Kênh tương tác trực tiếp giúp người bán giới thiệu sản phẩm thời gian thực.
- [ ] **AI Recommendation & Tagging**: Tự động nhận diện nội dung hình ảnh và gợi ý sản phẩm/bài viết theo sở thích AI.
- [ ] **Cộng đồng (Groups)**: Tham gia vào các nhóm chuyên biệt theo chủ đề quan tâm.
- [ ] **Hệ thống Giao dịch Bảo đảm**: Trung gian thanh toán giúp bảo vệ người mua và người bán.
- [ ] **Phân tích Chuyên sâu cho Creator**: Dashboard số liệu tăng trưởng cho các KOLs/Influencers.
- [x] **PWA (Progressive Web App)**: Cho phép cài đặt ứng dụng Zynk trực tiếp lên màn hình điện thoại mà không cần App Store.
- [ ] **Thành viên Premium**: Gói đăng ký trả phí không quảng cáo, nhận tích xanh ưu tiên và các bộ lọc độc quyền.
- [ ] **Đấu giá trực tuyến (Live Auction)**: Hỗ trợ đấu giá sản phẩm thời gian thực qua SignalR.
- [ ] **Tiếp thị liên kết (Affiliate Marketing)**: Cho phép Creator gắn thẻ sản phẩm vào bài viết/reels để nhận hoa hồng.
- [ ] **Shoppable Posts & Reels**: Ghim sản phẩm trực tiếp lên hình ảnh/video để mua sắm nhanh.
- [ ] **Hệ thống Gamification & Quà tặng ảo (Virtual Gifting)**: Tích lũy Zynk Points, tặng quà qua Livestream/Chat.
- [ ] **Mua chung (Group Buy)**: Khuyến khích chia sẻ sản phẩm qua DM để nhận giá giảm (Social E-commerce).
- [ ] **Khám phá theo vị trí (Location-based Discovery)**: Tìm kiếm bạn bè và Shop lân cận qua bản đồ.
- [ ] **Audio/Video Call**: Tích hợp WebRTC gọi thoại/hình ảnh trực tiếp qua DM.

#### 🏗 Định hướng Kiến trúc Enterprise & Đột phá (Enterprise & Innovation)
**1. Nâng cấp Hạ tầng Kỹ thuật:**
- [ ] **Redis Caching**: Triển khai cache cho Newsfeed, Session và Danh mục sản phẩm để tối ưu hiệu năng.
- [ ] **Elasticsearch / Typesense**: Nâng cấp công cụ tìm kiếm toàn văn bản (Full-text Search), gợi ý từ khóa và bắt lỗi chính tả.
- [ ] **Message Broker (RabbitMQ)**: Tách các tác vụ nền nặng (gửi email, xử lý ảnh/video) chạy bất đồng bộ để tăng tốc API.
- [ ] **GraphQL Integration**: Áp dụng GraphQL cho các endpoint mạng xã hội phức tạp nhằm tối ưu hóa việc truyền tải dữ liệu.

**2. Đột phá Mạng xã hội:**
- [ ] **Zynk Spaces (Audio Rooms)**: Phòng trò chuyện bằng giọng nói trực tiếp (tương tự Twitter Spaces).
- [x] **Secret Chat (Vanish Mode)**: Chế độ tin nhắn tự hủy sau khi xem trong Direct Message.
- [x] **Đăng bài Ẩn danh (Anonymous Confessions)**: Tạo không gian an toàn để chia sẻ không lộ danh tính thật.
- [ ] **Zynk Events (Sự kiện)**: Hệ thống tạo, quản lý và bán vé cho sự kiện online/offline.

**3. Đột phá Thương mại Điện tử:**
- [ ] **WebAR Try-On**: Ứng dụng thực tế tăng cường cho phép thử sản phẩm (kính, mũ, nội thất) qua camera trình duyệt.
- [ ] **Social Gifting**: Tặng quà cho tài khoản khác trên hệ thống mà không cần biết địa chỉ giao hàng trước (người nhận tự điền).
- [ ] **Subscription Commerce**: Đăng ký mua định kỳ hàng tuần/tháng cho các sản phẩm tiêu dùng thiết yếu.
- [ ] **Custom Bundle**: Cho phép người mua tự phối ghép các sản phẩm yêu thích vào một combo để nhận chiết khấu linh hoạt.

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
---
*Dự án tâm huyết được phát triển và duy trì bởi **HaiDang**.* 

---
### 📊 Thống kê lượt xem
![Lượt xem](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2FHaiDang-Ng22%2Fblog-community-plantform&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=L%C6%B0%E1%BB%A3t+gh%C3%A9+th%C4%83m&edge_flat=false) 
