# Kiến trúc Zynk

## Tổng quan

```mermaid
flowchart LR
    Browser["Blog.Web\nHTML/CSS/JavaScript/PWA"] --> API["Blog.API\nREST + SignalR + JWT"]
    API --> Application["Blog.Application\nDTO + business services"]
    API --> Infrastructure["Blog.Infrastructure\nEF Core + repositories + integrations"]
    Application --> Domain["Blog.Domain\nentities + contracts"]
    Infrastructure --> Domain
    Infrastructure --> PostgreSQL[(PostgreSQL)]
    Infrastructure --> Cloudinary[Cloudinary]
    Infrastructure --> Gemini[Gemini API]
    Infrastructure --> Firebase[Firebase]
    API --> PayOS[PayOS]
```

## Trách nhiệm từng project

| Project | Trách nhiệm |
|---|---|
| `Blog.Domain` | Entity, enum và interface không phụ thuộc hạ tầng |
| `Blog.Application` | DTO và logic nghiệp vụ có thể kiểm thử độc lập |
| `Blog.Infrastructure` | EF Core, repository, PostgreSQL và dịch vụ bên ngoài |
| `Blog.API` | HTTP API, JWT, authorization, SignalR và composition root |
| `Blog.Web` | Giao diện người dùng, seller và admin |
| `Blog.Tests` | Automated tests cho nghiệp vụ quan trọng |

## Luồng đặt hàng

```mermaid
sequenceDiagram
    actor Buyer as Người mua
    participant Web as Blog.Web
    participant API as OrdersController
    participant Calc as VoucherCalculator
    participant DB as PostgreSQL
    participant Pay as PayOS

    Buyer->>Web: Xác nhận giỏ hàng
    Web->>API: POST /api/orders
    API->>DB: Kiểm tra sản phẩm, tồn kho và voucher
    API->>Calc: Tính giảm giá và phí vận chuyển
    Calc-->>API: ItemDiscount, ShippingDiscount, FinalTotal
    API->>DB: Lưu đơn hàng và cập nhật tồn kho
    opt Thanh toán PayOS
        API->>Pay: Tạo payment link/VietQR
        Pay-->>API: Checkout URL và mã giao dịch
    end
    API-->>Web: Đơn hàng đã tạo
```

## Luồng Admin AI tạo voucher

```mermaid
sequenceDiagram
    actor Admin
    participant AI as Admin AI Copilot
    participant API as AdminAiController
    participant Cache as Draft cache
    participant DB as PostgreSQL

    Admin->>AI: Yêu cầu N voucher và điều kiện
    AI->>API: Lập kế hoạch suggest_vouchers
    API-->>Admin: Hiển thị bản xem trước
    Admin->>API: Xác nhận lần 1
    API->>Cache: Chuẩn hóa và lưu draft 20 phút
    API-->>Admin: Hiển thị draft cuối
    Admin->>API: Xác nhận lần 2 kèm draft token
    API->>DB: Thêm voucher
    API->>Cache: Xóa draft token
    API-->>Admin: Hoàn tất
```

## Realtime

- `ChatHub`: tin nhắn 1-1 và trạng thái hội thoại.
- `NotificationHub`: thông báo tương tác và mua sắm.
- JWT của SignalR được đọc từ `access_token` trên đường dẫn hub được cho phép.

## Deployment probes

| Endpoint | Mục đích | Thành công | Thất bại |
|---|---|---:|---:|
| `/health/live` | API process đang chạy | 200 | Không kết nối được process |
| `/health/ready` | PostgreSQL sẵn sàng | 200 | 503 |

Readiness không trả chi tiết exception hoặc connection string ra client. Lỗi kết nối được ghi qua application logger.

## Nguyên tắc bảo mật

- Secret được nạp từ environment variables hoặc `appsettings.Local.json` đã ignore.
- API nhạy cảm dùng JWT và role authorization.
- Tác vụ Admin AI có thay đổi dữ liệu yêu cầu xác nhận.
- Draft voucher AI gắn với Admin hiện tại, hết hạn sau 20 phút và chỉ dùng một lần.
- File upload và AI endpoint có giới hạn kích thước/tần suất ở tầng API.
