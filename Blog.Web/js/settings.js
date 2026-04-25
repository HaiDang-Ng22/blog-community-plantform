// js/settings.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }

    // Initialize theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkBtn = document.getElementById('dark-mode-btn');
        if (darkBtn) darkBtn.textContent = window.t('dark_mode_off') || 'Tắt chế độ tối';
    }

    // Initialize Language UI
    syncLanguageUI();
    window.addEventListener('languageChanged', (e) => {
        syncLanguageUI();
        updateDarkModeButtonUI();
        window.common.showToast(window.t('lang_applied'));
    });

    await loadCurrentSettings();
    await loadBlockedUsers();
    await updateMarketplaceTabUI();

    // Profile Form
    const profileForm = document.getElementById('settings-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });

    // Password Form
    const passwordForm = document.getElementById('password-form');
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await changePassword();
    });
});

// Tab Switching
function switchTab(tabName) {
    // Update nav buttons
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.settings-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`section-${tabName}`).classList.add('active');

    // Load blocked list when switching to privacy tab
    if (tabName === 'privacy') loadBlockedUsers();

    // Smooth scrolling to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Dark Mode Toggle
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    const darkBtn = document.getElementById('dark-mode-btn');
    if (darkBtn) {
        darkBtn.textContent = isDark ? (window.t('dark_mode_off') || 'Tắt chế độ tối') : (window.t('dark_mode_on') || 'Bật chế độ tối');
    }
}

function syncLanguageUI() {
    const currentLang = localStorage.getItem('zynk_lang') || 'vi';
    document.querySelectorAll('.lang-check').forEach(check => check.classList.add('hidden'));
    const currentCheck = document.getElementById(`lang-check-${currentLang}`);
    if (currentCheck) currentCheck.classList.remove('hidden');
    updateDarkModeButtonUI();
}

function updateDarkModeButtonUI() {
    const darkBtn = document.getElementById('dark-mode-btn');
    if (darkBtn) {
        const isDark = document.body.classList.contains('dark-mode');
        darkBtn.textContent = isDark ? (window.t('dark_mode_off') || 'Tắt chế độ tối') : (window.t('dark_mode_on') || 'Bật chế độ tối');
    }
}

// Profile Logic
async function loadCurrentSettings() {
    try {
        const profile = await window.api.get('auth/profile');

        document.getElementById('set-username').value = profile.username || '';
        document.getElementById('set-fullname').value = profile.fullName || '';
        document.getElementById('set-bio').value = profile.bio || '';
        document.getElementById('set-gender').value = profile.gender || 'Other';

        document.getElementById('set-avatar-url').value = profile.avatarUrl || '';
        document.getElementById('set-cover-url').value = profile.coverImageUrl || '';

        if (profile.avatarUrl) document.getElementById('avatar-preview').src = profile.avatarUrl;
        if (profile.coverImageUrl) document.getElementById('cover-preview').src = profile.coverImageUrl;

        // Cập nhật công tắc Private Account
        const privateToggle = document.getElementById('private-account-toggle');
        if (privateToggle) {
            privateToggle.checked = profile.isPrivate === true;
        }

    } catch (error) {
        console.error('Failed to load settings', error);
    }
}

// Privacy Logic
async function togglePrivateAccount() {
    const toggle = document.getElementById('private-account-toggle');
    const isPrivate = toggle.checked;

    try {
        const result = await window.api.put('users/me/privacy', { isPrivate: isPrivate });
        showStatus(result.message || window.t('privacy_updated_success'), 'success');
    } catch (error) {
        toggle.checked = !isPrivate;
        showStatus(window.t('error') + ': ' + error.message, 'error');
    }
}

async function saveSettings() {
    const btn = document.getElementById('save-settings-btn');
    const msg = document.getElementById('settings-msg');

    const data = {
        username: document.getElementById('set-username').value.trim().replace('@', ''),
        fullName: document.getElementById('set-fullname').value.trim(),
        bio: document.getElementById('set-bio').value.trim(),
        gender: document.getElementById('set-gender').value,
        avatarUrl: document.getElementById('set-avatar-url').value.trim(),
        coverImageUrl: document.getElementById('set-cover-url').value.trim()
    };

    try {
        btn.disabled = true;
        const result = await window.api.put('users/profile', data);

        // Update local cache
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        userInfo.fullName = data.fullName;
        userInfo.avatarUrl = data.avatarUrl;
        userInfo.username = data.username;
        localStorage.setItem('user_info', JSON.stringify(userInfo));

        showStatus(window.t('profile_updated_success') || 'Cập nhật hồ sơ thành công!', 'success');
    } catch (error) {
        showStatus(error.message || window.t('update_failed'), 'error');
    } finally {
        btn.disabled = false;
    }
}

