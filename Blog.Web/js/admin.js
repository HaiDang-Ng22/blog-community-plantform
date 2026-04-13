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
}

async function loadAdminUsers() {
    const list = document.getElementById('admin-users-list');
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải dữ liệu...</td></tr>';

    try {
        const users = await window.api.get('admin/users');
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

async function loadAdminReports() {
    const list = document.getElementById('admin-reports-list');
    const badge = document.getElementById('report-count-badge');
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const reports = await window.api.get('admin/reports');
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
                    <div style="font-weight:600;">${report.postTitle || 'Bài viết đã bị xóa'}</div>
                    <div style="font-size:0.8rem; color:#64748b;">Tác giả: ${report.postAuthorName}</div>
                </td>
                <td style="color:#ef4444; font-weight:500;">${report.reason}</td>
                <td style="color:#64748b; font-size:0.85rem;">${new Date(report.createdAt).toLocaleString('vi-VN')}</td>
                <td><span class="badge ${report.isResolved ? 'badge-resolved' : 'badge-pending'}">${report.isResolved ? 'Đã xử lý' : 'Chờ xử lý'}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        ${!report.isResolved ? `
                            <button class="btn-action" title="Đã xem" onclick="resolveReport('${report.id}')"><i class="fa-solid fa-check"></i></button>
                            ${report.postId ? `
                                <button class="btn-action danger" title="Xóa bài viết & Cảnh báo" onclick="deleteViolatingPost('${report.postId}', '${report.id}')"><i class="fa-solid fa-trash-can"></i></button>
                            ` : ''}
                        ` : '<i class="fa-solid fa-circle-check" style="color:#10b981; margin-left: 10px;"></i>'}
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (error) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải báo cáo: ${error.message}</td></tr>`;
    }
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
