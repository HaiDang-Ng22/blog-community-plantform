// js/settings.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }

    await loadCurrentSettings();

    const form = document.getElementById('settings-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });
});

// Global helper for profile uploads
async function handleProfileUpload(input, type) {
    const file = input.files[0];
    if (!file) return;

    const btn = input.previousElementSibling.querySelector('button') || input.previousElementSibling;
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

async function loadCurrentSettings() {
    try {
        const profile = await window.api.get('auth/profile');
        
        document.getElementById('set-username').value = profile.username || '';
        document.getElementById('set-fullname').value = profile.fullName || '';
        document.getElementById('set-bio').value = profile.bio || '';
        document.getElementById('set-gender').value = profile.gender || 'Other';
        
        // Populate hidden URL fields and previews
        document.getElementById('set-avatar-url').value = profile.avatarUrl || '';
        document.getElementById('set-cover-url').value = profile.coverImageUrl || '';
        
        if (profile.avatarUrl) document.getElementById('avatar-preview').src = profile.avatarUrl;
        if (profile.coverImageUrl) document.getElementById('cover-preview').src = profile.coverImageUrl;
        
    } catch (error) {
        console.error('Failed to load settings', error);
        alert('Không thể tải thông tin cài đặt. Vui lòng đăng nhập lại.');
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
        btn.textContent = 'Đang lưu...';
        
        const result = await window.api.put('users/profile', data);
        
        // Update local info
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        userInfo.fullName = data.fullName;
        userInfo.avatarUrl = data.avatarUrl;
        userInfo.username = result.username || data.username;
        localStorage.setItem('user_info', JSON.stringify(userInfo));

        msg.textContent = result.message || 'Cập nhật thành công!';
        msg.className = 'message-box success';
        msg.classList.remove('hidden');
        
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 1500);

    } catch (error) {
        msg.textContent = error.message || 'Cập nhật thất bại.';
        msg.className = 'message-box error';
        msg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Lưu thay đổi';
    }
}
