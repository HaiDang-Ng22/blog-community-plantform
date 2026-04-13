// js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const token = localStorage.getItem('auth_token');

    // Security Check: Only Admin can access this page
    if (!token || (userInfo.role !== 'Admin' && userInfo.Role !== 'Admin')) {
        alert('Bạn không có quyền truy cập trang này.');
        window.location.href = 'index.html';
        return;
    }

    // Initialize Dashboard
    await loadAdminUsers();
    await loadAdminReports();
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
    document.getElementById(`section-${tabName}`).classList.remove('hidden');

    // Refresh data if needed
    if (tabName === 'users') loadAdminUsers();
    if (tabName === 'reports') loadAdminReports();
    if (tabName === 'shops') loadAdminShopApps();
}

async function loadAdminUsers() {
    const list = document.getElementById('admin-users-list');
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải dữ liệu...</td></tr>';

    try {
        let users = await window.api.get('admin/users');
        // Logic: Ẩn tài khoản Admin khỏi danh sách quản lý người dùng
        users = users.filter(u => u.role !== 'Admin' && u.Role !== 'Admin');
        
        list.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random" class="mini-avatar" style="width:32px; height:32px;">
                        <div>
                            <div style="font-weight:600;">${user.fullName}</div>
                            <div style="font-size:0.8rem; color:#64748b;">@${user.username}</div>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td><span class="badge ${user.role === 'Admin' ? 'badge-admin' : 'badge-user'}">${user.role}</span></td>
                <td style="color:#64748b; font-size:0.85rem;">${new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                <td style="text-align:center; font-weight:600;">${user.postCount}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-action" title="Xem Profile" onclick="window.location.href='profile.html?id=${user.id}'"><i class="fa-solid fa-external-link"></i></button>
                        ${user.role !== 'Admin' ? `
                            <button class="btn-action danger" title="Xóa tài khoản" onclick="deleteUserAccount('${user.id}')"><i class="fa-solid fa-user-slash"></i></button>
                        ` : ''}
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (error) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi: ${error.message}</td></tr>`;
    }
}

let currentReports = [];

async function loadAdminReports() {
    const list = document.getElementById('admin-reports-list');
    const badge = document.getElementById('report-count-badge');
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const reports = await window.api.get('admin/reports');
        currentReports = reports;
        list.innerHTML = '';
        
        const pendingCount = reports.filter(r => !r.isResolved).length;
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (reports.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">Chưa có báo cáo vi phạm nào.</td></tr>';
            return;
        }

        reports.forEach(report => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${report.reporterName}</td>
                <td>
                    <div class="clickable-title" onclick="showPostPreview('${report.id}')" style="font-weight:600;">${report.postTitle || 'Bài viết đã bị xóa'}</div>
                    <div style="font-size:0.8rem; color:#64748b;">Tác giả: ${report.postAuthorName}</div>
                </td>
                <td style="color:#ef4444; font-weight:500;">${report.reason}</td>
                <td style="color:#64748b; font-size:0.85rem;">${new Date(report.createdAt).toLocaleString('vi-VN')}</td>
                <td><span class="badge ${report.isResolved ? 'badge-resolved' : 'badge-pending'}">${report.isResolved ? 'Đã xử lý' : 'Chờ xử lý'}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-action" title="Xem nội dung" onclick="showPostPreview('${report.id}')"><i class="fa-solid fa-eye"></i></button>
                        ${!report.isResolved ? `
                            <button class="btn-action" style="color: #10b981;" title="Đã xem" onclick="resolveReport('${report.id}')"><i class="fa-solid fa-check"></i></button>
                            ${report.postId ? `
                                <button class="btn-action danger" title="Xóa bài viết & Cảnh báo" onclick="deleteViolatingPost('${report.postId}', '${report.id}')"><i class="fa-solid fa-trash-can"></i></button>
                            ` : ''}
                        ` : '<i class="fa-solid fa-circle-check" style="color:#10b981; margin-left:10px; font-size: 1.2rem;"></i>'}
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (error) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải báo cáo: ${error.message}</td></tr>`;
    }
}

function showPostPreview(reportId) {
    const report = currentReports.find(r => r.id === reportId);
    if (!report) return;

    const modal = document.getElementById('post-preview-modal');
    const content = document.getElementById('post-preview-content');

    if (!report.postId) {
        content.innerHTML = '<div style="text-align:center; padding: 2rem; color: #64748b;">Bài viết này đã bị xóa hoặc không còn tồn tại.</div>';
    } else {
        content.innerHTML = `
            <div class="post-preview-header">
                <h1 class="post-preview-title">${report.postTitle}</h1>
                <div class="post-preview-meta">
                    <span><i class="fa-solid fa-user"></i> ${report.postAuthorName}</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-calendar"></i> ${new Date(report.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
            </div>
            ${report.postImageUrl ? `
                <img src="${report.postImageUrl}" class="post-preview-image" alt="Featured image">
            ` : ''}
            <div class="post-preview-body">
                ${report.postContent}
            </div>
        `;
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closePostPreview() {
    const modal = document.getElementById('post-preview-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
}

async function deleteUserAccount(userId) {
    if (!confirm('BẠN CÓ CHẮC MUỐN XÓA TÀI KHOẢN NÀY VĨNH VIỄN?\nToàn bộ dữ liệu của người dùng này sẽ biến mất.')) return;

    try {
        const result = await window.api.delete(`admin/users/${userId}`);
        alert(result.message);
        loadAdminUsers();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function deleteViolatingPost(postId, reportId) {
    if (!confirm('Xác nhận xóa bài viết này và gửi thông báo vi phạm đến người dùng?')) return;

    try {
        const result = await window.api.delete(`admin/posts/${postId}`);
        await window.api.post(`admin/reports/${reportId}/resolve`);
        alert(result.message);
        loadAdminReports();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function resolveReport(reportId) {
    try {
        await window.api.post(`admin/reports/${reportId}/resolve`);
        loadAdminReports();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function loadAdminShopApps() {
    const list = document.getElementById('admin-shops-list');
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const apps = await window.api.get('admin/shop-applications');
        list.innerHTML = '';

        if (!apps || apps.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Không có yêu cầu nào.</td></tr>';
            return;
        }

        apps.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.userName}</td>
                <td style="font-weight:600;">${app.shopName}</td>
                <td style="font-size:0.85rem; color:#64748b;">${app.description}</td>
                <td>${new Date(app.createdAt).toLocaleDateString()}</td>
                <td><span class="badge ${getStatusBadgeClass(app.status)}">${app.status === 1 ? 'Approved' : (app.status === 0 ? 'Pending' : 'Rejected')}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        ${app.status === 0 ? `
                            <button class="btn-action" style="color:#10b981; border-color:#10b981;" title="Duyệt" onclick="approveShop('${app.id}')"><i class="fa fa-check"></i></button>
                            <button class="btn-action danger" title="Từ chối" onclick="rejectShop('${app.id}')"><i class="fa fa-times"></i></button>
                        ` : (app.status === 1 ? '<i class="fa fa-check-double" style="color:#10b981;"></i>' : '<i class="fa fa-times-circle" style="color:#ef4444;"></i>')}
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải ứng dụng: ${e.message}</td></tr>`;
    }
}

async function approveShop(id) {
    if (!confirm('Xác nhận phê duyệt cửa hàng này?')) return;
    try {
        await window.api.post(`admin/shop-applications/${id}/approve`);
        alert('Đã phê duyệt!');
        loadAdminShopApps();
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

async function rejectShop(id) {
    const reason = prompt('Lý do từ chối:');
    if (reason === null) return;
    try {
        await window.api.post(`admin/shop-applications/${id}/reject`, { body: reason });
        alert('Đã từ chối.');
        loadAdminShopApps();
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

function getStatusBadgeClass(status) {
    if (status === 1 || status === 'Approved') return 'badge-resolved';
    if (status === 0 || status === 'Pending') return 'badge-pending';
    return 'badge-danger';
}
