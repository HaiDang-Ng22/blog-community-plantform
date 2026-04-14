// Admin User Management Logic

async function loadAdminUsers() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải dữ liệu...</td></tr>';

    try {
        let users = await window.api.get('admin/users');
        // Logic: Hidden Admin account from user management list
        users = users.filter(u => u.role !== 'Admin' && u.Role !== 'Admin');
        
        list.innerHTML = '';

        if (users.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">Chưa có người dùng nào.</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random" class="mini-avatar" style="width:32px; height:32px; border-radius: 50%;">
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

async function deleteUserAccount(userId) {
    if (!confirm('BẠN CÓ CHẮC MUỐN XÓA TÀI KHOẢN NÀY VĨNH VIỄN?\nToàn bộ dữ liệu của người dùng này sẽ biến mất.')) return;

    try {
        const result = await window.api.delete(`admin/users/${userId}`);
        window.common.showToast(result.message, 'success');
        loadAdminUsers();
    } catch (error) {
        window.common.showToast('Lỗi: ' + error.message, 'error');
    }
}

// Global scope attachment if needed
window.loadAdminUsers = loadAdminUsers;
window.deleteUserAccount = deleteUserAccount;
