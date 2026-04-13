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
        if (darkBtn) darkBtn.textContent = 'Tắt chế độ tối';
    }

    await loadCurrentSettings();

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

    // Smooth scrolling to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Dark Mode Toggle
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    const darkBtn = document.getElementById('dark-mode-btn');
    if (darkBtn) {
        darkBtn.textContent = isDark ? 'Tắt chế độ tối' : 'Bật chế độ tối';
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
        showStatus(result.message || 'Cập nhật quyền riêng tư thành công!', 'success');
    } catch (error) {
        toggle.checked = !isPrivate; // Hoàn tác thao tác nếu lỗi
        showStatus('Lỗi: ' + error.message, 'error');
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

        showStatus('Cập nhật hồ sơ thành công!', 'success');
    } catch (error) {
        showStatus(error.message || 'Cập nhật thất bại.', 'error');
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
        showStatus('Đổi mật khẩu thành công!', 'success');
        document.getElementById('password-form').reset();
    } catch (error) {
        showStatus(error.message || 'Đổi mật khẩu thất bại.', 'error');
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
