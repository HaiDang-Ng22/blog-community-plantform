// js/profile.js
let currentProfileId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
    const currentUserId = (currentUser.id || currentUser.Id || '').toString();

    // Nếu không có ID trong URL và không đăng nhập -> qua trang login
    if (!userId && !localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    currentProfileId = userId || currentUserId;

    // Chuẩn hóa URL khi xem hồ sơ của chính mình để luôn có ?id=
    if (!userId && currentUserId) {
        const nextUrl = `profile.html?id=${encodeURIComponent(currentUserId)}`;
        window.history.replaceState({}, '', nextUrl);
    }

    if (currentProfileId) {
        const profileData = await loadUserProfile(currentProfileId);
        if (profileData) {
            const isMyProfile = currentUserId.toLowerCase() === currentProfileId.toString().toLowerCase();
            await loadUserPosts(currentProfileId, profileData.isPrivate, profileData.isFollowing, isMyProfile);
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

    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.getElementById(`${tabName}-container`).classList.add('active');

    if (tabName === 'friends') {
        await loadFriendsList();
    }
}

async function loadFriendsList() {
    const grid = document.getElementById('friends-grid');
    const noUsers = document.getElementById('no-friends');
    grid.innerHTML = '<div class="loading-spinner"></div>';
    noUsers.classList.add('hidden');

    try {
        const users = await window.api.get(`users/${currentProfileId}/friends`);
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

window.openUserListModal = async function(type) {
    const modal = document.getElementById('user-list-modal');
    const content = document.getElementById('user-list-modal-content');
    const title = document.getElementById('user-list-modal-title');
    
    title.textContent = type === 'followers' ? 'Người theo dõi' : 'Đang theo dõi';
    content.innerHTML = '<div class="loading-spinner"></div>';
    modal.classList.remove('hidden');
    
    try {
        const users = await window.api.get(`users/${currentProfileId}/${type}`);
        content.innerHTML = '';
        if (users.length === 0) {
            content.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">Danh sách trống</div>';
            return;
        }
        
        users.forEach(user => {
            const card = document.createElement('div');
            card.style = "display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);";
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap: 12px; cursor: pointer;" onclick="window.location.href='profile.html?id=${user.id}'">
                    <img src="${user.avatarUrl || 'https://ui-avatars.com/api/?name=' + user.fullName}" style="width:44px; height:44px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-weight:600; color:var(--text-primary); font-size:0.95rem;">${user.fullName}</div>
                        <div style="font-size:0.85rem; color:var(--text-secondary);">@${user.username}</div>
                    </div>
                </div>
                <button class="btn secondary-btn" style="padding: 5px 12px; font-size: 0.85rem;" onclick="window.location.href='profile.html?id=${user.id}'">Xem</button>
            `;
            content.appendChild(card);
        });
    } catch(e) {
        content.innerHTML = '<div class="error">Lỗi tải danh sách.</div>';
    }
}

async function loadUserProfile(userId) {
    try {
        const profile = await window.api.get(`users/${userId}/profile`);
        const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
        
        const currentId = (currentUser.id || currentUser.Id || '').toString().toLowerCase();
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
        
        // Load and show stories if exist
        loadAndShowUserStories(userId);

        document.getElementById('profile-bio').textContent = profile.bio || 'Chưa có tiểu sử.';
        document.getElementById('follower-count').textContent = profile.followerCount;
        document.getElementById('following-count').textContent = profile.followingCount;

        const profileIdEl = document.getElementById('profile-id');
        if (profileIdEl) {
            if (isMyProfile && profile.id) {
                profileIdEl.textContent = `ID: ${profile.id}`;
                profileIdEl.classList.remove('hidden');
            } else {
                profileIdEl.classList.add('hidden');
                profileIdEl.textContent = '';
            }
        }
        
        const friendsTabBtn = document.getElementById('friends-tab-btn');
        const followBtn = document.getElementById('follow-btn');
        if (isMyProfile) {
            friendsTabBtn.classList.remove('hidden');
            followBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa hồ sơ';
            followBtn.className = 'btn secondary-btn';
            followBtn.onclick = () => window.location.href = 'settings.html';
            document.getElementById('message-btn').classList.add('hidden');
        } else {
            friendsTabBtn.classList.add('hidden');
            updateFollowButton(profile.isFollowing);
            followBtn.onclick = () => toggleFollow(userId);
            
            const messageBtn = document.getElementById('message-btn');
            messageBtn.classList.remove('hidden');
            messageBtn.onclick = () => window.location.href = `messages.html?with=${userId}`;
        }
        
        return profile;
    } catch (error) {
        console.error('Failed to load profile', error);
        document.getElementById('profile-name').textContent = 'Lỗi tải hồ sơ';
        document.getElementById('profile-bio').textContent = 'Có thể người dùng không tồn tại hoặc bạn cần đăng nhập lại.';
        return null;
    }
}

async function loadAndShowUserStories(userId) {
    try {
        const stories = await window.api.get(`stories/user/${userId}`);
        if (stories && stories.length > 0) {
            const avatar = document.getElementById('profile-avatar');
            const avatarContainer = avatar.parentElement;
            
            // Add gradient ring
            avatarContainer.style.position = 'relative';
            avatarContainer.style.padding = '4px';
            avatarContainer.style.background = 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
            avatarContainer.style.borderRadius = '50%';
            avatarContainer.style.cursor = 'pointer';
            
            // Check if viewed
            const viewed = JSON.parse(localStorage.getItem('zynk_viewed_stories') || '[]');
            const allViewed = stories.every(s => viewed.includes(s.id));
            if (allViewed) {
                avatarContainer.style.background = '#dbdbdb';
            }

            avatarContainer.onclick = () => {
                if (window.openStoryViewer) {
                    window.openStoryViewer(stories);
                }
            };
        }
    } catch (err) {
        console.error('Load user stories error:', err);
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
    const galleryGrid = document.getElementById('profile-posts-grid');
    const notesGrid = document.getElementById('profile-text-posts-feed');
    
    galleryGrid.innerHTML = '<div class="post-card skeleton animate-up"></div>';
    notesGrid.innerHTML = '';

    // Xử lý Private Account Lockdown
    if (!isMyProfile && isPrivate && !isFollowing) {
        document.getElementById('post-count').textContent = '?';
        const lockdownHtml = `
            <div style="text-align:center; padding: 4rem 2rem; background: var(--card-bg); border-radius: 1rem; border: 1px solid var(--border-color); margin-top: 1rem; grid-column: 1 / -1;">
                <div style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #64748b; display: flex; align-items:center; justify-content:center; margin: 0 auto 1.5rem;">
                    <i class="fa-solid fa-lock" style="font-size: 2.5rem; color: #64748b;"></i>
                </div>
                <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Tài khoản này là riêng tư</h3>
                <p style="color: var(--text-secondary); font-size: 0.95rem;">Theo dõi để xem ảnh và bài viết của họ.</p>
            </div>
        `;
        galleryGrid.innerHTML = lockdownHtml;
        notesGrid.innerHTML = lockdownHtml;
        return;
    }

    try {
        const userPostsRaw = await window.api.get(`posts/user/${userId}`);
        const userPosts = (userPostsRaw || []).map(p => {
            const normalized = { ...p };
            normalized.id = p.id || p.Id;
            normalized.authorId = p.authorId || p.AuthorId || userId;
            normalized.authorName = p.authorName || p.AuthorName || document.getElementById('profile-name')?.textContent?.trim() || 'Người dùng';
            normalized.authorAvatarUrl = p.authorAvatarUrl || p.AuthorAvatarUrl || document.getElementById('profile-avatar')?.src || '';

            const imageUrls = p.imageUrls || p.ImageUrls;
            if (Array.isArray(imageUrls)) {
                normalized.imageUrls = imageUrls.filter(Boolean);
            } else if (!normalized.imageUrls) {
                normalized.imageUrls = [];
            }
            return normalized;
        });

        galleryGrid.innerHTML = '';
        notesGrid.innerHTML = '';
        
        document.getElementById('post-count').textContent = userPosts.length;
        
        if (userPosts.length === 0) {
            document.getElementById('no-gallery-posts').classList.remove('hidden');
            document.getElementById('no-text-posts').classList.remove('hidden');
            return;
        }

        // Sắp xếp bài viết mới nhất lên đầu
        userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const imagePosts = userPosts.filter(p => p.featuredImageUrl || (p.imageUrls && p.imageUrls.length > 0));
        const textPosts = userPosts.filter(p => !p.featuredImageUrl && (!p.imageUrls || p.imageUrls.length === 0));

        if (imagePosts.length === 0) {
            document.getElementById('no-gallery-posts').classList.remove('hidden');
        } else {
            document.getElementById('no-gallery-posts').classList.add('hidden');
            imagePosts.forEach(post => {
                const square = document.createElement('div');
                square.className = 'ig-post-square animate-up';
                
                let thumbUrl = post.featuredImageUrl || (post.imageUrls && post.imageUrls[0]);
                let hasMultiple = (post.imageUrls && post.imageUrls.length > 1);
                
                square.innerHTML = `
                    <img src="${thumbUrl}" alt="Post thumbnail" loading="lazy">
                    ${hasMultiple ? '<i class="fa-solid fa-clone" style="position:absolute; top: 8px; right: 8px; color: white; text-shadow: 0 0 4px rgba(0,0,0,0.5);"></i>' : ''}
                    <div class="ig-post-overlay">
                        <span><i class="fa-solid fa-heart"></i> ${post.likeCount || 0}</span>
                        <span><i class="fa-solid fa-comment"></i> ${post.commentCount || 0}</span>
                    </div>
                `;
                
                square.onclick = () => openPostModal(post);
                galleryGrid.appendChild(square);
            });
        }

        if (textPosts.length === 0) {
            document.getElementById('no-text-posts').classList.remove('hidden');
        } else {
            document.getElementById('no-text-posts').classList.add('hidden');
            textPosts.forEach(post => {
                if (window.common && window.common.createPostCard) {
                    notesGrid.appendChild(window.common.createPostCard(post));
                } else {
                    console.warn("window.common.createPostCard not ready, retrying...");
                    setTimeout(() => notesGrid.appendChild(window.common.createPostCard(post)), 100);
                }
            });
        }
    } catch (error) {
        galleryGrid.innerHTML = '<p class="error">Lỗi khi tải bài viết.</p>';
        console.error(error);
    }
}

function formatDate(dateStr) { return window.common.formatDate(dateStr); }
function toggleMenu(btn) { window.common.toggleMenu(btn); }
