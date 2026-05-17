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
                </div>
            </aside>
        `;

        document.body.insertAdjacentHTML('afterbegin', sidebarHtml);

        // Add padding to main container if it doesn't have it
        const main = document.querySelector('.seller-main');
        if (main) {
            main.style.marginLeft = '260px';
            main.style.width = 'calc(100% - 260px)';
        }
    }

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
