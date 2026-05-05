// js/admin.js - Coordinator

document.addEventListener('DOMContentLoaded', async () => {
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const token = localStorage.getItem('auth_token');

    // Security Check: Only Admin can access this page
    if (!token || (userInfo.role !== 'Admin' && userInfo.Role !== 'Admin')) {
        alert('Bạn không có quyền truy cập trang này.');
        window.location.href = 'index.html';
        return;
    }

    // Initialize Dashboard based on default tab
    if (typeof loadAdminStats === 'function') await loadAdminStats();
    if (typeof loadAdminReports === 'function') await loadAdminReports();
});

window.loadAdminStats = loadAdminStats;

async function loadAdminStats() {
    try {
        const stats = await window.api.get('admin/stats');
        
        document.getElementById('stat-total-users').textContent = stats.totalUsers.toLocaleString();
        document.getElementById('stat-active-shops').textContent = stats.activeShops.toLocaleString();
        document.getElementById('stat-daily-orders').textContent = stats.dailyOrders.toLocaleString();
        document.getElementById('stat-pending-reports').textContent = stats.pendingReports.toLocaleString();
        
        // Render Top Shops
        const topShopsList = document.querySelector('#section-dashboard .admin-card:nth-child(2) div[style*="flex-direction: column"]');
        if (topShopsList && stats.topShops) {
            topShopsList.innerHTML = stats.topShops.map((shop, index) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: ${index === stats.topShops.length - 1 ? 'none' : '1px solid var(--border-color)'};">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: ${['#fbbf24', '#94a3b8', '#b45309', '#e2e8f0', '#f1f5f9'][index] || '#f1f5f9'}; color: ${index < 3 ? 'white' : 'var(--text-secondary)'}; display: flex; align-items: center; justify-content: center; font-weight: bold;">${index + 1}</div>
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${shop.shopName}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${shop.orderCount} đơn hàng</div>
                        </div>
                    </div>
                    <div style="font-weight: 700; color: #10b981;">${(shop.totalRevenue || 0).toLocaleString()} ₫</div>
                </div>
            `).join('');
            
            if (stats.topShops.length === 0) {
                topShopsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Chưa có dữ liệu doanh thu</p>';
            }
        }
    } catch (e) {
        console.error('Lỗi tải thống kê:', e);
    }
}

function switchAdminTab(tabName) {
    // Nav buttons
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    // Sections
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    const targetSection = document.getElementById(`section-${tabName}`);
    if (targetSection) targetSection.classList.remove('hidden');

    // Refresh data using modular functions
    if (tabName === 'users' && typeof loadAdminUsers === 'function') loadAdminUsers();
    if (tabName === 'reports' && typeof loadAdminReports === 'function') loadAdminReports();
    if (tabName === 'shops') {
        if (typeof loadAdminShopApps === 'function') loadAdminShopApps();
        if (typeof loadAdminActiveShops === 'function') loadAdminActiveShops();
    }
    if (tabName === 'categories' && typeof loadAdminCategories === 'function') loadAdminCategories();
}

window.switchAdminTab = switchAdminTab;
