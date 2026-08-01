# Zynk Social Commerce Platform

[![Build and Test](https://github.com/HaiDang-Ng22/blog-community-plantform/actions/workflows/ci.yml/badge.svg)](https://github.com/HaiDang-Ng22/blog-community-plantform/actions/workflows/ci.yml)
![.NET](https://img.shields.io/badge/.NET-9.0-512BD4)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-EF%20Core-336791)
![Realtime](https://img.shields.io/badge/Realtime-SignalR-F97316)
![Tests](https://img.shields.io/badge/Automated%20tests-MSTest-16A34A)

Zynk là đồ án nền tảng kết hợp **mạng xã hội**, **thương mại điện tử**, **chat thời gian thực** và các tính năng **AI hỗ trợ**. Dự án được xây dựng bằng ASP.NET Core 9, PostgreSQL, Entity Framework Core, SignalR và frontend HTML/CSS/JavaScript thuần.

> Trạng thái: đồ án đang tiếp tục được hoàn thiện. Các tính năng AI và nhận dạng hình ảnh là prototype tích hợp API, không được mô tả như một hệ thống xác minh production.

## Liên kết

- Swagger khi chạy Development: `/swagger`
- Liveness probe: `/health/live`
- Readiness probe: `/health/ready`
- Kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- API chính: [docs/API.md](docs/API.md)

Endpoint readiness trả HTTP `503` khi PostgreSQL chưa sẵn sàng.

## Chức năng đã triển khai

### Mạng xã hội

- Đăng bài văn bản hoặc nhiều hình ảnh, hashtag và bình chọn.
- Like, bình luận nhiều cấp, theo dõi, lưu bài viết và thông báo.
- Hồ sơ cá nhân, quyền riêng tư, dark mode và đa ngôn ngữ.
- Stories, Reels và Groups với quy trình duyệt thành viên nhóm riêng tư.
- Chat 1-1 và thông báo thời gian thực bằng SignalR.

### Social commerce

- Marketplace, danh mục nhiều cấp, tìm kiếm và lọc sản phẩm.
- Seller Center: đăng ký shop, duyệt shop, sản phẩm, tồn kho và đơn hàng.
- Giỏ hàng, địa chỉ nhận hàng, VietQR/PayOS và lịch sử đơn hàng.
- Voucher theo phần trăm, số tiền cố định, miễn phí ship và giảm một phần phí ship.
- Đánh giá sản phẩm, đấu giá và nội dung có gắn sản phẩm.

### Admin Center

- Dashboard vận hành, người dùng, báo cáo vi phạm và tích xanh.
- Danh mục nhiều cấp, cửa hàng, banner, đấu giá và voucher.
- Danh sách từ khóa cấm và kiểm duyệt nội dung.
- Admin AI Copilot lập kế hoạch tác vụ; thao tác ghi dữ liệu luôn yêu cầu xác nhận.
- Tạo voucher bằng AI theo quy trình hai lần xác nhận trước khi ghi database.

### AI hỗ trợ

- Tìm kiếm và gợi ý nội dung dựa trên truy vấn ngôn ngữ tự nhiên.
- Trợ lý mua sắm và Admin AI Copilot.
- Prototype OCR giấy tờ và đối chiếu ảnh qua Gemini API.
- Feed ranking thử nghiệm dựa trên tương tác, độ mới và sở thích.

## Kiến trúc source

```text
Blog.API             ASP.NET Core API, authentication, controllers, SignalR hubs
Blog.Application     DTO, application services và quy tắc nghiệp vụ dùng chung
Blog.Domain          Entity, enum và repository contracts
Blog.Infrastructure  EF Core, PostgreSQL, repository và external services
Blog.Web             HTML, CSS, JavaScript và PWA assets
Blog.Tests           Automated tests cho các quy tắc nghiệp vụ quan trọng
docs                 Tài liệu kiến trúc và API
```

Luồng phụ thuộc chính:

```text
Blog.Web → Blog.API → Blog.Application → Blog.Domain
                 └→ Blog.Infrastructure → PostgreSQL / external APIs
```

## Công nghệ

- ASP.NET Core 9 Web API
- PostgreSQL và Entity Framework Core 9
- JWT Bearer Authentication và phân quyền User/Seller/Admin
- SignalR cho chat và thông báo
- Cloudinary cho media
- PayOS/VietQR cho thanh toán
- Gemini API cho các tính năng AI hỗ trợ
- Firebase/Firestore cho tích hợp chat liên quan
- HTML5, CSS3, Vanilla JavaScript và PWA
- MSTest và GitHub Actions

## Chạy dự án

### Yêu cầu

- .NET SDK 9
- PostgreSQL
- Tài khoản Cloudinary cho chức năng tải media
- Các khóa PayOS, Gemini, SMTP hoặc Firebase chỉ cần khi kiểm tra tính năng tương ứng

### Cấu hình an toàn

Không ghi secret thật vào `appsettings.json`. Tạo `Blog.API/appsettings.Local.json` — tệp này đã được `.gitignore`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=zynk;Username=postgres;Password=your_password"
  },
  "Jwt": {
    "Key": "replace-with-a-random-key-at-least-32-characters",
    "Issuer": "BlogAPI",
    "Audience": "BlogFrontend"
  },
  "CloudinarySettings": {
    "CloudName": "your_cloud_name",
    "ApiKey": "your_api_key",
    "ApiSecret": "your_api_secret"
  }
}
```

Khi triển khai, dùng environment variables theo cú pháp ASP.NET Core, ví dụ:

```text
DATABASE_URL
Jwt__Key
Jwt__Issuer
Jwt__Audience
CloudinarySettings__CloudName
CloudinarySettings__ApiKey
CloudinarySettings__ApiSecret
Gemini__ApiKey
```

### Khởi chạy

```bash
dotnet restore BlogSystem.sln
dotnet run --project Blog.API --urls http://localhost:7000
```

Mở [http://localhost:7000](http://localhost:7000). API tự phục vụ frontend trong thư mục `Blog.Web`.

## Kiểm thử và chất lượng code

```bash
dotnet build BlogSystem.sln --configuration Release --no-restore
dotnet test BlogSystem.sln --configuration Release --no-build
```

Bộ test hiện tập trung vào quy tắc tài chính của voucher:

- Giảm phần trăm và mức giảm tối đa.
- Giảm tiền cố định không vượt giá trị đơn.
- Miễn phí vận chuyển.
- Giảm một phần phí vận chuyển không tạo phí âm.
- Điều kiện đơn tối thiểu.
- Chuẩn hóa dữ liệu âm và kiểm tra hàm không thay đổi entity đầu vào.

GitHub Actions tự động chạy `Restore → Build → Test → JavaScript syntax check → Publish` trên push và pull request.

## Theo dõi triển khai

```text
GET /health/live   Kiểm tra tiến trình API đang hoạt động
GET /health/ready  Kiểm tra API kết nối được PostgreSQL
```

Ví dụ phản hồi readiness thành công:

```json
{
  "status": "Ready",
  "database": "Connected",
  "timestamp": "2026-08-01T00:00:00+00:00"
}
```

## Phạm vi và giới hạn hiện tại

- Đây là đồ án học tập đang phát triển, chưa tuyên bố đạt chuẩn production.
- Chưa có benchmark tải lớn hoặc SLA công khai.
- Đối chiếu ảnh/OCR phụ thuộc kết quả từ dịch vụ AI bên ngoài.
- Tính năng thanh toán cần webhook và khóa PayOS hợp lệ để kiểm tra đầy đủ.
- Bộ test sẽ tiếp tục mở rộng sang Auth, Order concurrency, quyền Admin, Follow và Comment.

## Roadmap ưu tiên

- [x] Automated tests cho quy tắc voucher.
- [x] GitHub Actions build/test/publish.
- [x] Health probes cho deployment.
- [ ] Integration tests cho Auth và phân quyền Admin.
- [ ] Integration tests cho đặt hàng, tồn kho và webhook idempotency.
- [ ] Test SignalR cho chat và thông báo.
- [ ] Báo cáo coverage và kiểm thử tải.
- [ ] Video demo dự phòng 2–3 phút.

## Tác giả

Phát triển bởi **Nguyễn Hải Đăng** — [.NET Backend / Full-stack portfolio](https://github.com/HaiDang-Ng22).
