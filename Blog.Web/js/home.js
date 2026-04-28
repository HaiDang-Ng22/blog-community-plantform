// js/home.js
let currentFeedType = 'discover';

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth for quick post
    const token = localStorage.getItem('auth_token');
    const quickPost = document.getElementById('quick-post-auth-only');
    const userWidget = document.getElementById('user-sidebar-widget');
    
    if (!token) {
        if (quickPost) quickPost.classList.add('hidden');
        if (userWidget) userWidget.classList.add('hidden');
    } else {
        const user = JSON.parse(localStorage.getItem('user_info') || '{}');
        // Update Sidebar User Info
        const avatarUrl = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;
        const sidebarAvatar = document.getElementById('sidebar-user-avatar');
        if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
        
        // Update Quick Post Avatar
        const quickAvatar = document.getElementById('quick-post-avatar');
        if (quickAvatar) quickAvatar.src = avatarUrl;

        const sidebarName = document.getElementById('sidebar-user-name');
        if (sidebarName) sidebarName.textContent = user.fullName;
        
        // Fix @undefined: check multiple possible field names
        const username = user.username || user.Username || user.email?.split('@')[0] || 'user';
        document.getElementById('sidebar-user-username').textContent = `@${username}`;
        
        if (userWidget) userWidget.classList.remove('hidden');
        
        loadSuggestions();
    }

    // Tab Listeners
    document.querySelectorAll('.feed-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFeedType = tab.dataset.type;
            loadPosts(currentFeedType);
        });
    });

    await loadPosts(currentFeedType);
});

async function loadPosts(type = 'discover') {
    const grid = document.getElementById('posts-grid');
    const noPosts = document.getElementById('no-posts');
    
    // Show skeleton
    grid.innerHTML = '<div class="post-card skeleton"></div>'.repeat(3);
    
    try {
        const posts = await window.api.get(`posts?type=${type}`);
        grid.innerHTML = '';
        
        if (posts.length === 0) {
            noPosts.classList.remove('hidden');
            return;
        }

        noPosts.classList.add('hidden');
        posts.forEach(post => {
            grid.appendChild(window.common.createPostCard(post));
        });

        // Handle hash navigation for notifications
        if (window.location.hash && window.location.hash.startsWith('#post-')) {
            const targetId = window.location.hash.substring(1); // remove '#'
            setTimeout(() => {
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetEl.style.transition = 'box-shadow 0.5s ease-in-out';
                    targetEl.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5)';
                    setTimeout(() => {
                        targetEl.style.boxShadow = '';
                    }, 2000);
                }
            }, 500); // Wait for DOM layout
        }
    } catch (error) {
        grid.innerHTML = `<p class="error">Không thể tải bài viết: ${error.message}</p>`;
    }
}

// Helper functions (wrappers for window.common)
function formatDate(dateStr) {
    return window.common.formatDate(dateStr);
}

function toggleMenu(btn) {
    window.common.toggleMenu(btn);
}

async function loadSuggestions() {
    const list = document.getElementById('suggestions-list');
    if (!list) return;

    try {
        const users = await window.api.get('users/suggested');
        list.innerHTML = '';

        if (users.length === 0) {
            list.innerHTML = '<p style="font-size: 0.8rem; color: #8e8e8e; text-align: center;">Không có gợi ý mới.</p>';
            return;
        }

        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <img src="${user.avatarUrl || 'https://ui-avatars.com/api/?name=' + user.fullName}" class="avatar-xs">
                <div class="user-meta">
                    <a href="profile.html?id=${user.id}" class="full-name" style="text-decoration:none; color:inherit;">${user.fullName}</a>
                    <span class="username">@${user.username}</span>
                </div>
                <button class="follow-btn" onclick="followFromSuggestion('${user.id}', this)">Theo dõi</button>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        console.error("Error loading suggestions:", err);
        list.innerHTML = '<p style="font-size: 0.8rem; color: #ed4956; text-align: center;">Lỗi tải gợi ý.</p>';
    }
}

window.followFromSuggestion = async function(userId, btn) {
    try {
        btn.disabled = true;
        btn.textContent = '...';
        const res = await window.api.post(`users/${userId}/follow`);
        if (res.isFollowing) {
            btn.textContent = 'Đã theo dõi';
            btn.style.color = '#8e8e8e';
            // Optional: refresh feed if on Following tab
            if (currentFeedType === 'following') loadPosts('following');
        } else {
            btn.textContent = 'Theo dõi';
            btn.style.color = '#0095f6';
        }
    } catch (err) {
        btn.textContent = 'Theo dõi';
    } finally {
        btn.disabled = false;
    }
}
