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
        <video class="reel-video" loop playsinline src="${reel.videoUrl || reel.imageUrls[0]}"></video>
        
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
            <button class="reel-action-btn" onclick="window.postActions.toggleComments('${reel.id}', this.closest('.reel-item'))">
                <i class="fa-regular fa-comment"></i>
                <span>${reel.commentCount}</span>
            </button>
            <button class="reel-action-btn" onclick="window.common.openShareModal('${reel.id}')">
                <i class="fa-regular fa-paper-plane"></i>
            </button>
            <button class="reel-action-btn ${isSaved ? 'saved' : ''}" onclick="window.postActions.toggleSave('${reel.id}', this)">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
            </button>
        </div>
    `;

    return div;
}

function setupVideoObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                video.play().catch(() => {
                    // Autoplay might be blocked without interaction
                    video.muted = true;
                    video.play();
                });
            } else {
                video.pause();
                video.currentTime = 0;
            }
        });
    }, { threshold: 0.8 });

    // We need to re-observe when new items are added
    const feed = document.getElementById('reels-feed');
    const observerWrapper = new MutationObserver(() => {
        const items = document.querySelectorAll('.reel-item');
        items.forEach(item => observer.observe(item));
    });
    observerWrapper.observe(feed, { childList: true });
}
