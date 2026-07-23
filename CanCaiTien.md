Yêu cầu kỹ thuật:

Debounce khoảng 300–500 ms.
Chỉ tìm khi có từ 2 ký tự trở lên.
Hủy request cũ nếu người dùng tiếp tục nhập.
Có trạng thái loading dạng skeleton.
Không gửi API sau mỗi phím bấm một cách liên tục.
2.3. Lịch sử tìm kiếm

Cần có:

Các từ khóa đã tìm gần đây.
Xóa từng từ khóa.
Xóa toàn bộ lịch sử.
Đồng bộ lịch sử theo tài khoản.
Với người chưa đăng nhập có thể lưu bằng localStorage.

Ví dụ:

Tìm kiếm gần đây
Nguyễn Văn A                    ×
ASP.NET Core                    ×
#dulich                         ×

Xóa tất cả
2.4. Tìm kiếm phổ biến

Khi ô tìm kiếm chưa có nội dung, nên hiển thị:

Từ khóa đang thịnh hành.
Hashtag nổi bật.
Sản phẩm được tìm nhiều.
Cộng đồng đang phát triển.
Người dùng nổi bật.

Không nên để trang tìm kiếm trống trước khi người dùng nhập.

2.5. Tìm kiếm không dấu và sửa lỗi chính tả

Hệ thống cần nhận được những trường hợp như:

cong nghe thong tin
công nghệ thông tin
cong ngệ thông tin

và trả về kết quả gần giống nhau.

Nên bổ sung:

Chuẩn hóa chữ hoa/chữ thường.
Chuẩn hóa tiếng Việt có dấu và không dấu.
Xử lý khoảng trắng thừa.
Tìm gần đúng.
Gợi ý “Có phải bạn muốn tìm…”.
Hỗ trợ từ đồng nghĩa.
2.6. Bộ lọc tìm kiếm nâng cao
Với bài viết
Mới nhất.
Nhiều lượt thích.
Nhiều bình luận.
Có hình ảnh.
Có video.
Người đang theo dõi.
Theo khoảng thời gian.
Theo hashtag.
Với người dùng
Đang theo dõi.
Người theo dõi bạn.
Có bạn chung.
Có tích xanh.
Gần vị trí.
Tài khoản cá nhân hoặc cửa hàng.
Với sản phẩm
Khoảng giá.
Danh mục.
Đánh giá.
Đã bán.
Còn hàng.
Shop uy tín.
Giao hàng nhanh.
Mới nhất hoặc bán chạy.
Với Reels
Mới nhất.
Phổ biến.
Theo hashtag.
Theo âm thanh.
Theo người đăng.
2.7. Tìm kiếm Hashtag

README cho biết dự án đã tự động nhận diện hashtag trong bài viết và bình luận. Vì vậy, tìm kiếm hashtag nên được tách thành chức năng rõ ràng.

Trang hashtag cần hiển thị:

#laptrinh
12.500 bài viết
1.200 reels

[Theo dõi hashtag]

Bên dưới gồm:

Bài viết nổi bật.
Bài viết mới.
Reels.
Người dùng thường đăng hashtag đó.
Hashtag liên quan.
2.8. Tìm kiếm cộng đồng

Repository đã có groups.html và group-detail.html, nhưng phần tìm kiếm hiện chưa có khu vực Cộng đồng.

Cần tìm theo:

Tên cộng đồng.
Mô tả.
Chủ đề.
Quyền riêng tư.
Số thành viên.
Mức độ hoạt động.

Kết quả nên có nút:

Tham gia
Đã tham gia
Yêu cầu tham gia
2.9. Tìm kiếm cửa hàng

Hiện có kết quả sản phẩm nhưng nên bổ sung riêng loại Cửa hàng.

Một kết quả cửa hàng nên có:

Logo.
Tên shop.
Tích xác minh.
Điểm đánh giá.
Số người theo dõi.
Số sản phẩm.
Tỷ lệ phản hồi.
Nút Theo dõi.
Nút Xem cửa hàng.
2.10. Sắp xếp kết quả hợp lý

Không nên chỉ dùng:

WHERE Name LIKE '%keyword%'

Nên tính điểm xếp hạng:

SearchScore =
    TextMatchScore
  + FollowRelationshipScore
  + EngagementScore
  + FreshnessScore
  + UserPreferenceScore
  + VerificationScore

Ví dụ:

Trùng chính xác tên: điểm cao nhất.
Bắt đầu bằng từ khóa: điểm cao.
Người dùng đang theo dõi: cộng điểm.
Nội dung mới: cộng điểm.
Bài viết có tương tác tốt: cộng điểm.
Nội dung phù hợp sở thích: cộng điểm.
Nội dung bị báo cáo nhiều: trừ điểm.
2.11. Phân trang

