// js/search.js
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (!query) {
        document.getElementById('search-title').textContent = window.t('search_query_empty');
        return;
    }

    document.getElementById('search-title').textContent = `${window.t('search_results_for')} "${query}"`;
    await performSearch(query);
});

async function performSearch(query) {
    const usersList = document.getElementById('users-results-list');
    const postsList = document.getElementById('posts-results-list');

    try {
        const results = await window.api.get(`search?q=${encodeURIComponent(query)}`);
        
        // Render Users
        const usersSection = usersList.closest('.search-section');
        if (results.users.length === 0) {
            usersSection.classList.add('hidden');
        } else {
            usersSection.classList.remove('hidden');
            usersList.innerHTML = '';
            results.users.forEach(user => {
                const card = document.createElement('div');
                card.className = 'user-result-card';
                card.onclick = () => window.location.href = `profile.html?id=${user.id}`;
                
                const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;
                
                card.innerHTML = `
                    <img src="${avatar}" alt="Avatar">
                    <div class="user-result-info">
                        <h4>${user.fullName}</h4>
                        <p>@${user.username}</p>
                        ${user.bio ? `<p class="bio-preview">${user.bio.substring(0, 60)}...</p>` : ''}
                    </div>
                `;
                usersList.appendChild(card);
            });
        }

        // Render Posts
        const postsSection = postsList.closest('.search-section');
        if (results.posts.length === 0) {
            postsSection.classList.add('hidden');
        } else {
            postsSection.classList.remove('hidden');
            postsList.innerHTML = '';
            results.posts.forEach(post => {
                const card = document.createElement('div');
                card.className = 'post-result-card';
                
                const authorAvatar = post.authorAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=random`;
                const postContent = post.content || post.summary || '';
                const hasImage = !!(post.featuredImageUrl || post.FeaturedImageUrl);
                const postTime = timeAgo(post.createdAt);

                if (!hasImage) {
                    // Layout 1: Blog style (Text only)
                    card.innerHTML = `
                        <div class="post-header">
                            <div class="post-author-info">
                                <img src="${authorAvatar}" alt="Avatar">
                                <span>${post.authorName}</span>
                                <span style="color: #8e8e8e; font-weight: 400; margin-left: 5px;">${postTime}</span>
                            </div>
                            <div class="post-more"><i class="fa fa-ellipsis-h"></i></div>
                        </div>
                        <div class="post-body-text" style="padding: 0 16px 12px 16px; font-size: 0.95rem; line-height: 1.5; color: #262626;">
                            ${window.common && window.common.autoLink ? window.common.autoLink(postContent) : postContent}
                        </div>
                        <div class="post-footer">
                            <div class="post-actions">
                                <i class="fa-regular fa-heart"></i>
                                <i class="fa-regular fa-comment"></i>
                                <i class="fa-regular fa-paper-plane"></i>
                            </div>
                            <div class="post-likes">
                                ${post.likeCount || 0} lượt thích
                            </div>
                        </div>
                    `;
                } else {
                    // Layout 2: Image style
                    card.innerHTML = `
                        <div class="post-header">
                            <div class="post-author-info">
                                <img src="${authorAvatar}" alt="Avatar">
                                <span>${post.authorName}</span>
                            </div>
                            <div class="post-more"><i class="fa fa-ellipsis-h"></i></div>
                        </div>
                        
                        <div class="post-image" onclick="window.location.href='index.html?postId=${post.id}'">
                            <img src="${post.featuredImageUrl || post.FeaturedImageUrl}" alt="Post Content">
                        </div>

                        <div class="post-footer">
                            <div class="post-actions">
                                <i class="fa-regular fa-heart"></i>
                                <i class="fa-regular fa-comment"></i>
                                <i class="fa-regular fa-paper-plane"></i>
                            </div>
                            <div class="post-likes">
                                ${post.likeCount || 0} lượt thích
                            </div>
                            <div class="post-caption">
                                <span class="author-name">${post.authorName}</span>
                                <span class="post-result-content">${window.common && window.common.autoLink ? window.common.autoLink(postContent) : postContent}</span>
                            </div>
                            <div class="post-time">
                                ${postTime}
                            </div>
                        </div>
                    `;
                }
                postsList.appendChild(card);
            });
        }

        // Final check: if both hidden, show "No results found" for everything
        if (results.users.length === 0 && results.posts.length === 0) {
            const container = document.querySelector('.search-results-container');
            container.innerHTML = `
                <div class="no-results">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    ${window.t('no_results_found')}
                </div>
            `;
        }

    } catch (error) {
        console.error('Search failed', error);
        const errorMsg = `Lỗi khi thực hiện tìm kiếm: ${error.message || 'Unknown error'}. 
            Vui lòng kiểm tra console hoặc đảm bảo Server đang chạy tại :7000`;
        usersList.innerHTML = `<p class="error">${errorMsg}</p>`;
        postsList.innerHTML = `<p class="error">${errorMsg}</p>`;
    }
}

function timeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " năm trước";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " tháng trước";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " ngày trước";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " giờ trước";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " phút trước";
    return "vừa xong";
}
