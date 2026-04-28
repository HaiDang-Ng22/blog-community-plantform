// js/profile.js
let currentProfileId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');

    // Nếu không có ID trong URL và không đăng nhập -> qua trang login
    if (!userId && !localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    currentProfileId = userId || currentUser.id || currentUser.Id;
    if (currentProfileId) {
        const profileData = await loadUserProfile(currentProfileId);
        if (profileData) {
            await loadUserPosts(currentProfileId, profileData.isPrivate, profileData.isFollowing, currentProfileId === currentUser.id);
        }
    }

    // Tab Listeners
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
});

async function switchTab(tabName) {
    // UI Update
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.profile-tab[data-tab="${tabName}"]`).classList.add('active');

    const postsContainer = document.getElementById('posts-container');
    const listContainer = document.getElementById('list-container');

    if (tabName === 'posts') {
        postsContainer.classList.add('active');
        listContainer.classList.remove('active');
    } else {
        postsContainer.classList.remove('active');
        listContainer.classList.add('active');
        await loadUserList(currentProfileId, tabName);
    }
}

async function loadUserList(userId, type) {
    const grid = document.getElementById('user-list-grid');
    const noUsers = document.getElementById('no-users');
    grid.innerHTML = '<div class="loading-spinner"></div>';
    noUsers.classList.add('hidden');

    try {
        // map type to endpoint: friends, followers, following
        const users = await window.api.get(`users/${userId}/${type}`);
        grid.innerHTML = '';

        if (users.length === 0) {
            noUsers.classList.remove('hidden');
            return;
        }

        users.forEach(user => {
            const card = document.createElement('div');
            card.className = 'user-item-card animate-up';
            card.innerHTML = `
                <img src="${user.avatarUrl || 'https://ui-avatars.com/api/?name=' + user.fullName}" class="avatar-md">
                <div class="user-info">
                    <a href="profile.html?id=${user.id}" class="full-name">${user.fullName}</a>
                    <span class="username">@${user.username}</span>
                </div>
                <button class="btn secondary-btn action-btn" onclick="window.location.href='profile.html?id=${user.id}'">Xem hồ sơ</button>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        grid.innerHTML = '<p class="error">Không thể tải danh sách.</p>';
    }
}

async function loadUserProfile(userId) {
    try {
        const profile = await window.api.get(`users/${userId}/profile`);
        const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
        
        const currentId = (currentUser.id || '').toString().toLowerCase();
        const targetId = userId.toString().toLowerCase();
        const isMyProfile = currentId === targetId;

        const userName = profile.fullName || profile.username || 'Người dùng';
        document.getElementById('profile-name').textContent = userName;
        document.getElementById('profile-username').textContent = '@' + profile.username;
        
        const largeAvatar = (profile.avatarUrl && profile.avatarUrl !== 'null') 
            ? profile.avatarUrl 
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&size=128`;
            
        document.getElementById('profile-avatar').src = largeAvatar;
        document.getElementById('profile-avatar').onerror = function() { this.src = 'https://via.placeholder.com/150'; };
        
        document.getElementById('profile-bio').textContent = profile.bio || 'Chưa có tiểu sử.';
        document.getElementById('follower-count').textContent = profile.followerCount;
        document.getElementById('following-count').textContent = profile.followingCount;
        
        // Render Cover Image
        const coverEl = document.querySelector('.profile-cover');
        if (profile.coverImageUrl) {
            coverEl.style.backgroundImage = `url(${profile.coverImageUrl})`;
        } else {
            coverEl.style.background = 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)';
        }

        const followBtn = document.getElementById('follow-btn');
        if (isMyProfile) {
            followBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa hồ sơ';
            followBtn.className = 'btn secondary-btn';
            followBtn.onclick = () => window.location.href = 'settings.html';
        } else {
            updateFollowButton(profile.isFollowing);
            followBtn.onclick = () => toggleFollow(userId);
        }
        
        return profile;
    } catch (error) {
        console.error('Failed to load profile', error);
        document.getElementById('profile-name').textContent = 'Lỗi tải hồ sơ';
        document.getElementById('profile-bio').textContent = 'Có thể người dùng không tồn tại hoặc bạn cần đăng nhập lại.';
        return null;
    }
}

function updateFollowButton(isFollowing) {
    const btn = document.getElementById('follow-btn');
    if (isFollowing) {
        btn.textContent = 'Đang theo dõi';
        btn.className = 'btn secondary-btn';
    } else {
        btn.textContent = 'Theo dõi';
        btn.className = 'btn primary-btn';
    }
}

async function toggleFollow(userId) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }
    try {
        const result = await window.api.post(`users/${userId}/follow`);
        updateFollowButton(result.isFollowing);
        // Refresh counts
        const followers = document.getElementById('follower-count');
        followers.textContent = parseInt(followers.textContent) + (result.isFollowing ? 1 : -1);
        
        // Reload page to refresh newsfeed/posts grid visibility
        window.location.reload();
    } catch (e) {
        alert('Lỗi khi thực hiện follow');
    }
}

async function loadUserPosts(userId, isPrivate, isFollowing, isMyProfile) {
    const grid = document.getElementById('profile-posts-grid');
    grid.innerHTML = '<div class="post-card skeleton animate-up"></div>';

    // Xử lý Private Account Lockdown
    if (!isMyProfile && isPrivate && !isFollowing) {
        document.getElementById('post-count').textContent = '?';
        grid.innerHTML = `
            <div style="text-align:center; padding: 4rem 2rem; background: var(--card-bg); border-radius: 1rem; border: 1px solid var(--border-color); margin-top: 1rem;">
                <div style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #64748b; display: flex; align-items:center; justify-content:center; margin: 0 auto 1.5rem;">
                    <i class="fa-solid fa-lock" style="font-size: 2.5rem; color: #64748b;"></i>
                </div>
                <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Tài khoản này là riêng tư</h3>
                <p style="color: var(--text-secondary); font-size: 0.95rem;">Theo dõi để xem ảnh và video của họ.</p>
            </div>
        `;
        return;
    }

    try {
        const userPosts = await window.api.get(`posts/user/${userId}`);
        grid.innerHTML = '';
        
        if (userPosts.length === 0) {
            grid.innerHTML = '<p class="no-posts">Chưa có bài đăng nào.</p>';
            document.getElementById('post-count').textContent = '0';
            return;
        }

        document.getElementById('post-count').textContent = userPosts.length;
        
        // Sắp xếp bài viết mới nhất lên đầu
        userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        userPosts.forEach(post => {
            grid.appendChild(window.common.createPostCard(post));
        });
    } catch (error) {
        grid.innerHTML = '<p class="error">Lỗi khi tải bài viết.</p>';
        console.error(error);
    }
}

function formatDate(dateStr) { return window.common.formatDate(dateStr); }
function toggleMenu(btn) { window.common.toggleMenu(btn); }