Không nên tải toàn bộ kết quả cùng lúc.

Nên áp dụng:

10–20 kết quả mỗi lần.
Infinite scroll hoặc nút “Xem thêm”.
Cursor pagination cho bài viết/Reels.
Không tải lại các kết quả đã có.
Giữ nguyên vị trí cuộn khi quay lại trang.
2.12. Trạng thái không có kết quả

Không nên chỉ hiển thị:

Không tìm thấy kết quả

Nên hiển thị:

Không tìm thấy kết quả cho “laptoop”

Có phải bạn muốn tìm “laptop”?

Gợi ý:
- Kiểm tra lại chính tả
- Thử từ khóa ngắn hơn
- Tìm theo hashtag
- Xem nội dung đang thịnh hành
2.13. Theo dõi chất lượng tìm kiếm

Nên lưu thống kê:

Từ khóa được tìm nhiều nhất.
Từ khóa không có kết quả.
Kết quả nào được nhấn.
Người dùng tìm rồi có theo dõi hay không.
Người dùng tìm sản phẩm rồi có mua hay không.
Thời gian phản hồi API.
Tỷ lệ người dùng tìm lại bằng từ khóa khác.

Phần này giúp cải thiện AI Search và thuật toán xếp hạng.

2.14. Một số vấn đề giao diện trong search.html

File search.html hiện có khá nhiều style viết trực tiếp bằng style="", chẳng hạn khu vực thanh tìm kiếm và nút AI. Nên chuyển toàn bộ sang search.css để:

Dễ bảo trì.
Đồng bộ Dark Mode.
Dễ responsive.
Tránh lặp style.
Dễ thay đổi giao diện toàn hệ thống.

Placeholder hiện ghi “Tìm kiếm bài viết, người dùng...” nhưng kết quả còn có sản phẩm. Nên đổi thành:

Tìm người dùng, bài viết, reels, hashtag, sản phẩm...
3. Nhận xét tất cả chức năng trên thanh menu
3.1. Trang chủ

README cho biết dự án đã có thuật toán FYP xếp hạng theo tương tác, độ mới, tag yêu thích và yếu tố ngẫu nhiên.

Trang chủ nên bổ sung:

Tab “Dành cho bạn”.
Tab “Đang theo dõi”.
Tab “Mới nhất”.
Tab bài viết và Reels.
Ẩn bài viết không quan tâm.
Báo nội dung lặp lại.
Không đề xuất tài khoản này.
Lưu bài viết vào bộ sưu tập.
Chia sẻ qua tin nhắn.
Ghim bài viết.
Tải bài từng phần thay vì tải toàn bộ.
Skeleton loading.
Gợi ý người dùng và cộng đồng phù hợp.

Ưu tiên: tránh để thuật toán chỉ dựa nhiều vào lượt thích, vì tài khoản lớn sẽ luôn chiếm trang chủ.

3.2. Reels

Repository đã có reels.html, và README mô tả Reels cuộn dọc.

Cần bổ sung:

Tự động phát và dừng khi chuyển video.
Tắt/mở âm thanh.
Thanh tiến trình.
Like, bình luận, lưu, chia sẻ.
Theo dõi nhanh người đăng.
Xem sản phẩm được gắn trong video.
Xem âm thanh và các video dùng cùng âm thanh.
Không quan tâm.
Báo cáo video.
Giới hạn tải trước 1–2 video.
Điều chỉnh chất lượng theo tốc độ mạng.
Tiếp tục xem tại vị trí cũ.
Lịch sử video đã xem.
Chú thích tự động hoặc phụ đề.
Không tự động phát khi bật chế độ tiết kiệm dữ liệu.

Phần tạo Reels cần:

Cắt video.
Chọn ảnh bìa.
Thêm âm thanh.
Thêm chữ.
Gắn hashtag.
Gắn sản phẩm.
Chọn quyền riêng tư.
Lưu bản nháp.
Kiểm tra kích thước và định dạng video.
3.3. Khám phá

Khám phá không nên chỉ là một bản sao của Trang chủ.

Nên gồm:

Hashtag thịnh hành.
Chủ đề quan tâm.
Reels nổi bật.
Bài viết nổi bật.
Người sáng tạo mới.
Cộng đồng đề xuất.
Sản phẩm đang nổi.
Shop đề xuất.
Danh mục nội dung.
Nội dung theo vị trí nếu người dùng cho phép.

Có thể chia giao diện:

Dành cho bạn | Thịnh hành | Mới | Gần bạn | Mua sắm

Cần bảo đảm Trang chủ là nội dung cá nhân hóa, còn Khám phá là nơi tìm những nội dung và người dùng mới.

3.4. Cộng đồng

Repository đã có trang danh sách cộng đồng và trang chi tiết cộng đồng.

