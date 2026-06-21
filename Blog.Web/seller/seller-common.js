/* seller/seller-common.js */
(function () {
    // 1. Auth Enforcement & Shop Status Check
    async function checkAuthAndShopStatus() {
        const token = localStorage.getItem('auth_token');
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        const path = window.location.pathname.toLowerCase();

        if (!token) {
            window.location.href = '../auth.html';
            return false;
        }

        // Admin cannot register as seller
        if (userInfo.role === 'Admin' || userInfo.Role === 'Admin') {
            document.body.innerHTML = `
                <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; font-family: sans-serif; background: #f8fafc;">
                    <i class="fa-solid fa-user-shield" style="font-size: 4rem; color: #6366f1; margin-bottom: 1.5rem;"></i>
                    <h2 style="margin-bottom: 1rem; font-weight: 700; color: #1e293b;">Bạn đang là Admin</h2>
                    <p style="color: #64748b; line-height: 1.6; max-width: 480px; margin: 0 auto 2rem;">Tài khoản quản trị viên của Zynk không cần đăng ký kênh người bán. Vui lòng truy cập trang Quản Trị để quản lý toàn bộ hệ thống.</p>
                    <a href="../admin/index.html" style="padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; text-decoration: none; font-weight: 600; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);">Đến Trang Quản Trị</a>
                </div>
            `;
            return false;
        }

        // Avoid infinite redirect loops
        const isRegisterPage = path.includes('register.html');
        const isPendingPage = path.includes('pending.html');

        try {
            // Check active shop status
            const shop = await window.api.get('seller/my-shop').catch(() => null);

            if (shop) {
                localStorage.setItem('seller_shop_info', JSON.stringify(shop));
                // If on register or pending page, redirect to seller home
                if (isRegisterPage || isPendingPage) {
                    window.location.href = 'index.html';
                    return false;
                }
                return true;
            }

            // No active shop, check application status
            const app = await window.api.get('seller/application-status').catch(() => null);

            if (!app) {
                if (!isRegisterPage) {
                    window.location.href = 'register.html';
                    return false;
                }
            } else if (app.status === 'Pending' || app.Status === 'Pending') {
                if (!isPendingPage) {
                    window.location.href = 'pending.html';
                    return false;
                }
            } else if (app.status === 'Rejected' || app.Status === 'Rejected') {
                if (!isRegisterPage) {
                    localStorage.setItem('seller_reject_note', app.adminNote || 'Hồ sơ của bạn bị từ chối.');
                    window.location.href = 'register.html';
                    return false;
                }
            } else {
                if (!isRegisterPage) {
                    window.location.href = 'register.html';
                    return false;
                }
            }
        } catch (err) {
            console.error("Seller authorization error:", err);
        }
        return true;
    }

    // 2. Inject Sidebar Menu
    function injectSidebar() {
        const path = window.location.pathname.toLowerCase();
        const isRegisterPage = path.includes('register.html');
        const isPendingPage = path.includes('pending.html');

        // Only inject sidebar on main functional pages
        if (isRegisterPage || isPendingPage) return;

        const currentPage = path.split('/').pop() || 'index.html';
        const shop = JSON.parse(localStorage.getItem('seller_shop_info') || '{}');

        const sidebarHtml = `
            <aside class="seller-sidebar">
                <div class="seller-brand">
                    <div class="seller-logo-icon"><i class="fa-solid fa-store"></i></div>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <span class="seller-logo-text">${shop.name || 'Cửa hàng của tôi'}</span>
                        <span class="seller-brand-badge">Kênh Người Bán</span>
                    </div>
                </div>
                
                <ul class="sidebar-menu">
                    <li class="menu-item ${currentPage === 'index.html' ? 'active' : ''}">
                        <a href="index.html">
                            <i class="fa-solid fa-chart-pie"></i> <span>Tổng quan</span>
                        </a>
                    </li>
                    <li class="menu-item ${currentPage === 'products.html' ? 'active' : ''}">
                        <a href="products.html">
                            <i class="fa-solid fa-box"></i> <span>Sản phẩm</span>
                        </a>
                    </li>
                    <li class="menu-item ${currentPage === 'orders.html' ? 'active' : ''}">
                        <a href="orders.html">
                            <i class="fa-solid fa-clipboard-list"></i> <span>Đơn hàng</span>
                        </a>
                    </li>
                    <li class="menu-item ${currentPage === 'vouchers.html' ? 'active' : ''}">
                        <a href="vouchers.html">
                            <i class="fa-solid fa-ticket"></i> <span>Khuyến mãi</span>
                        </a>
                    </li>
                    <li class="menu-item ${currentPage === 'messages.html' ? 'active' : ''}">
                        <a href="messages.html">
                            <i class="fa-solid fa-comments"></i> <span>Tin nhắn Shop</span>
                        </a>
                    </li>
                    <li class="menu-item ${currentPage === 'payment.html' ? 'active' : ''}">
                        <a href="payment.html">
                            <i class="fa-solid fa-qrcode"></i> <span>Thanh toán VietQR</span>
                        </a>
                    </li>
                    <li class="menu-item ${currentPage === 'terms.html' ? 'active' : ''}">
                        <a href="terms.html">
                            <i class="fa-solid fa-file-contract"></i> <span>Điều khoản & Chiết khấu</span>
                        </a>
                    </li>
                </ul>

                <div class="menu-footer">
                    <div class="menu-footer-item">
                        <a href="../index.html">
                            <i class="fa-solid fa-house"></i> <span>Về trang chủ</span>
                        </a>
                    </div>
                    <div class="menu-footer-item menu-footer-danger" onclick="openDeleteShopModal()" id="btn-delete-shop-sidebar">
                        <i class="fa-solid fa-store-slash"></i> <span>Hủy cửa hàng</span>
                    </div>
                </div>
            </aside>

            <!-- Delete Shop Confirmation Modal -->
            <div id="delete-shop-overlay" style="
                display:none; position:fixed; inset:0; z-index:9999;
                background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);
                align-items:center; justify-content:center; padding:1rem;
            ">
                <div style="
                    background:#0f172a; border:1px solid rgba(239,68,68,0.3);
                    border-radius:20px; padding:2.5rem; max-width:480px; width:100%;
                    box-shadow:0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.15);
                    animation: slideUp 0.3s ease;
                ">
                    <div style="text-align:center; margin-bottom:1.5rem;">
                        <div style="
                            width:72px; height:72px; background:rgba(239,68,68,0.15);
                            border:2px solid rgba(239,68,68,0.4); border-radius:50%;
                            display:flex; align-items:center; justify-content:center;
                            margin:0 auto 1.25rem; font-size:1.8rem; color:#ef4444;
                        ">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h2 style="color:#fff; font-size:1.4rem; font-weight:700; margin-bottom:0.5rem;">
                            Hủy cửa hàng vĩnh viễn
                        </h2>
                        <p style="color:#94a3b8; font-size:0.9rem; line-height:1.6;">
                            Hành động này <strong style="color:#ef4444;">không thể hoàn tác</strong>. Toàn bộ dữ liệu bên dưới sẽ bị xóa khỏi hệ thống:
                        </p>
                    </div>

                    <div style="
                        background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2);
                        border-radius:12px; padding:1rem 1.25rem; margin-bottom:1.5rem;
                    ">
                        <ul style="list-style:none; color:#fca5a5; font-size:0.875rem; line-height:2;">
                            <li><i class="fa-solid fa-box" style="width:18px;"></i> Tất cả sản phẩm &amp; biến thể</li>
                            <li><i class="fa-solid fa-star" style="width:18px;"></i> Đánh giá sản phẩm</li>
                            <li><i class="fa-solid fa-ticket" style="width:18px;"></i> Mã giảm giá của cửa hàng</li>
                            <li><i class="fa-solid fa-comments" style="width:18px;"></i> Lịch sử tin nhắn khách hàng</li>
                            <li><i class="fa-solid fa-clipboard-list" style="width:18px;"></i> Đơn hàng chưa hoàn thành</li>
                            <li><i class="fa-solid fa-file-contract" style="width:18px;"></i> Hồ sơ đăng ký người bán</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:1.5rem;">
                        <label style="color:#94a3b8; font-size:0.8rem; font-weight:600; display:block; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">
                            Nhập tên cửa hàng để xác nhận
                        </label>
                        <input id="delete-shop-confirm-input" type="text" placeholder="Nhập chính xác tên cửa hàng..." style="
                            width:100%; padding:0.75rem 1rem; background:#1e293b;
                            border:1px solid rgba(239,68,68,0.3); border-radius:10px;
                            color:#fff; font-size:0.95rem; outline:none;
                            transition:border-color 0.2s;
                        " oninput="checkDeleteConfirm()" />
                        <div id="delete-shop-name-hint" style="color:#64748b; font-size:0.78rem; margin-top:0.4rem;"></div>
                    </div>

                    <div style="display:flex; gap:0.75rem;">
                        <button onclick="closeDeleteShopModal()" style="
                            flex:1; padding:0.85rem; background:#1e293b; color:#94a3b8;
                            border:1px solid #334155; border-radius:10px; cursor:pointer;
                            font-size:0.95rem; font-weight:600; transition:all 0.2s;
                        " onmouseenter="this.style.background='#334155'" onmouseleave="this.style.background='#1e293b'">
                            Hủy bỏ
                        </button>
                        <button id="btn-confirm-delete-shop" onclick="confirmDeleteShop()" disabled style="
                            flex:1; padding:0.85rem; background:#7f1d1d; color:#fca5a5;
                            border:1px solid rgba(239,68,68,0.4); border-radius:10px;
                            cursor:not-allowed; font-size:0.95rem; font-weight:700;
                            transition:all 0.2s; opacity:0.5;
                        ">
                            <i class="fa-solid fa-store-slash"></i> Xóa vĩnh viễn
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('afterbegin', sidebarHtml);

        // Add padding to main container if it doesn't have it
        const main = document.querySelector('.seller-main');
        if (main) {
            main.style.marginLeft = '260px';
            main.style.width = 'calc(100% - 260px)';
        }
    }

    // ===== Delete Shop Modal Logic =====
    window.openDeleteShopModal = function () {
        const overlay = document.getElementById('delete-shop-overlay');
        const shop = JSON.parse(localStorage.getItem('seller_shop_info') || '{}');
        const hint = document.getElementById('delete-shop-name-hint');
        if (hint) hint.textContent = `Tên cửa hàng: "${shop.name || ''}"`;
        document.getElementById('delete-shop-confirm-input').value = '';
        document.getElementById('btn-confirm-delete-shop').disabled = true;
        document.getElementById('btn-confirm-delete-shop').style.opacity = '0.5';
        document.getElementById('btn-confirm-delete-shop').style.cursor = 'not-allowed';
        overlay.style.display = 'flex';
    };

    window.closeDeleteShopModal = function () {
        document.getElementById('delete-shop-overlay').style.display = 'none';
    };

    window.checkDeleteConfirm = function () {
        const shop = JSON.parse(localStorage.getItem('seller_shop_info') || '{}');
        const inputVal = document.getElementById('delete-shop-confirm-input').value.trim();
        const btn = document.getElementById('btn-confirm-delete-shop');
        const matches = inputVal === (shop.name || '').trim();
        btn.disabled = !matches;
        btn.style.opacity = matches ? '1' : '0.5';
        btn.style.cursor = matches ? 'pointer' : 'not-allowed';
        btn.style.background = matches ? '#dc2626' : '#7f1d1d';
        btn.style.color = matches ? '#fff' : '#fca5a5';
    };

    window.confirmDeleteShop = async function () {
        const btn = document.getElementById('btn-confirm-delete-shop');
        if (btn.disabled) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa...';
        try {
            await window.api.delete('seller/my-shop');
            localStorage.removeItem('seller_shop_info');
            document.getElementById('delete-shop-overlay').style.display = 'none';
            // Show success then redirect to register page
            document.body.insertAdjacentHTML('beforeend', `
                <div id="shop-deleted-toast" style="
                    position:fixed; bottom:2rem; left:50%; transform:translateX(-50%);
                    background:#10b981; color:#fff; padding:1rem 2rem; border-radius:12px;
                    font-weight:600; font-size:1rem; z-index:99999;
                    box-shadow:0 8px 24px rgba(16,185,129,0.4);
                    animation:slideUp 0.3s ease;
                ">
                    <i class="fa-solid fa-check-circle"></i> Cửa hàng đã được hủy thành công!
                </div>
            `);
            setTimeout(() => { window.location.href = 'register.html'; }, 2000);
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-store-slash"></i> Xóa vĩnh viễn';
            alert('Lỗi: ' + (err.message || 'Không thể xóa cửa hàng. Vui lòng thử lại.'));
        }
    };

    // Initialize Checks
    window.api = window.parent.api || window.api; // Reuse parent API if inside iframe, otherwise standard api
    
    document.addEventListener('DOMContentLoaded', async () => {
        const authorized = await checkAuthAndShopStatus();
        if (authorized) {
            injectSidebar();
            if (typeof initPage === 'function') {
                initPage();
            }
        }
    });

    // Formatting utilities
    window.formatCurrency = function (val) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };

})();
