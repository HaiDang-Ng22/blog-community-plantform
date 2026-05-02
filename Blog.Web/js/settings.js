// js/settings.js
const _t = (key) => {
    if (typeof window.t === 'function') return window.t(key);
    return window.zynkTranslations?.vi?.[key] || key;
};

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
        if (darkBtn) darkBtn.textContent = _t('dark_mode_off');
    }

    // Initialize Language UI
    syncLanguageUI();
    window.addEventListener('languageChanged', (e) => {
        syncLanguageUI();
        updateDarkModeButtonUI();
        if (window.common) window.common.showToast(_t('lang_applied'));
    });

    await loadCurrentSettings();
    await loadBlockedUsers();
    await updateMarketplaceTabUI();

    // Profile Form
    const profileForm = document.getElementById('settings-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveSettings();
        });
    }

    // Password Form
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await changePassword();
        });
    }
});

// Tab Switching
function switchTab(tabName) {
    // Update nav buttons
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.classList.remove('active');
        const onClick = btn.getAttribute('onclick') || '';
        if (onClick.includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.settings-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const targetSec = document.getElementById(`section-${tabName}`);
    if (targetSec) targetSec.classList.add('active');

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
        darkBtn.textContent = isDark ? _t('dark_mode_off') : _t('dark_mode_on');
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
        darkBtn.textContent = isDark ? _t('dark_mode_off') : _t('dark_mode_on');
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
        showStatus(result.message || _t('privacy_updated_success'), 'success');
    } catch (error) {
        toggle.checked = !isPrivate;
        showStatus(_t('error') + ': ' + error.message, 'error');
    }
}