Cần hoàn thiện:

Tạo cộng đồng.
Cộng đồng công khai/riêng tư.
Yêu cầu tham gia.
Vai trò Chủ nhóm, Quản trị viên, Kiểm duyệt viên, Thành viên.
Nội quy cộng đồng.
Ghim bài viết.
Duyệt bài trước khi đăng.
Mời thành viên.
Tìm kiếm trong cộng đồng.
Báo cáo bài viết hoặc thành viên.
Tắt thông báo cộng đồng.
Rời nhóm.
Chặn thành viên.
Nhật ký hoạt động quản trị.
Thống kê số bài viết và thành viên hoạt động.
Huy hiệu thành viên tích cực.
Sự kiện cộng đồng.
Khảo sát trong cộng đồng.
3.5. Thông báo

Dự án đã có thông báo thời gian thực và trang notifications.html.

Cần bổ sung:

Phân loại Tất cả, Chưa đọc, Tương tác, Theo dõi, Tin nhắn, Đơn hàng, Hệ thống.
Đánh dấu từng thông báo đã đọc.
Đánh dấu tất cả đã đọc.
Xóa thông báo.
Tắt loại thông báo.
Điều hướng đúng đến bài viết, bình luận hoặc đơn hàng.
Gộp thông báo giống nhau.

Ví dụ:

Nguyễn A và 12 người khác đã thích bài viết của bạn

thay vì tạo 13 thông báo riêng.

Badge phải được đồng bộ giữa:

Sidebar.
Trang thông báo.
Tiêu đề trình duyệt.
Thiết bị khác.
Mobile/PWA.

Ngoài ra cần tránh mất badge khi SignalR bị ngắt bằng cách lấy lại số lượng chưa đọc từ API sau khi kết nối lại.

3.6. Tin nhắn

README cho biết hệ thống đã có chat 1-1 qua SignalR và trạng thái tin nhắn.

Cần bổ sung:

Trạng thái Đã gửi, Đã nhận, Đã xem.
Đang nhập.
Online hoặc hoạt động gần đây.
Gửi nhiều ảnh.
Gửi video và tài liệu.
Trả lời một tin nhắn.
Thả cảm xúc.
Thu hồi tin nhắn.
Chỉnh sửa tin nhắn.
Ghim tin nhắn.
Tìm kiếm trong cuộc trò chuyện.
Chặn người dùng.
Báo cáo.
Tắt thông báo cuộc trò chuyện.
Gửi bài viết, Reels và sản phẩm.
Danh sách tin nhắn chưa đọc.
Phân trang lịch sử tin nhắn.
Chống gửi trùng khi mạng chập chờn.
Tự kết nối lại SignalR.
Lưu tin nhắn tạm khi chưa gửi được.
Hỗ trợ nhóm chat sau này.

Không nên tải toàn bộ lịch sử hội thoại một lần; nên lấy khoảng 20–30 tin nhắn và tải thêm khi cuộn lên.

3.7. Tạo

Nút Tạo nên mở một menu lựa chọn thay vì luôn chuyển thẳng sang một trang:

Tạo bài viết
Tạo Reels
Tạo Story
Tạo khảo sát
Tạo cộng đồng
Tạo sản phẩm
Bắt đầu livestream

Trang tạo bài viết nên có:

Bài viết văn bản.
Nhiều ảnh.
Video.
Hashtag.
Nhắc tên người dùng.
Vị trí.
Cảm xúc/hoạt động.
Poll.
Gắn sản phẩm.
Chọn cộng đồng.
Chọn quyền riêng tư.
Cho phép/tắt bình luận.
Ẩn số lượt thích.
Lưu bản nháp.
Lên lịch đăng.
Xem trước bài viết.
Cảnh báo khi thoát mà chưa lưu.

Dự án đã có create-post.html, nhưng nên dùng nút Tạo làm trung tâm cho tất cả loại nội dung.

3.8. Trang cá nhân

Repository đã có profile.html, trong khi README cho biết trang cá nhân hỗ trợ bài viết, bộ sưu tập và thông tin cá nhân.

Cần bổ sung:

Ảnh đại diện.
Ảnh bìa.
Tiểu sử.
Liên kết cá nhân.
Người theo dõi/đang theo dõi.
Tab Bài viết.
Tab Reels.
Tab Được gắn thẻ.
Tab Đã lưu, chỉ chủ tài khoản thấy.
Tab Sản phẩm nếu là seller.
Bài viết đã ghim.
Chỉnh sửa hồ sơ.
Chia sẻ trang cá nhân.
Mã QR trang cá nhân.
Chặn/báo cáo.
Tài khoản riêng tư.
Duyệt yêu cầu theo dõi.
Ẩn danh sách người theo dõi nếu cần.
Dashboard thống kê dành cho creator.
Trạng thái tích xanh.
Huy hiệu shop hoặc creator.

