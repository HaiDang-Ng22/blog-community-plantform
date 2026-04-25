// js/home.js
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth for quick post
    const token = localStorage.getItem('auth_token');
    if (!token) {
        document.getElementById('quick-post-container').classList.add('hidden');
    }

    await loadPosts();
});

async function loadPosts() {
    const grid = document.getElementById('posts-grid');
    const noPosts = document.getElementById('no-posts');
    
    try {
        const posts = await window.api.get('posts');
        grid.innerHTML = '';
        
        if (posts.length === 0) {
            noPosts.classList.remove('hidden');
            return;
        }

        noPosts.classList.add('hidden');
        posts.forEach(post => {
            grid.appendChild(createPostCard(post));
        });
    } catch (error) {
        grid.innerHTML = `<p class="error">Không thể tải bài viết: ${error.message}</p>`;
    }
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card animate-up';
    card.dataset.id = post.id;

    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
    const isOwner = currentUser.id === post.authorId;

    // Use ImageUrls if available, otherwise fallback to FeaturedImageUrl
    const images = post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.featuredImageUrl ? [post.featuredImageUrl] : []);
    const hasMultiple = images.length > 1;

    const hasImages = images.length > 0;

    if (!hasImages) {
        // Threads Style: Avatar on left, content on right
        card.classList.add('threads-style');
        card.innerHTML = `
            <div class="threads-container" style="display: flex; gap: 12px; padding: 12px;">
                <div class="threads-left" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <img src="${post.authorAvatarUrl || 'https://ui-avatars.com/api/?name=' + post.authorName}" class="mini-avatar" alt="Avatar" style="width: 44px; height: 44px;">
                    <div class="threads-line" style="flex: 1; width: 2px; background: #efefef; border-radius: 1px;"></div>
                </div>
                <div class="threads-right" style="flex: 1;">
                    <div class="post-header" style="padding: 0; margin-bottom: 4px; border: none; display: flex; justify-content: space-between; align-items: center;">
                        <div class="author-info">
                            <a href="profile.html?id=${post.authorId}" class="author-name" style="font-weight: 700; font-size: 0.95rem;">${post.authorName}</a>
                            <span class="post-time" style="margin-left: 8px; color: #8e8e8e; font-size: 0.85rem;">${formatDate(post.createdAt)}</span>
                        </div>
                        ${currentUser.id ? `
                            <div class="post-options">
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
                    <div class="post-content" style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); margin-bottom: 12px; word-break: break-word;">
                        ${window.common.autoLink(post.content)}
                    </div>
                    <div class="post-actions" style="padding: 0; gap: 16px;">
                        <button class="action-btn ${post.isLikedByMe ? 'liked' : ''}" onclick="postActions.toggleLike('${post.id}', this)" style="padding: 0; font-size: 1.2rem;">
                            <i class="${post.isLikedByMe ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        </button>
                        <button class="action-btn" onclick="postActions.toggleComments('${post.id}', this.closest('.post-card'))" style="padding: 0; font-size: 1.2rem;">
                            <i class="fa-regular fa-comment"></i>
                        </button>
                        <button class="action-btn" style="padding: 0; font-size: 1.2rem;">
                            <i class="fa-regular fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="post-stats" style="margin-top: 8px; font-size: 0.85rem; color: #8e8e8e;">
                        <span class="post-likes-count">${post.likeCount} lượt thích</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Instagram Style: Header, Large Media, Actions, Caption
        card.classList.add('instagram-style');
        card.innerHTML = `
            <div class="post-header" style="padding: 12px; border-bottom: none;">
                <img src="${post.authorAvatarUrl || 'https://ui-avatars.com/api/?name=' + post.authorName}" class="mini-avatar" alt="Avatar" style="width: 32px; height: 32px;">
                <div class="author-info">
                    <a href="profile.html?id=${post.authorId}" class="author-name" style="font-weight: 600; font-size: 0.9rem;">${post.authorName}</a>
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

            <div class="post-media-container" style="position:relative; background: #fafafa; min-height: 300px; display: flex; align-items: center;">
                ${hasMultiple ? `<button class="carousel-nav-btn left" onclick="scrollCarousel(this, -1)"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
                
                <div class="post-carousel" onscroll="handleCarouselScroll(this)">
                    ${images.map(url => `
                        <div class="post-carousel-item">
                            <img src="${url}" alt="Post Image" loading="lazy" style="width: 100%; aspect-ratio: 1/1; object-fit: cover;">
                        </div>
                    `).join('')}
                </div>
                
                ${hasMultiple ? `<button class="carousel-nav-btn right" onclick="scrollCarousel(this, 1)"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
 
                ${hasMultiple ? `
                    <div class="carousel-dots">
                        ${images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="post-actions" style="padding: 12px 12px 8px; gap: 16px;">
                <button class="action-btn ${post.isLikedByMe ? 'liked' : ''}" onclick="postActions.toggleLike('${post.id}', this)" style="padding: 0; font-size: 1.4rem;">
                    <i class="${post.isLikedByMe ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
                <button class="action-btn" onclick="postActions.toggleComments('${post.id}', this.closest('.post-card'))" style="padding: 0; font-size: 1.4rem;">
                    <i class="fa-regular fa-comment"></i>
                </button>
                <button class="action-btn" style="padding: 0; font-size: 1.4rem;">
                    <i class="fa-regular fa-paper-plane"></i>
                </button>
            </div>

            <div class="post-content-area" style="padding: 0 12px 12px;">
                <div class="post-likes-count" style="font-weight: 700; font-size: 0.9rem; margin-bottom: 6px;">${post.likeCount} lượt thích</div>
                <div class="post-caption" style="font-size: 0.9rem; line-height: 1.4; word-break: break-word;">
                    <a href="profile.html?id=${post.authorId}" class="author-name" style="font-weight: 700; margin-right: 6px; text-decoration: none; color: inherit;">${post.authorName}</a>
                    ${window.common.autoLink(post.content)}
                </div>
                <div class="post-time" style="margin-top: 6px; font-size: 0.75rem; color: #8e8e8e; text-transform: uppercase;">${formatDate(post.createdAt)}</div>
            </div>
        `;
    }
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
function handleCarouselScroll(carousel) {
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
