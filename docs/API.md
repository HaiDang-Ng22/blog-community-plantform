# API chính của Zynk

Swagger UI được bật trong môi trường Development tại `/swagger`. Tài liệu này cung cấp bản đồ nhanh; request/response chi tiết xem trực tiếp trong OpenAPI.

## Xác thực

| Nhóm | Route điển hình | Chức năng |
|---|---|---|
| Auth | `/api/auth/*` | Đăng ký, đăng nhập, OTP, Google OAuth, quên mật khẩu |
| Settings | `/api/settings/*` | Hồ sơ, bảo mật, quyền riêng tư và thông báo |

Header cho endpoint cần đăng nhập:

```http
Authorization: Bearer <access_token>
```

## Mạng xã hội

| Route | Chức năng |
|---|---|
| `/api/posts` | Feed, tạo, sửa và xóa bài viết |
| `/api/comments` | Bình luận và phản hồi |
| `/api/follows` | Theo dõi và bỏ theo dõi |
| `/api/notifications` | Danh sách và trạng thái thông báo |
| `/api/stories` | Story, lượt xem, reaction và reply |
| `/api/groups` | Nhóm, thành viên và yêu cầu tham gia |
| `/hubs/chat` | SignalR chat hub |
| `/hubs/notification` | SignalR notification hub |

## Marketplace

| Route | Chức năng |
|---|---|
| `/api/marketplace/*` | Sản phẩm, danh mục, shop và khám phá |
| `/api/orders` | Tạo và quản lý đơn hàng |
| `/api/orders/validate-voucher` | Kiểm tra voucher trước checkout |
| `/api/orders/my-vouchers` | Voucher người dùng đã lưu |
| `/api/seller/*` | Sản phẩm, đơn hàng, dashboard và voucher shop |
| `/api/auctions/*` | Đấu giá và đặt giá |

## Admin

Các route này yêu cầu role `Admin`.

| Route | Chức năng |
|---|---|
| `/api/admin/users` | Quản lý người dùng |
| `/api/admin/reports` | Báo cáo vi phạm |
| `/api/admin/categories` | Danh mục nhiều cấp |
| `/api/admin/shops` | Duyệt và quản lý shop |
| `/api/admin/vouchers` | Voucher toàn hệ thống |
| `/api/admin/ai/plan` | Admin AI lập kế hoạch |
| `/api/admin/ai/execute` | Thực thi action đã xác nhận |

## Health và OpenAPI

| Route | Auth | Chức năng |
|---|---|---|
| `/health/live` | Không | Liveness probe |
| `/health/ready` | Không | PostgreSQL readiness probe |
| `/swagger` | Development | Swagger UI |
| `/openapi/v1.json` | Development | OpenAPI document |

## Quy ước lỗi

API trả HTTP status phù hợp và JSON có trường `message` cho lỗi nghiệp vụ. Các mã thường gặp:

- `400`: dữ liệu hoặc điều kiện nghiệp vụ không hợp lệ.
- `401`: thiếu hoặc hết hạn token.
- `403`: không đủ role/quyền.
- `404`: không tìm thấy tài nguyên.
- `409`: xung đột hoặc dữ liệu đã tồn tại.
- `429`: vượt giới hạn gọi AI.
- `503`: dependency cần thiết chưa sẵn sàng.