// Password Logic
async function changePassword() {
    const oldPwd = document.getElementById('old-password').value;
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;

    if (newPwd !== confirmPwd) {
        showStatus('Mật khẩu xác nhận không khớp.', 'error');
        return;
    }

    try {
        await window.api.post('auth/change-password', {
            oldPassword: oldPwd,
            newPassword: newPwd
        });
        showStatus(window.t('password_changed_success') || 'Đổi mật khẩu thành công!', 'success');
        document.getElementById('password-form').reset();
    } catch (error) {
        showStatus(error.message || window.t('password_change_failed'), 'error');
    }
}

// Account Deletion
async function deleteAccount() {
    const confirmed = confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA TÀI KHOẢN?\n\nHành động này sẽ xóa toàn bộ bài viết, ảnh và dữ liệu của bạn vĩnh viễn và không thể khôi phục.');

    if (confirmed) {
        const finalCheck = prompt('Vui lòng nhập "DELETE" để xác nhận việc xóa tài khoản:');
        if (finalCheck === 'DELETE') {
            try {
                await window.api.delete('users/me');
                alert('Tài khoản của bạn đã được xóa. Tạm biệt!');
                localStorage.clear();
                window.location.href = 'auth.html';
            } catch (error) {
                alert('Lỗi khi xóa tài khoản: ' + error.message);
            }
        }
    }
}