async function saveSettings() {
    const btn = document.getElementById('save-settings-btn');
    const data = {
        username: document.getElementById('set-username').value.trim().replace('@', ''),
        fullName: document.getElementById('set-fullname').value.trim(),
        bio: document.getElementById('set-bio').value.trim(),
        gender: document.getElementById('set-gender').value,
        avatarUrl: document.getElementById('set-avatar-url').value.trim(),
        coverImageUrl: document.getElementById('set-cover-url').value.trim()
    };

    try {
        if (btn) btn.disabled = true;
        const result = await window.api.put('users/profile', data);

        // Update local cache
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        userInfo.fullName = data.fullName;
        userInfo.avatarUrl = data.avatarUrl;
        userInfo.username = data.username;
        localStorage.setItem('user_info', JSON.stringify(userInfo));

        showStatus(_t('profile_updated_success') || 'Cập nhật hồ sơ thành công!', 'success');
    } catch (error) {
        showStatus(error.message || _t('update_failed'), 'error');
    } finally {
        if (btn) btn.disabled = false;
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
        showStatus(_t('password_changed_success') || 'Đổi mật khẩu thành công!', 'success');
        const pwdForm = document.getElementById('password-form');
        if (pwdForm) pwdForm.reset();
    } catch (error) {
        showStatus(error.message || _t('password_change_failed'), 'error');
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
    if (!msg) return;
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

    try {
        // 1. Check for active shop
        const shop = await window.api.get('seller/my-shop');
        
        tabLabel.textContent = _t('seller_center');
        section.innerHTML = `
            <h2 class="section-title" data-i18n="seller_center">${_t('seller_center')}</h2>
            <p class="section-desc">Quản lý cửa hàng và kinh doanh của bạn.</p>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:2rem; text-align:center; margin-top:1rem;">
                <i class="fa-solid fa-shop" style="font-size:3.5rem; color:#22c55e; margin-bottom:1.5rem;"></i>
                <h3 style="color:#166534; font-size:1.4rem; margin-bottom:0.5rem;">Cửa hàng của bạn đang hoạt động</h3>
                <p style="color:#166534; margin: 1rem 0; font-size:0.95rem;">Cửa hàng <strong>${shop.name}</strong> đã sẵn sàng.</p>
                <a href="seller-center.html" class="btn primary-btn" style="display:inline-block; padding:0.9rem 2.5rem; background:#22c55e; border:none; border-radius:10px; font-weight:700; text-decoration:none;">
                    Vào Kênh Người Bán
                </a>
            </div>
        `;
    } catch (err) {
        // Only check application status if shop was NOT found (404)
        if (err.status === 404) {
            try {
                const app = await window.api.get('seller/application-status');
                
                if (app && app.status === 'Pending') {
                    tabLabel.textContent = "Đang chờ duyệt";
                    section.innerHTML = `
                        <h2 class="section-title">Trạng thái đăng ký</h2>
                        <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:12px; padding:2rem; text-align:center; margin-top:1rem;">
                            <i class="fa-solid fa-clock" style="font-size:3.5rem; color:#f59e0b; margin-bottom:1.5rem;"></i>
                            <h3 style="color:#92400e; font-size:1.4rem; margin-bottom:0.5rem;">Đang chờ phê duyệt</h3>
                            <p style="color:#92400e; margin: 1rem 0; font-size:0.95rem;">Hồ sơ đăng ký <strong>${app.shopName}</strong> đang được Admin xem xét.</p>
                        </div>
                    `;
                } else if (app && app.status === 'Rejected') {
                    tabLabel.textContent = "Đã bị từ chối";
                    section.innerHTML = `
                        <h2 class="section-title">Trạng thái đăng ký</h2>
                        <div style="background:#fef2f2; border:1px solid #fee2e2; border-radius:12px; padding:2rem; text-align:center; margin-top:1rem;">
                            <i class="fa-solid fa-circle-xmark" style="font-size:3.5rem; color:#ef4444; margin-bottom:1.5rem;"></i>
                            <h3 style="color:#991b1b; font-size:1.4rem; margin-bottom:0.5rem;">Đăng ký bị từ chối</h3>
                            <p style="color:#991b1b; margin: 1rem 0; font-size:0.95rem;">Lý do: ${app.rejectionReason || 'Thông tin chưa chính xác.'}</p>
                            <button onclick="window.location.href='seller-center.html'" class="btn primary-btn" style="background:#ef4444; border:none;">Đăng ký lại</button>
                        </div>
                    `;
                } else {
                    // No shop AND no app (or app is null)
                    tabLabel.textContent = _t('register_seller') || "Đăng ký bán hàng";
                    section.innerHTML = `
                        <h2 class="section-title">Đăng ký người bán</h2>
                        <div style="background:linear-gradient(135deg, #f8fafc, #f1f5f9); border:1px solid #e2e8f0; border-radius:12px; padding:2.5rem; text-align:center; margin-top:1rem;">
                            <i class="fa-solid fa-store" style="font-size:3.5rem; color:#94a3b8; margin-bottom:1.5rem;"></i>
                            <h3 style="color:#475569; font-size:1.4rem; margin-bottom:0.5rem;">Bắt đầu kinh doanh trên Zynk</h3>
                            <p style="color:#64748b; margin: 1rem 0; font-size:0.95rem;">Tiếp cận hàng ngàn khách hàng tiềm năng bằng cách mở cửa hàng ngay hôm nay.</p>
                            <button onclick="window.location.href='seller-center.html'" class="btn primary-btn" style="display:inline-block; padding:0.9rem 2.5rem; border-radius:10px; font-weight:700;">
                                Đăng ký ngay
                            </button>
                        </div>
                    `;
                }
            } catch (e) {
                console.error("Failed to fetch application status", e);
                section.innerHTML = `<p class="noti-empty">Không thể tải thông tin đăng ký.</p>`;
            }
        } else {
            // Other errors (500, etc.)
            console.error("Seller info fetch error:", err);
            section.innerHTML = `<p class="noti-empty">Lỗi hệ thống: ${err.message || 'Không thể kết nối API'}</p>`;
        }
    }
    
    if (window.applyTranslations) window.applyTranslations();
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