Cần kiểm tra phân quyền để người dùng khác không thể truy cập dữ liệu riêng chỉ bằng cách thay ID trên URL.

3.9. Xem thêm

Nút này nên mở menu gồm:

Đã lưu
Đơn hàng của tôi
Giỏ hàng
Marketplace
Cộng đồng của tôi
Cài đặt
Chế độ tối
Ngôn ngữ
Trợ giúp
Báo cáo sự cố
Đăng xuất

Với tài khoản người bán:

Kênh người bán
Đơn hàng Shop
Tin nhắn Shop
Mã giảm giá
Thống kê doanh thu

Với Admin:

Trang quản trị
Duyệt báo cáo
Duyệt Shop
Duyệt tích xanh

Không nên hiển thị chức năng không đúng vai trò.

4. Những điểm cần sửa chung cho Sidebar
Trạng thái đang chọn

Mục đang mở cần có:

Icon đậm hoặc đổi màu.
Chữ đậm.
Nền nhẹ.
aria-current="page".

Ví dụ khi đang ở Tìm kiếm, mục Tìm kiếm phải nổi bật.

Badge

Trong ảnh, badge Thông báo đang nằm khá xa mục Thông báo. Nên đặt badge sát bên phải của chính hàng menu và giữ vị trí ổn định.

Cần có badge riêng cho:

Thông báo.
Tin nhắn.
Đơn hàng seller.
Báo cáo admin.

Khi số lượng lớn:

9
99+
Responsive

Desktop:

Sidebar cố định.
Có thể thu gọn chỉ còn icon.

Tablet:

Sidebar dạng icon.
Tooltip khi rê chuột.

Mobile:

Thanh menu dưới cùng gồm Trang chủ, Khám phá, Tạo, Reels, Trang cá nhân.
Thông báo, Tin nhắn, Cộng đồng đưa vào menu phụ.
Accessibility

Cần bổ sung:

aria-label cho icon.
Điều hướng bằng bàn phím.
Focus rõ ràng.
Màu có độ tương phản tốt.
Tooltip khi sidebar thu gọn.
Không chỉ dùng màu để biểu thị trạng thái.
Hỗ trợ giảm chuyển động bằng prefers-reduced-motion.
5. Các chức năng còn thiếu nên thêm vào Sidebar

Tôi đề xuất cấu trúc cuối cùng:

Trang chủ
Reels
Tìm kiếm
Khám phá
Cộng đồng
Marketplace
Thông báo
Tin nhắn
Tạo
Trang cá nhân
Xem thêm

Marketplace nên có mục riêng vì dự án của bạn không chỉ là mạng xã hội mà còn là nền tảng thương mại điện tử. README mô tả khá nhiều chức năng như Marketplace, Seller Center, giỏ hàng, đơn hàng và VietQR, nhưng thanh menu trong ảnh chưa làm nổi bật phần mua sắm.

Có thể thay đổi theo vai trò:

User
Marketplace
Giỏ hàng
Đơn hàng của tôi
Seller
Kênh người bán
Quản lý sản phẩm
Đơn hàng Shop
Thống kê
Admin
Quản trị
Báo cáo vi phạm
Duyệt Shop
Duyệt tích xanh
6. Thứ tự ưu tiên triển khai
Mức 1 — Cần làm trước
Hoàn thiện tìm kiếm theo tab.
Gợi ý khi nhập và lịch sử tìm kiếm.
Tìm kiếm hashtag, Reels, cộng đồng và cửa hàng.
Phân trang kết quả.
Sửa badge Thông báo và Tin nhắn.
Tự kết nối lại SignalR.
Kiểm tra phân quyền trang cá nhân và tin nhắn.
Responsive sidebar trên mobile.
Mức 2 — Nâng chất lượng đồ án
Bộ lọc tìm kiếm.
Sửa lỗi chính tả và tìm không dấu.
Xếp hạng kết quả.
Gộp thông báo.
Trạng thái đã gửi/đã xem của tin nhắn.
Menu Tạo nhiều loại nội dung.
Marketplace trên sidebar.
Lưu bản nháp bài viết và Reels.
Mức 3 — Tạo điểm nổi bật khi bảo vệ đồ án
Thống kê từ khóa tìm kiếm.
Cá nhân hóa kết quả tìm kiếm.
Tìm kiếm bằng câu tự nhiên.
Giải thích lý do AI đề xuất.
Tìm kiếm bằng hình ảnh sản phẩm.
Tìm kiếm bằng giọng nói.
Gắn sản phẩm vào bài viết và Reels.
Dashboard Creator.
Tìm nội dung theo vị trí.
PWA và push notification.