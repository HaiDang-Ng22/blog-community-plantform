// js/home.js v2.1
let currentFeedType = 'discover';

document.addEventListener('DOMContentLoaded', async () => {
    if (window.common && window.common.requireAuth) {
        const ok = window.common.requireAuth({ returnTo: 'index.html' + window.location.search + window.location.hash });
        if (!ok) return;
    }

    const token = localStorage.getItem('auth_token');
    const quickPost = document.getElementById('quick-post-auth-only');
    const userWidget = document.getElementById('user-sidebar-widget');

    if (token) {
        const user = JSON.parse(localStorage.getItem('user_info') || '{}');
        const avatarUrl = user.avatarUrl
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=random`;

        // Quick post avatar
        const quickAvatar = document.getElementById('quick-post-avatar');
        if (quickAvatar) quickAvatar.src = avatarUrl;
        if (quickPost) quickPost.style.display = 'flex';

        // Right sidebar user widget
        if (userWidget) {
            userWidget.classList.remove('hidden');
            const sidebarAvatar = document.getElementById('sidebar-user-avatar');
            if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
            const nameEl = document.getElementById('sidebar-user-name');
            if (nameEl) nameEl.textContent = user.fullName || user.username || '';
            const usernameEl = document.getElementById('sidebar-user-username');
            if (usernameEl) {
                const uname = user.username || user.Username || user.email?.split('@')[0] || '';
                usernameEl.textContent = '@' + uname;
            }
        }

        loadSuggestions();
    } else {
        if (quickPost) quickPost.style.display = 'none';
        if (userWidget) userWidget.classList.add('hidden');
    }

    // Tab listeners
    document.querySelectorAll('.home-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.home-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFeedType = tab.dataset.type;
            loadPosts(currentFeedType);
        });
    });

    await loadPosts('discover');

    // Handle deep-linking from notifications (URL param ?postId=...)
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('postId');
    if (postId && window.common && window.common.openPostModalByPostId) {
        // Wait a bit for the page to be ready
        setTimeout(() => {
            window.common.openPostModalByPostId(postId);
        }, 500);
    }
});

async function loadPosts(type = 'discover') {
    const grid = document.getElementById('posts-grid');
    const noPosts = document.getElementById('no-posts');
    if (!grid) return;

    grid.innerHTML = [480, 320, 460].map(h =>
        `<div class="post-card skeleton" style="height:${h}px;"></div>`
    ).join('');
    if (noPosts) noPosts.classList.add('hidden');

    try {
        const posts = await window.api.get(`posts?type=${type}`);
        grid.innerHTML = '';

        if (!posts || posts.length === 0) {
            if (noPosts) noPosts.classList.remove('hidden');
            return;
        }

        posts.forEach(post => {
            grid.appendChild(window.common.createPostCard(post));
        });

        // Hash-based scroll for notification links
        if (window.location.hash && window.location.hash.startsWith('#post-')) {
            const targetId = window.location.hash.substring(1);
            setTimeout(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.transition = 'box-shadow 0.5s';
                    el.style.boxShadow = '0 0 0 3px rgba(0,149,246,0.5)';
                    setTimeout(() => el.style.boxShadow = '', 2000);
                }
            }, 500);
        }
    } catch (err) {
        grid.innerHTML = `
            <div style="text-align:center;padding:3rem;color:#8e8e8e;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;display:block;margin-bottom:1rem;"></i>
                <p>Không thể tải bài viết. Vui lòng thử lại.</p>
            </div>`;
        console.error('Load posts error:', err);
    }
}

async function loadSuggestions() {
    const list = document.getElementById('suggestions-list');
    if (!list) return;

    try {
        const users = await window.api.get('users/suggested');
        list.innerHTML = '';

        if (!users || users.length === 0) {
            list.innerHTML = '<p style="font-size:0.82rem;color:#8e8e8e;text-align:center;padding:8px 0;">Không có gợi ý mới.</p>';
            return;
        }

        users.forEach(user => {
            const avatar = user.avatarUrl
                || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=random`;
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <img src="${avatar}" alt="${user.fullName}" class="suggestion-avatar">
                <div class="sugg-info">
                    <a href="profile.html?id=${user.id}" class="sugg-name" style="text-decoration:none;">${user.fullName}</a>
                    <span class="sugg-username">@${user.username}</span>
                </div>
                <button class="follow-btn" onclick="followUser('${user.id}', this)">Theo dõi</button>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        console.error('Load suggestions error:', err);
        if (list) list.innerHTML = '';
    }
}

window.followUser = async function(userId, btn) {
    try {
        btn.disabled = true;
        btn.textContent = '...';
        const res = await window.api.post(`users/${userId}/follow`);
        btn.textContent = res.isFollowing ? 'Đã theo dõi' : 'Theo dõi';
        btn.style.color = res.isFollowing ? '#8e8e8e' : '#0095f6';
        if (res.isFollowing && currentFeedType === 'following') loadPosts('following');
    } catch (err) {
        btn.textContent = 'Theo dõi';
    } finally {
        btn.disabled = false;
    }
};

// Legacy aliases
window.followFromSuggestion = window.followUser;
function formatDate(d) { return window.common ? window.common.formatDate(d) : d; }
function toggleMenu(b) { if (window.common) window.common.toggleMenu(b); }
