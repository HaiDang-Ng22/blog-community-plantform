// js/common.js

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
});

function updateNav() {
    const navActions = document.getElementById('nav-actions');
    if (!navActions) return;

    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('auth_token');

    if (token && userInfo && userInfo !== 'null') {
        const userName = userInfo.fullName || userInfo.username || 'Người dùng';
        const userAvatar = (userInfo.avatarUrl && userInfo.avatarUrl !== 'null') 
            ? userInfo.avatarUrl 
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&color=fff`;
        
        navActions.innerHTML = `
            <div class="header-search-container">
                <div class="search-bar">
                    <input type="text" id="header-search-input" placeholder="Tìm kiếm bài viết, người dùng...">
                    <button id="header-search-btn"><i class="fa fa-search"></i></button>
                </div>
            </div>
            <div class="notification-wrapper" id="noti-trigger">
                <i class="fa-solid fa-bell"></i>
                <span class="noti-badge hidden" id="noti-count">0</span>
                <div class="noti-dropdown hidden" id="noti-dropdown">
                    <div class="noti-header">Thông báo</div>
                    <div id="noti-list"></div>
                    <div class="noti-footer"><a href="#" id="mark-all-read">Đánh dấu tất cả đã đọc</a></div>
                </div>
            </div>
            <div class="user-menu" id="user-menu-trigger">
                <span class="user-name">Chào, ${userName}</span>
                <img src="${userAvatar}" alt="Avatar" class="mini-avatar" onerror="this.src='https://via.placeholder.com/40'">
                <div class="user-dropdown hidden" id="user-dropdown">
                    <a href="profile.html"><i class="fa fa-user"></i> Hồ sơ cá nhân</a>
                    <a href="create-post.html"><i class="fa fa-plus-circle"></i> Đăng bài mới</a>
                    <hr>
                    <a href="#" onclick="logout(event)"><i class="fa fa-sign-out-alt"></i> Đăng xuất</a>
                </div>
            </div>
        `;

        // Toggle dropdown
        const trigger = document.getElementById('user-menu-trigger');
        const dropdown = document.getElementById('user-dropdown');
        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', () => {
                dropdown.classList.add('hidden');
            });
        }

        // Search logic
        const searchInput = document.getElementById('header-search-input');
        const searchBtn = document.getElementById('header-search-btn');
        const triggerSearch = () => {
            const query = searchInput.value.trim();
            if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        };
        if (searchBtn) searchBtn.onclick = triggerSearch;
        if (searchInput) {
            searchInput.onkeypress = (e) => { if (e.key === 'Enter') triggerSearch(); };
        }

        // Auto-fix missing ID in user_info
        if (!userInfo.id && !userInfo.Id && token) {
            window.api.get('auth/profile').then(profile => {
                userInfo.id = profile.id;
                localStorage.setItem('user_info', JSON.stringify(userInfo));
                console.log('User info normalized with ID');
            }).catch(err => console.error('Failed to normalize user info', err));
        }
    }
}

function logout(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.reload();
}

// Utility to format dates in Vietnamese
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('vi-VN', options);
}
