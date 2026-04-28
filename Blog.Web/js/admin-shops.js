// Admin Shop Management Logic

let _cachedShopApps = [];

async function loadAdminShopApps() {
    const list = document.getElementById('admin-shops-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="5" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const apps = await window.api.get('admin/shop-applications');
        _cachedShopApps = apps;
        list.innerHTML = '';

        if (!apps || apps.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#64748b;">Không có yêu cầu nào.</td></tr>';
            return;
        }

        apps.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.userName}</td>
                <td style="font-weight:600;">${app.shopName}</td>
                <td>${app.citizenId || '---'}</td>
                <td><span class="badge ${getShopStatusBadgeClass(app.status)}">${app.status === 1 || app.status === 'Approved' ? 'Approved' : (app.status === 0 || app.status === 'Pending' ? 'Pending' : 'Rejected')}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-action" title="Chi tiết" onclick="viewShopAppDetail('${app.id}')"><i class="fa fa-eye"></i></button>
                        ${app.status === 0 || app.status === 'Pending' ? `
                            <button class="btn-action" style="color:#10b981; border-color:#10b981;" title="Duyệt" onclick="approveShop('${app.id}')"><i class="fa fa-check"></i></button>
                            <button class="btn-action danger" title="Từ chối" onclick="rejectShop('${app.id}')"><i class="fa fa-times"></i></button>
                        ` : ''}
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        list.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Lỗi tải ứng dụng: ${e.message}</td></tr>`;
    }
}

function viewShopAppDetail(id) {
    const app = _cachedShopApps.find(a => a.id === id);
    if (!app) return;

    const dobStr = app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : '---';
    const age = app.dateOfBirth ? (new Date().getFullYear() - new Date(app.dateOfBirth).getFullYear()) : '---';

    const html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div><strong>Người đăng ký:</strong> ${app.userName}</div>
            <div><strong>Tên Shop:</strong> ${app.shopName}</div>
            <div><strong>Số CCCD:</strong> ${app.citizenId || '---'}</div>
            <div><strong>Họ tên (CCCD):</strong> ${app.fullName || '---'}</div>
            <div><strong>Giới tính:</strong> ${app.gender || '---'}</div>
            <div><strong>Ngày sinh:</strong> ${dobStr} (Khoảng ${age} tuổi)</div>
            <div><strong>Quê quán:</strong> ${app.hometown || '---'}</div>
            <div><strong>Nghề nghiệp:</strong> ${app.occupation || '---'}</div>
        </div>
        <div style="margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            <strong>Mô tả Shop:</strong>
            <p style="margin-top: 0.5rem; color: #475569;">${app.description || 'Không có'}</p>
        </div>
        <div style="margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            <strong>Trạng thái:</strong> <span class="badge ${getShopStatusBadgeClass(app.status)}">${app.status === 1 || app.status === 'Approved' ? 'Approved' : (app.status === 0 || app.status === 'Pending' ? 'Pending' : 'Rejected')}</span>
            <br><span style="font-size: 0.85rem; color: #64748b;">Gửi ngày: ${new Date(app.createdAt).toLocaleString()}</span>
        </div>
    `;

    document.getElementById('shop-app-detail-body').innerHTML = html;
    document.getElementById('shop-app-detail-modal').classList.remove('hidden');
}

async function approveShop(id) {
    if (!confirm('Xác nhận phê duyệt cửa hàng này?')) return;
    try {
        await window.api.post(`admin/shop-applications/${id}/approve`);
        window.common.showToast('Đã phê duyệt!', 'success');
        loadAdminShopApps();
        loadAdminActiveShops();
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

async function loadAdminActiveShops() {
    const list = document.getElementById('admin-active-shops-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="5" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const shops = await window.api.get('admin/shops');
        list.innerHTML = '';

        if (!shops || shops.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#64748b;">Không có cửa hàng nào.</td></tr>';
            return;
        }

        shops.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight:600;">${s.name}</td>
                <td>${s.ownerName}</td>
                <td>${s.productCount} sp</td>
                <td><span class="badge ${s.isSuspended ? 'badge-danger' : 'badge-resolved'}" style="${s.isSuspended ? 'background:#fef2f2; color:#ef4444;' : ''}">${s.isSuspended ? 'Bị đình chỉ' : 'Hoạt động'}</span></td>
                <td>
                    ${s.isSuspended 
                        ? `<button class="btn btn-sm" style="padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; background: #10b981; color: white;" onclick="unsuspendShop('${s.id}')">Gỡ đình chỉ</button>`
                        : `<button class="btn btn-sm" style="padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; background: #ef4444; color: white;" onclick="suspendShop('${s.id}')">Đình chỉ</button>`
                    }
                </td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        list.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Lỗi tải cửa hàng: ${e.message}</td></tr>`;
    }
}

async function suspendShop(id) {
    if (!confirm('Xác nhận đình chỉ cửa hàng này? Các sản phẩm của cửa hàng sẽ không được hiển thị và không thể thanh toán.')) return;
    try {
        await window.api.post(`admin/shops/${id}/suspend`);
        window.common.showToast('Đã đình chỉ cửa hàng!', 'success');
        loadAdminActiveShops();
    } catch (e) {
        window.common.showToast('Lỗi: ' + e.message, 'error');
    }
}

async function unsuspendShop(id) {
    if (!confirm('Xác nhận gỡ đình chỉ cửa hàng này?')) return;
    try {
        await window.api.post(`admin/shops/${id}/unsuspend`);
        window.common.showToast('Đã gỡ đình chỉ cửa hàng!', 'success');
        loadAdminActiveShops();
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
window.loadAdminActiveShops = loadAdminActiveShops;
window.approveShop = approveShop;
window.rejectShop = rejectShop;
window.suspendShop = suspendShop;
window.unsuspendShop = unsuspendShop;
window.viewShopAppDetail = viewShopAppDetail;
