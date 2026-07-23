document.addEventListener('DOMContentLoaded', () => {
    loadReels();
    setupVideoObserver();
});

async function loadReels() {
    const feed = document.getElementById('reels-feed');
    try {
        // We filter posts by type "Reel"
        const posts = await window.api.get('posts?type=discover');
        const reels = posts.filter(p => p.type === 'Reel' || (p.videoUrl && p.videoUrl.length > 0));
        
        feed.innerHTML = '';
        if (reels.length === 0) {
            feed.innerHTML = `
                <div class="reel-item">
                    <div style="color: white; text-align: center; padding: 20px;">
                        <i class="fa-solid fa-play" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Chưa có Reels nào để hiển thị.</p>
                        <a href="create-post.html" class="btn primary-btn" style="margin-top: 1rem; display: inline-block;">Tạo Reel ngay</a>
                    </div>
                </div>
            `;
            return;
        }

        reels.forEach(reel => {
            const item = createReelItem(reel);
            feed.appendChild(item);
        });
    } catch (e) {
        feed.innerHTML = '<p style="color: white; padding: 20px;">Lỗi tải Reels.</p>';
    }
}

function createReelItem(reel) {
    const div = document.createElement('div');
    div.className = 'reel-item';
    div.dataset.id = reel.id;

    const isLiked = reel.isLikedByMe;
    const isSaved = reel.isSavedByMe;

    div.innerHTML = `
        <video class="reel-video" preload="metadata" loop playsinline src="${reel.videoUrl || reel.imageUrls[0]}"></video>
        <div class="reel-progress-bar"></div>
        
        <div class="reel-overlay">
            <div class="reel-user">
                <img src="${reel.authorAvatarUrl || 'https://ui-avatars.com/api/?name=U'}" class="reel-avatar">
                <span class="reel-username">${reel.authorName}</span>
                <button class="reel-follow-btn">Theo dõi</button>
            </div>
            <div class="reel-caption">${window.common.autoLink(reel.content)}</div>
        </div>

        <div class="reel-actions">
            <button class="reel-action-btn ${isLiked ? 'liked' : ''}" onclick="window.postActions.toggleLike('${reel.id}', this)">
                <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                <span>${reel.likeCount}</span>
            </button>
            <button class="reel-action-btn" onclick="showReelComments('${reel.id}')">
                <i class="fa-regular fa-comment"></i>
                <span class="comment-count-${reel.id}">${reel.commentCount}</span>
            </button>
            <button class="reel-action-btn" onclick="window.common.openShareModal('${reel.id}')">
                <i class="fa-regular fa-paper-plane"></i>
            </button>
            <button class="reel-action-btn ${isSaved ? 'saved' : ''}" onclick="window.postActions.toggleSave('${reel.id}', this)">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
            </button>
        </div>
    `;

    const video = div.querySelector('video');
    const progressBar = div.querySelector('.reel-progress-bar');

    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const percent = (video.currentTime / video.duration) * 100;
            progressBar.style.width = `${percent}%`;
        }
    });

    video.addEventListener('click', (e) => {
        e.stopPropagation();
        if (video.paused) {
            video.play().catch(err => console.log(err));
            showPlayOverlayAnimation(div, 'play');
        } else {
            video.pause();
            showPlayOverlayAnimation(div, 'pause');
        }
    });

    return div;
}

function showPlayOverlayAnimation(itemEl, state) {
    let overlay = itemEl.querySelector('.play-pause-animation');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'play-pause-animation';
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            background: rgba(0, 0, 0, 0.6);
            color: white;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: none;
            z-index: 15;
        `;
        itemEl.appendChild(overlay);
    }
    
    overlay.innerHTML = state === 'play' ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    
    // Trigger animation
    setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.style.transform = 'translate(-50%, -50%) scale(1.1)';
    }, 10);
    
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transform = 'translate(-50%, -50%) scale(1.3)';
    }, 400);
}

// Reels Comment Drawer Operations
let currentReelCommentPostId = null;

async function showReelComments(postId) {
    currentReelCommentPostId = postId;
    const drawer = document.getElementById('reel-comments-drawer');
    const list = document.getElementById('reel-comments-list');
    const input = document.getElementById('reel-comment-input');
    
    input.value = '';
    drawer.classList.add('open');
    list.innerHTML = `
        <div style="text-align:center; padding:30px; color:#8e8e8e;">
            <i class="fa-solid fa-circle-notch fa-spin fa-lg"></i> Đang tải bình luận...
        </div>
    `;

    try {
        const comments = await window.api.get(`posts/${postId}/comments`);
        list.innerHTML = '';
        if (comments.length === 0) {
            list.innerHTML = '<p style="color:#8e8e8e; text-align:center; padding:20px; font-size:0.9rem;">Chưa có bình luận nào.</p>';
        } else {
            comments.forEach(c => {
                list.appendChild(window.postActions.renderCommentItem(c, postId));
            });
        }
    } catch (e) {
        list.innerHTML = '<p style="color:#8e8e8e; text-align:center; padding:20px; font-size:0.9rem;">Không thể tải bình luận.</p>';
    }
}

function closeReelComments() {
    const drawer = document.getElementById('reel-comments-drawer');
    if (drawer) drawer.classList.remove('open');
    currentReelCommentPostId = null;
}

async function submitReelComment() {
    if (!currentReelCommentPostId) return;
    const input = document.getElementById('reel-comment-input');
    const content = input.value.trim();
    if (!content) return;

    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    const btn = document.getElementById('reel-comment-submit');
    btn.disabled = true;

    try {
        const comment = await window.api.post(`posts/${currentReelCommentPostId}/comments`, { content });
        input.value = '';
        
        // Reload list
        await showReelComments(currentReelCommentPostId);
        
        // Update count badge on reel button
        const countSpan = document.querySelector(`.comment-count-${currentReelCommentPostId}`);
        if (countSpan) {
            const currentCount = parseInt(countSpan.textContent) || 0;
            countSpan.textContent = currentCount + 1;
        }
    } catch (e) {
        window.common.showToast(e.message || 'Lỗi khi gửi bình luận', 'error');
    } finally {
        btn.disabled = false;
    }
}

// Bind events to comments drawer inputs
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('reel-comment-submit');
    const inputField = document.getElementById('reel-comment-input');
    
    if (submitBtn) submitBtn.addEventListener('click', submitReelComment);
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitReelComment();
        });
    }
});

function setupVideoObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                // Respect global muted state (default: muted for autoplay policy)
                video.muted = typeof isMuted !== 'undefined' ? isMuted : true;
                video.play().catch(() => {
                    video.muted = true;
                    video.play();
                });
            } else {
                video.pause();
                video.currentTime = 0;
            }
        });
    }, { threshold: 0.8 });

    const feed = document.getElementById('reels-feed');
    const observerWrapper = new MutationObserver(() => {
        const items = document.querySelectorAll('.reel-item');
        items.forEach(item => observer.observe(item));
    });
    observerWrapper.observe(feed, { childList: true });
}
