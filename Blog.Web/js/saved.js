document.addEventListener('DOMContentLoaded', () => {
    window.common.requireAuth();
    loadCollections();
    loadSavedPosts();
});

let currentCollection = "";

async function loadCollections() {
    try {
        const collections = await window.api.get('SavedPosts/collections');
        const list = document.getElementById('collections-list');
        
        collections.forEach(c => {
            if (c === "Mặc định") return;
            const chip = document.createElement('div');
            chip.className = 'collection-chip';
            chip.textContent = c;
            chip.dataset.collection = c;
            chip.onclick = () => selectCollection(c, chip);
            list.appendChild(chip);
        });
    } catch (e) {
        console.error("Failed to load collections", e);
    }
}

async function loadSavedPosts() {
    const feed = document.getElementById('saved-feed');
    feed.innerHTML = '<div class="loader-container" style="padding: 3rem; text-align: center;"><i class="fa-solid fa-spinner fa-spin fa-2xl"></i></div>';
    
    try {
        const url = currentCollection ? `SavedPosts?collection=${encodeURIComponent(currentCollection)}` : 'SavedPosts';
        const posts = await window.api.get(url);
        
        feed.innerHTML = '';
        if (posts.length === 0) {
            feed.innerHTML = `
                <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
                    <i class="fa-regular fa-bookmark" style="font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.3;"></i>
                    <p>Bạn chưa lưu bài viết nào${currentCollection ? ' trong bộ sưu tập này' : ''}.</p>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const card = window.common.createPostCard(post);
            feed.appendChild(card);
        });
    } catch (e) {
        feed.innerHTML = '<p class="error-msg">Lỗi khi tải bài viết đã lưu.</p>';
    }
}

function selectCollection(name, chipEl) {
    currentCollection = name;
    document.querySelectorAll('.collection-chip').forEach(c => c.classList.remove('active'));
    
    if (chipEl) {
        chipEl.classList.add('active');
    } else {
        document.querySelector('[data-collection=""]').classList.add('active');
    }
    
    loadSavedPosts();
}

// Global listener for unsaving
window.addEventListener('postUnsaved', (e) => {
    const postId = e.detail.postId;
    const card = document.getElementById(`post-${postId}`);
    if (card && window.location.pathname.includes('saved.html')) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => card.remove(), 400);
    }
});
