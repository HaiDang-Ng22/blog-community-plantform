// Admin Shop Management Logic

async function loadAdminShopApps() {
    const list = document.getElementById('admin-shops-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const apps = await window.api.get('admin/shop-applications');
        list.innerHTML = '';

        if (!apps || apps.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">Không có yêu cầu nào.</td></tr>';
            return;
        }

        apps.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.userName}</td>
                <td style="font-weight:600;">${app.shopName}</td>
                <td style="font-size:0.85rem; color:#64748b;">${app.description}</td>
                <td>${new Date(app.createdAt).toLocaleDateString()}</td>
                <td><span class="badge ${getShopStatusBadgeClass(app.status)}">${app.status === 1 ? 'Approved' : (app.status === 0 ? 'Pending' : 'Rejected')}</span></td>
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
        window.common.showToast('Đã phê duyệt!', 'success');
        loadAdminShopApps();
    } catch (e) {
        window.common.showToast('Lỗi: ' + e.message, 'error');
    }
}

async function rejectShop(id) {
    const reason = prompt('Lý do từ chối:');
    if (reason === null) return;
    try {
        await window.api.post(`admin/shop-applications/${id}/reject`, { body: reason });
        window.common.showToast('Đã từ chối.', 'success');
        loadAdminShopApps();
    } catch (e) {
        window.common.showToast('Lỗi: ' + e.message, 'error');
    }
}

function getShopStatusBadgeClass(status) {
    if (status === 1 || status === 'Approved') return 'badge-resolved';
    if (status === 0 || status === 'Pending') return 'badge-pending';
    return 'badge-danger';
}

// Global scope attachment
window.loadAdminShopApps = loadAdminShopApps;
window.approveShop = approveShop;
window.rejectShop = rejectShop;
