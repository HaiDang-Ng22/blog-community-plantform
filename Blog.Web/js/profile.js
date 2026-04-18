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
    card.className = 'post-card animate-up';
    card.dataset.id = post.id;

    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
    const isOwner = currentUser.id === post.authorId;

    // Use ImageUrls if available, otherwise fallback to FeaturedImageUrl
    const images = post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.featuredImageUrl ? [post.featuredImageUrl] : []);
    const hasMultiple = images.length > 1;

    card.innerHTML = `
        <div class="post-header">
            <img src="${post.authorAvatarUrl || 'https://ui-avatars.com/api/?name=' + post.authorName}" class="mini-avatar" alt="Avatar">
            <div class="author-info">
                <a href="profile.html?id=${post.authorId}" class="author-name">${post.authorName}</a>
            </div>
            ${currentUser.id ? `
                <div class="post-options" style="margin-left: auto;">
                    <i class="fa-solid fa-ellipsis options-btn" onclick="toggleMenu(this)" style="cursor:pointer; color:#8e8e8e;"></i>
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

        ${images.length > 0 ? `
            <div class="post-media-container" style="position:relative;">
                ${hasMultiple ? `<button class="carousel-nav-btn left" onclick="window.scrollCarousel(this, -1)"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
                
                <div class="post-carousel" onscroll="window.handleCarouselScroll(this)">
                    ${images.map(url => `
                        <div class="post-carousel-item">
                            <img src="${url}" alt="Post Image" loading="lazy">
                        </div>
                    `).join('')}
                </div>
                
                ${hasMultiple ? `<button class="carousel-nav-btn right" onclick="window.scrollCarousel(this, 1)"><i class="fa-solid fa-chevron-right"></i></button>` : ''}

                ${hasMultiple ? `
                    <div class="carousel-dots">
                        ${images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
                    </div>
                ` : ''}
            </div>
        ` : ''}

        <div class="post-actions">
            <button class="action-btn ${post.isLikedByMe ? 'liked' : ''}" onclick="postActions.toggleLike('${post.id}', this)">
                <i class="${post.isLikedByMe ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <button class="action-btn" onclick="postActions.toggleComments('${post.id}', this.closest('.post-card'))">
                <i class="fa-regular fa-comment"></i>
            </button>
            <button class="action-btn">
                <i class="fa-regular fa-paper-plane"></i>
            </button>
        </div>

        <div class="post-content-area">
            <div class="post-likes-count">${post.likeCount} lượt thích</div>
            <div class="post-caption">
                <span class="author-name">${post.authorName}</span>
                <span class="post-title" style="font-weight:600; display:block; margin: 4px 0;">${post.title}</span>
                ${post.content}
            </div>
            <div class="post-time">${formatDate(post.createdAt)}</div>
        </div>
    `;
    return card;
}

// Global function to scroll carousel
window.scrollCarousel = function(btn, direction) {
    const container = btn.parentElement.querySelector('.post-carousel');
    if (container) {
        const width = container.offsetWidth;
        container.scrollBy({ left: direction * width, behavior: 'smooth' });
    }
}

// Global function to update carousel dots
window.handleCarouselScroll = function(carousel) {
    const scrollLeft = carousel.scrollLeft;
    const width = carousel.offsetWidth;
    const index = Math.round(scrollLeft / width);
    
    const dots = carousel.parentElement.querySelectorAll('.carousel-dots .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function toggleMenu(btn) {
    const menu = btn.nextElementSibling;
    menu.classList.toggle('hidden');
    // Hide when clicking outside
    const closeMenu = (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    return date.toLocaleDateString('vi-VN');
}
