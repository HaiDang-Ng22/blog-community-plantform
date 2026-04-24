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
        window.common.showToast(window.t('lang_applied'));
    });

    await loadCurrentSettings();
    await loadBlockedUsers();

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
