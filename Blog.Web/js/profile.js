// js/profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');

    // Nếu không có ID trong URL và không đăng nhập -> qua trang login
    if (!userId && !localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    const targetUserId = userId || currentUser.id || currentUser.Id;
    if (targetUserId) {
        const profileData = await loadUserProfile(targetUserId);
        if (profileData) {
            await loadUserPosts(targetUserId, profileData.isPrivate, profileData.isFollowing, targetUserId === currentUser.id);
        }
    } else {
        console.error('No target user ID found');
        document.getElementById('profile-name').textContent = 'Lỗi: Không tìm thấy người dùng';
    }
});

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
    grid.innerHTML = '<div class="post-card skeleton"></div>';

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
        // Dùng API chung, do Controller đã lọc quyền riêng tư
        const posts = await window.api.get(`posts`);
        const userPosts = posts.filter(p => 
            p.authorId && userId && p.authorId.toString().toLowerCase() === userId.toString().toLowerCase()
        );
        
        grid.innerHTML = '';
        if (userPosts.length === 0) {
            grid.innerHTML = '<p class="no-posts">Người dùng này chưa có bài đăng nào.</p>';
            document.getElementById('post-count').textContent = '0';
            return;
        }

        document.getElementById('post-count').textContent = userPosts.length;
        userPosts.forEach(post => {
            grid.appendChild(createPostCard(post));
        });
    } catch (error) {
        grid.innerHTML = '<p class="error">Lỗi khi tải bài viết.</p>';
        console.error(error);
    }
}

// Reuse createPostCard from home.js if possible, or redefine here
// Since I can't easily share functions across files without modules, I'll redefine or use global
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
    const isOwner = currentUser.id === post.authorId;

    card.innerHTML = `
        <div class="author-avatar-col">
            <img src="${post.authorAvatarUrl || 'https://ui-avatars.com/api/?name=' + post.authorName}" class="mini-avatar">
        </div>
        <div class="post-main-col">
            <div class="post-header">
                <span class="post-author-name">${post.authorName}</span>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span class="post-time">${formatDate(post.createdAt)}</span>
                     ${currentUser.id ? `
                        <div class="post-options">
                            <i class="fa-solid fa-ellipsis options-btn" onclick="toggleMenu(this)"></i>
                            <div class="options-menu hidden">
                                ${isOwner ? `
                                    <button onclick="location.href='edit-post.html?id=${post.id}'"><i class="fa-solid fa-pen"></i> Sửa</button>
                                    <button class="delete" onclick="postActions.deletePost('${post.id}')"><i class="fa-solid fa-trash"></i> Xóa</button>
                                ` : `
                                    <button onclick="postActions.reportPost('${post.id}', '${post.authorId}')"><i class="fa-solid fa-flag"></i> Báo cáo</button>
                                `}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="post-body">${post.content}</div>
            ${post.featuredImageUrl ? `<div class="post-media"><img src="${post.featuredImageUrl}"></div>` : ''}
            <div class="post-actions">
                <div class="action-item ${post.isLikedByMe ? 'liked' : ''}" onclick="postActions.toggleLike('${post.id}', this)">
                    <i class="${post.isLikedByMe ? 'fa-solid' : 'fa-regular'} fa-heart" ${post.isLikedByMe ? 'style="color:#EF4444"' : ''}></i>
                    <span>${post.likeCount}</span>
                </div>
                <div class="action-item" onclick="postActions.toggleComments('${post.id}', this.closest('.post-card'))">
                    <i class="fa-regular fa-comment"></i>
                    <span>${post.commentCount}</span>
                </div>
            </div>
        </div>
    `;
    return card;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}

function toggleMenu(btn) {
    const menu = btn.nextElementSibling;
    menu.classList.toggle('hidden');
}
