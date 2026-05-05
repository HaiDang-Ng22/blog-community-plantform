// admin/admin-common.js

(function() {
    // 1. Mobile Block Logic
    function checkDevice() {
        if (window.innerWidth < 1024) {
            document.body.innerHTML = `
                <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; font-family: sans-serif;">
                    <i class="fa-solid fa-desktop" style="font-size: 4rem; color: #ef4444; margin-bottom: 1.5rem;"></i>
                    <h2 style="margin-bottom: 1rem;">Truy cập bị từ chối</h2>
                    <p style="color: #64748b; line-height: 1.6;">Hệ thống quản trị Zynk chỉ khả dụng trên máy tính để bàn (Desktop) để đảm bảo tính an toàn và trải nghiệm tốt nhất.</p>
                    <button onclick="window.location.href='../auth.html'" style="margin-top: 2rem; padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">Quay lại đăng nhập</button>
                </div>
            `;
            return false;
        }
        return true;
    }

    // 2. Auth Enforcement
    function checkAuth() {
        const token = localStorage.getItem('auth_token');
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        
        console.log("Admin Auth Check:", { hasToken: !!token, role: userInfo.role });

        if (!token || userInfo.role !== 'Admin') {
            console.warn("Unauthorized access to admin. Redirecting to auth.html");
            window.location.href = '../auth.html';
            return false;
        }
        return true;
    }

    if (!checkDevice()) return;
    if (!checkAuth()) return;

    // 3. Inject Sidebar
    window.addEventListener('DOMContentLoaded', () => {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const sidebarHtml = `
            <aside class="admin-sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">Z</div>
                    <span class="sidebar-title">Zynk Admin</span>
                </div>
                <nav class="sidebar-nav">
                    <a href="index.html" class="nav-item ${currentPage === 'index.html' ? 'active' : ''}">
                        <i class="fa-solid fa-chart-pie"></i> <span>Tổng quan</span>
                    </a>
                    <a href="users.html" class="nav-item ${currentPage === 'users.html' ? 'active' : ''}">
                        <i class="fa-solid fa-users"></i> <span>Quản lý Người dùng</span>
                    </a>
                    <a href="reports.html" class="nav-item ${currentPage === 'reports.html' ? 'active' : ''}" style="position: relative;">
                        <i class="fa-solid fa-flag"></i> <span>Báo cáo vi phạm</span>
                        <span id="badge-reports" class="admin-badge hidden">0</span>
                    </a>
                    <a href="shops.html" class="nav-item ${currentPage === 'shops.html' ? 'active' : ''}" style="position: relative;">
                        <i class="fa-solid fa-shop"></i> <span>Quản lý Cửa hàng</span>
                        <span id="badge-shops" class="admin-badge hidden">0</span>
                    </a>
                    <a href="categories.html" class="nav-item ${currentPage === 'categories.html' ? 'active' : ''}">
                        <i class="fa-solid fa-layer-group"></i> <span>Quản lý Danh mục</span>
                    </a>
                </nav>
                <div class="sidebar-footer">
                    <button onclick="adminLogout()" class="nav-item" style="background: none; border: none; width: 100%; color: #ef4444; cursor: pointer;">
                        <i class="fa-solid fa-right-from-bracket"></i> <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>
        `;
        document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
        updateAdminBadges();
        // Cập nhật mỗi 30 giây
        setInterval(updateAdminBadges, 30000);
    });

    window.updateAdminBadges = async function() {
        try {
            const stats = await window.adminApi.get('admin/stats');
            
            const reportsBadge = document.getElementById('badge-reports');
            if (reportsBadge) {
                if (stats.pendingReports > 0) {
                    reportsBadge.textContent = stats.pendingReports;
                    reportsBadge.classList.remove('hidden');
                } else {
                    reportsBadge.classList.add('hidden');
                }
            }

            const shopsBadge = document.getElementById('badge-shops');
            if (shopsBadge) {
                if (stats.pendingShops > 0) {
                    shopsBadge.textContent = stats.pendingShops;
                    shopsBadge.classList.remove('hidden');
                } else {
                    shopsBadge.classList.add('hidden');
                }
            }
        } catch (err) {
            console.error("Lỗi cập nhật badge:", err);
        }
    };

    window.adminLogout = function() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = '../auth.html';
    };

    window.adminApi = window.api;

    // --- Admin Modal System ---
    window.adminModal = {
        open(html) {
            let modal = document.getElementById('admin-global-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'admin-global-modal';
                modal.style.cssText = `
                    position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
                    display: flex; align-items: center; justify-content: center; 
                    z-index: 1000; backdrop-filter: blur(4px);
                `;
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="card" style="width: 90%; max-width: 600px; max-height: 90vh; overflow: auto; position: relative; animation: modalFade 0.3s ease;">
                    <button onclick="adminModal.close()" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8;">&times;</button>
                    ${html}
                </div>
            `;
            modal.style.display = 'flex';
        },
        close() {
            const modal = document.getElementById('admin-global-modal');
            if (modal) modal.style.display = 'none';
        }
    };

    // Add animation CSS
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes modalFade {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .admin-badge {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            background: #ef4444;
            color: white;
            font-size: 0.7rem;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 10px;
            min-width: 18px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
        }
        .admin-badge.hidden { display: none; }
    `;
    document.head.appendChild(style);

})();