// Profile Upload Helper (Global)
async function handleProfileUpload(input, type) {
    const file = input.files[0];
    if (!file) return;

    const btn = input.previousElementSibling;
    const preview = document.getElementById(`${type}-preview`);
    const urlInput = document.getElementById(`set-${type}-url`);

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Đang tải...';

    try {
        const result = await window.api.uploadImage(file);
        urlInput.value = result.url;
        preview.src = result.url;
    } catch (error) {
        alert('Lỗi khi tải ảnh: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function showStatus(text, type) {
    const msg = document.getElementById('settings-msg');
    msg.textContent = text;
    msg.className = `message-box ${type}`;
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
}

// =============================================
// MARKETPLACE TAB: Cập nhật tên và nội dung dựa trên trạng thái shop
// =============================================
async function updateMarketplaceTabUI() {
    const tabLabel = document.getElementById('tab-marketplace-label');
    const section = document.getElementById('section-marketplace');
    if (!tabLabel || !section) return;

    let hasShop = false;
    let shopData = null;
    let pendingApp = null;

    try {
        shopData = await window.api.get('seller/my-shop');
        hasShop = true;
    } catch (e) {
        // 404 = chưa có shop, kiểm tra xem có đơn đang chờ duyệt không
        try {
            pendingApp = await window.api.get('seller/application-status');
        } catch {}
    }

    if (hasShop) {
        // Đã có shop → đổi tên tab thành "Kênh người bán"
        tabLabel.setAttribute('data-i18n', 'seller_center');
        tabLabel.textContent = window.t('seller_center');
        // Hiển thị form quản lý shop
        section.innerHTML = `
            <h2 class="section-title" data-i18n="seller_center">${window.t('seller_center')}</h2>
            <p class="section-desc" data-i18n="marketplace_settings_desc">${window.t('marketplace_settings_desc') || 'Quản lý và thiết lập thông tin kinh doanh trên Marketplace.'}</p>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem;">
                <i class="fa-solid fa-circle-check" style="color:#16a34a; font-size:1.3rem;"></i>
                <div>
                    <div style="font-weight:600; color:#15803d;" data-i18n="shop_active_title">${window.t('shop_active_title')}</div>
                    <div style="font-size:0.85rem; color:#166534;">${window.t('shop_active_desc').replace('{name}', shopData.name || '')}</div>
                </div>
            </div>
            <form id="marketplace-form" style="max-width: 500px;" onsubmit="event.preventDefault(); showStatus(window.t('update_success'), 'success');">
                <div class="form-group">
                    <label for="set-shop-name" data-i18n="shop_name_label">${window.t('shop_name_label')}</label>
                    <input type="text" id="set-shop-name" placeholder="${window.t('shop_name_placeholder')}" data-i18n-placeholder="shop_name_placeholder" value="${shopData.name || ''}">
                </div>
                <div class="form-group">
                    <label for="set-delivery-address" data-i18n="delivery_address_label">${window.t('delivery_address_label')}</label>
                    <textarea id="set-delivery-address" rows="3" placeholder="${window.t('delivery_address_placeholder')}" data-i18n-placeholder="delivery_address_placeholder"></textarea>
                </div>
                <div class="theme-card" style="margin-bottom: 1.5rem; margin-top: 0">
                    <div>
                        <div style="font-weight: 600;" data-i18n="auto_reply_label">${window.t('auto_reply_label')}</div>
                        <div style="font-size: 0.85rem; color: #6b7280;" data-i18n="auto_reply_desc">${window.t('auto_reply_desc')}</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="auto-reply-toggle" onchange="document.getElementById('auto-reply-box').style.display = this.checked ? 'block' : 'none'">
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="form-group" id="auto-reply-box" style="display: none;">
                    <textarea id="set-auto-reply" rows="2" placeholder="${window.t('auto_reply_placeholder')}" data-i18n-placeholder="auto_reply_placeholder"></textarea>
                </div>
                <button type="submit" class="btn primary-btn" data-i18n="save_marketplace_btn">${window.t('save_marketplace_btn')}</button>
            </form>
        `;
    } else {
        // Chưa có shop → đổi tên tab thành "Đăng ký bán hàng"
        tabLabel.setAttribute('data-i18n', 'register_seller');
        tabLabel.textContent = window.t('register_seller');

        // Kiểm tra xem có đơn chờ duyệt không
        const isPending = pendingApp && pendingApp.status === 'Pending';
        const isRejected = pendingApp && pendingApp.status === 'Rejected';

        section.innerHTML = `
            <h2 class="section-title" data-i18n="register_seller">${window.t('register_seller')}</h2>
            <p class="section-desc" data-i18n="register_seller_desc">${window.t('register_seller_desc') || 'Đăng ký để mở cửa hàng và bắt đầu kinh doanh trên Zynk Marketplace.'}</p>
            ${isPending ? `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem;">
                <i class="fa-solid fa-clock" style="color:#d97706; font-size:1.3rem;"></i>
                <div>
                    <div style="font-weight:600; color:#92400e;" data-i18n="pending_approval_title">${window.t('pending_approval_title')}</div>
                    <div style="font-size:0.85rem; color:#78350f;">${window.t('pending_approval_desc').replace('{name}', pendingApp.shopName)}</div>
                </div>
            </div>
            ` : ''}
            ${isRejected ? `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem;">
                <i class="fa-solid fa-circle-xmark" style="color:#dc2626; font-size:1.3rem;"></i>
                <div>
                    <div style="font-weight:600; color:#b91c1c;" data-i18n="rejected_approval_title">${window.t('rejected_approval_title')}</div>
                    <div style="font-size:0.85rem; color:#991b1b;">${window.t('rejected_approval_desc').replace('{name}', pendingApp.shopName)}</div>
                </div>
            </div>
            ` : ''}
            ${!isPending ? `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:1.5rem; margin-bottom:1.5rem;">
                <h4 style="margin:0 0 0.75rem; color:#1e40af; display:flex; align-items:center; gap:0.5rem;" data-i18n="seller_benefits_title">
                    <i class="fa-solid fa-store"></i> ${window.t('seller_benefits_title')}
                </h4>
                <ul style="margin:0; padding-left:1.25rem; color:#1e3a8a; font-size:0.9rem; line-height:2;">
                    <li data-i18n="seller_benefits_1">${window.t('seller_benefits_1')}</li>
                    <li data-i18n="seller_benefits_2">${window.t('seller_benefits_2')}</li>
                    <li data-i18n="seller_benefits_3">${window.t('seller_benefits_3')}</li>
                    <li data-i18n="seller_benefits_4">${window.t('seller_benefits_4')}</li>
                </ul>
            </div>
            <form id="register-seller-form" style="max-width: 500px;" onsubmit="submitSellerRegistration(event)">
                <div class="form-group">
                    <label for="reg-shop-name" data-i18n="shop_name_label">${window.t('shop_name_label')} <span style="color:#ef4444">*</span></label>
                    <input type="text" id="reg-shop-name" placeholder="${window.t('shop_name_placeholder')}" data-i18n-placeholder="shop_name_placeholder" required>
                </div>
                <div class="form-group">
                    <label for="reg-shop-desc" data-i18n="shop_desc_label">${window.t('shop_desc_label') || 'Mô tả cửa hàng'}</label>
                    <textarea id="reg-shop-desc" rows="3" placeholder="${window.t('shop_desc_placeholder') || 'Mô tả ngắn về sản phẩm/dịch vụ bạn cung cấp...'}" data-i18n-placeholder="shop_desc_placeholder"></textarea>
                </div>
                <button type="submit" class="btn primary-btn" id="register-seller-btn" style="background: linear-gradient(135deg, #059669, #10b981);">
                    <i class="fa-solid fa-paper-plane" style="margin-right:6px;"></i> <span data-i18n="send_application_btn">${window.t('send_application_btn')}</span>
                </button>
            </form>
            ` : ''}
        `;
    }
    
    // Apply translations to the newly injected HTML
    if (window.applyTranslations) {
        window.applyTranslations();
    }
}

async function submitSellerRegistration(e) {
    e.preventDefault();
    const btn = document.getElementById('register-seller-btn');
    const shopName = document.getElementById('reg-shop-name').value.trim();
    const description = document.getElementById('reg-shop-desc').value.trim();

    if (!shopName) {
        showStatus('Vui lòng nhập tên cửa hàng.', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${window.t('submitting')}`;
        await window.api.post('seller/apply', { shopName, description });
        showStatus(window.t('register_success'), 'success');
        // Xóa cache và làm mới UI
        sessionStorage.removeItem('zynk_has_shop');
        await updateMarketplaceTabUI();
    } catch (err) {
        showStatus(err.message || window.t('register_failed'), 'error');
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane" style="margin-right:6px;"></i> ${window.t('send_application_btn')}`;
    }
}

// =============================================
// BLOCKED USERS
// =============================================
async function loadBlockedUsers() {
    const container = document.getElementById('blocked-users-list');
    if (!container) return;

    try {
        const list = await window.api.get('users/me/blocked');

        if (!list || list.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 2rem; color:#94a3b8; font-size:0.9rem;">
                    <i class="fa-solid fa-user-check" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#d1d5db;"></i>
                    Bạn chưa chặn ai cả.
                </div>`;
            return;
        }

        container.innerHTML = list.map(u => {
            const avatar = u.avatarUrl && u.avatarUrl !== 'null'
                ? u.avatarUrl
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || u.username)}&background=random&color=fff`;
            return `
            <div id="blocked-row-${u.id}" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                margin-bottom: 8px;
                background: #fff;
            ">
                <img src="${avatar}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1px solid #e5e7eb;"
                    onerror="this.src='https://ui-avatars.com/api/?name=U&background=random&color=fff'">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:0.95rem; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.fullName || 'Người dùng'}</div>
                    <div style="font-size:0.8rem; color:#6b7280;">@${u.username}</div>
                </div>
                <button
                    onclick="unblockUser('${u.id}', this)"
                    style="
                        padding: 7px 16px;
                        background: #fff;
                        color: #ef4444;
                        border: 1.5px solid #ef4444;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.background='#fef2f2'"
                    onmouseout="this.style.background='#fff'"
                >
                    <i class="fa-solid fa-lock-open" style="margin-right:4px;"></i>Bỏ chặn
                </button>
            </div>`;
        }).join('');

    } catch (err) {
        container.innerHTML = `<div style="color:#ef4444; font-size:0.85rem; padding:0.5rem;">Không thể tải danh sách chặn.</div>`;
        console.error('loadBlockedUsers error:', err);
    }
}

async function unblockUser(userId, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await window.api.post(`users/${userId}/block`);

        // Xóa dòng người dùng khỏi danh sách với animation
        const row = document.getElementById(`blocked-row-${userId}`);
        if (row) {
            row.style.transition = 'opacity 0.3s, transform 0.3s';
            row.style.opacity = '0';
            row.style.transform = 'translateX(20px)';
            setTimeout(() => {
                row.remove();
                // Nếu danh sách trống sau khi xóa thì hiển thị thông báo
                const container = document.getElementById('blocked-users-list');
                if (container && container.children.length === 0) {
                    container.innerHTML = `
                        <div style="text-align:center; padding: 2rem; color:#94a3b8; font-size:0.9rem;">
                            <i class="fa-solid fa-user-check" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#d1d5db;"></i>
                            Bạn chưa chặn ai cả.
                        </div>`;
                }
            }, 300);
        }
        showStatus('Đã bỏ chặn tài khoản này.', 'success');
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showStatus('Lỗi khi bỏ chặn: ' + err.message, 'error');
    }
}
