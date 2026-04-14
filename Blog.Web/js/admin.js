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

    // Initialize Dashboard based on default tab (users)
    if (typeof loadAdminUsers === 'function') await loadAdminUsers();
    if (typeof loadAdminReports === 'function') await loadAdminReports();
});

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
    if (tabName === 'shops' && typeof loadAdminShopApps === 'function') loadAdminShopApps();
    if (tabName === 'categories' && typeof loadAdminCategories === 'function') loadAdminCategories();
}

window.switchAdminTab = switchAdminTab;
