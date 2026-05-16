/* js/admin-banners.js */

async function loadAdminBanners() {
    const list = document.getElementById('banner-list-admin');
    if (!list) return;

    list.innerHTML = '<div style="padding: 2rem; text-align: center;"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Đang tải danh sách banner...</p></div>';

    try {
        const banners = await window.api.get('admin/banners').catch(() => []);
        
        if (banners.length === 0) {
            list.innerHTML = '<div style="padding: 3rem; text-align: center; color: #64748b; border: 2px dashed #e2e8f0; border-radius: 12px;"><i class="fa fa-image fa-3x" style="margin-bottom: 1rem; opacity: 0.3;"></i><p>Chưa có banner nào. Hãy thêm banner mới.</p></div>';
            return;
        }

        list.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                ${banners.map(b => `
                    <div class="admin-card" style="padding: 0; overflow: hidden; position: relative;">
                        <img src="${b.imageUrl}" style="width: 100%; height: 150px; object-fit: cover;">
                        <div style="padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                <span class="badge ${b.isMain !== false ? 'badge-resolved' : 'badge-user'}">
                                    ${b.isMain !== false ? 'Banner Chính' : 'Banner Phụ'}
                                </span>
                                <div style="display: flex; gap: 5px;">
                                    <button class="btn-action" onclick="editBanner('${b.id}')"><i class="fa fa-edit"></i></button>
                                    <button class="btn-action danger" onclick="deleteBanner('${b.id}')"><i class="fa fa-trash"></i></button>
                                </div>
                            </div>
                            <div style="font-size: 0.8rem; color: #64748b; word-break: break-all;">Link: ${b.linkUrl || 'Không có'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        list.innerHTML = '<div style="color: red; padding: 2rem; text-align: center;">Lỗi khi tải dữ liệu banner.</div>';
    }
}

function openAddBannerModal() {
    document.getElementById('banner-modal-title').textContent = 'Thêm Banner Mới';
    document.getElementById('banner-id').value = '';
    document.getElementById('banner-url').value = '';
    document.getElementById('banner-type').value = 'main';
    document.getElementById('banner-link').value = '';
    document.getElementById('banner-modal').classList.remove('hidden');
}

async function editBanner(id) {
    try {
        const banner = await window.api.get(`admin/banners/${id}`);
        document.getElementById('banner-modal-title').textContent = 'Chỉnh sửa Banner';
        document.getElementById('banner-id').value = banner.id;
        document.getElementById('banner-url').value = banner.imageUrl;
        document.getElementById('banner-type').value = banner.isMain !== false ? 'main' : 'side';
        document.getElementById('banner-link').value = banner.linkUrl || '';
        document.getElementById('banner-modal').classList.remove('hidden');
    } catch (e) {
        alert('Lỗi khi tải chi tiết banner');
    }
}

function closeBannerModal() {
    document.getElementById('banner-modal').classList.add('hidden');
}

document.getElementById('form-banner').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('banner-id').value;
    const data = {
        imageUrl: document.getElementById('banner-url').value,
        isMain: document.getElementById('banner-type').value === 'main',
        linkUrl: document.getElementById('banner-link').value
    };

    try {
        if (id) {
            await window.api.put(`admin/banners/${id}`, data);
            alert('Cập nhật banner thành công!');
        } else {
            await window.api.post('admin/banners', data);
            alert('Thêm banner thành công!');
        }
        closeBannerModal();
        loadAdminBanners();
    } catch (err) {
        alert(err.message || 'Lỗi khi lưu banner');
    }
};

async function deleteBanner(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa banner này?')) return;
    try {
        await window.api.delete(`admin/banners/${id}`);
        loadAdminBanners();
    } catch (e) {
        alert(e.message || 'Lỗi khi xóa banner');
    }
}

window.loadAdminBanners = loadAdminBanners;
window.openAddBannerModal = openAddBannerModal;
window.editBanner = editBanner;
window.closeBannerModal = closeBannerModal;
window.deleteBanner = deleteBanner;
