// js/stories.js
let storiesList = [];
let myStories = [];
let currentViewerStories = [];
let currentStoryIndex = 0;
let storyTimer = null;
let storyPaused = false;
let remainingTime = 7000;
let startTime = 0;
const STORY_DURATION = 7000;
let currentStoryType = 'Media';

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user_info') || '{}');
    const myAvatar = document.getElementById('my-story-avatar');
    if (myAvatar) {
        myAvatar.src = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=random`;
    }
    loadStories();
    loadMyStories();

    // Hold to pause logic
    const storyContent = document.getElementById('story-viewer-content');
    if (storyContent) {
        storyContent.addEventListener('mousedown', () => pauseStory());
        storyContent.addEventListener('touchstart', (e) => { e.preventDefault(); pauseStory(); });
        storyContent.addEventListener('mouseup', () => resumeStory());
        storyContent.addEventListener('touchend', () => resumeStory());
        storyContent.addEventListener('mouseleave', () => { if (storyPaused) resumeStory(); });
    }
});

function getViewedStories() {
    return JSON.parse(localStorage.getItem('zynk_viewed_stories') || '[]');
}

function markStoryAsViewed(storyId) {
    let viewed = getViewedStories();
    if (!viewed.includes(storyId)) {
        viewed.push(storyId);
        localStorage.setItem('zynk_viewed_stories', JSON.stringify(viewed));
    }
}

function isGroupViewed(stories) {
    const viewed = getViewedStories();
    return stories.every(s => viewed.includes(s.id));
}

function getLikedStories() {
    return JSON.parse(localStorage.getItem('zynk_liked_stories') || '[]');
}

window.toggleLikeStory = async function() {
    const story = currentViewerStories[currentStoryIndex];
    if (!story) return;
    const user = JSON.parse(localStorage.getItem('user_info') || '{}');
    if (story.userId === user.id) return;
    const btn = document.getElementById('story-like-btn');
    const icon = btn.querySelector('i');
    try {
        const res = await window.api.post(`stories/${story.id}/like`, {});
        const isLiked = res.liked;
        let liked = getLikedStories();
        if (isLiked) {
            if (!liked.includes(story.id)) liked.push(story.id);
            btn.classList.add('liked');
            icon.className = 'fa-solid fa-heart';
            showHeartBurst();
        } else {
            liked = liked.filter(id => id !== story.id);
            btn.classList.remove('liked');
            icon.className = 'fa-regular fa-heart';
        }
        localStorage.setItem('zynk_liked_stories', JSON.stringify(liked));
    } catch (err) {
        console.error('Toggle like error:', err);
    }
};

function showHeartBurst() {
    const container = document.getElementById('story-viewer-modal');
    const heart = document.createElement('div');
    heart.className = 'heart-burst';
    heart.innerHTML = '<i class="fa-solid fa-heart"></i>';
    container.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
}

window.sendStoryReply = async function() {
    const input = document.getElementById('story-reply-input');
    const message = input.value.trim();
    if (!message) return;
    const story = currentViewerStories[currentStoryIndex];
    if (!story) return;
    try {
        await window.api.post('messages/send', {
            recipientId: story.userId,
            content: `Đã trả lời tin của bạn: "${message}"`
        });
        input.value = '';
        if (window.common) window.common.showToast('Đã gửi phản hồi!');
        resumeStory();
    } catch (err) {
        alert('Lỗi gửi tin nhắn: ' + err.message);
    }
};

// AUTHOR TOOLS
window.openStoryLikesModal = function() {
    pauseStory();
    const story = currentViewerStories[currentStoryIndex];
    const modal = document.getElementById('story-likes-modal');
    const list = document.getElementById('story-likes-list');
    
    list.innerHTML = '';

    if (story.likes && story.likes.length > 0) {
        const h4 = document.createElement('h4');
        h4.style.padding = '10px 15px';
        h4.style.color = '#ed4956';
        h4.innerHTML = '<i class="fa-solid fa-heart"></i> Đã thả tim';
        list.appendChild(h4);
        story.likes.forEach(liker => list.appendChild(createUserItem(liker)));
    }

    if (story.viewers && story.viewers.length > 0) {
        const h4 = document.createElement('h4');
        h4.style.padding = '10px 15px';
        h4.style.color = 'var(--primary-color)';
        h4.innerHTML = '<i class="fa-solid fa-eye"></i> Đã xem';
        list.appendChild(h4);
        story.viewers.forEach(viewer => {
            if (!story.likes || !story.likes.some(l => l.userId === viewer.userId)) {
                list.appendChild(createUserItem(viewer));
            }
        });
    }

    if (list.innerHTML === '') {
        list.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-secondary);">Chưa có ai tương tác</p>';
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('show'), 10);
};

function createUserItem(user) {
    const div = document.createElement('div');
    div.className = 'user-interaction-item';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '12px';
    div.style.padding = '12px 16px';
    const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;
    div.innerHTML = `
        <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
        <span style="font-weight:500; font-size: 0.95rem;">${user.fullName}</span>
    `;
    return div;
}

window.closeStoryLikesModal = function() {
    const modal = document.getElementById('story-likes-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.classList.add('hidden');
        resumeStory();
    }, 300);
};

window.deleteCurrentStory = async function() {
    const story = currentViewerStories[currentStoryIndex];
    if (!confirm('Bạn có chắc muốn xóa tin này?')) return;
    try {
        await window.api.delete(`stories/${story.id}`);
        closeStoryViewer();
        if (window.common) window.common.showToast('Đã xóa tin!');
        loadMyStories();
        loadStories();
    } catch (err) {
        alert('Lỗi khi xóa tin: ' + err.message);
    }
};

window.pauseStory = function() {
    if (storyPaused) return;
    storyPaused = true;
    clearTimeout(storyTimer);
    remainingTime -= (Date.now() - startTime);
    
    // Visual feedback for pause
    const fills = document.querySelectorAll('.story-progress-fill');
    if (fills[currentStoryIndex]) {
        fills[currentStoryIndex].style.transition = 'none';
        const currentWidth = ( (STORY_DURATION - remainingTime) / STORY_DURATION ) * 100;
        fills[currentStoryIndex].style.width = currentWidth + '%';
    }
};

window.resumeStory = function() {
    if (!storyPaused) return;
    storyPaused = false;
    startTime = Date.now();
    
    const fills = document.querySelectorAll('.story-progress-fill');
    if (fills[currentStoryIndex]) {
        fills[currentStoryIndex].style.transition = `width ${remainingTime}ms linear`;
        fills[currentStoryIndex].style.width = '100%';
    }

    storyTimer = setTimeout(() => { nextStory(); }, remainingTime);
};

async function loadMyStories() {
    try {
        const stories = await window.api.get('stories/me');
        myStories = stories;
        updateMyStoryUI();
    } catch (err) { console.error('Load my stories error:', err); }
}

function updateMyStoryUI() {
    const circle = document.getElementById('my-story-circle');
    const indicator = document.getElementById('add-story-indicator');
    if (myStories && myStories.length > 0) {
        circle.classList.remove('my-story');
        if (isGroupViewed(myStories)) circle.style.background = '#dbdbdb';
        else circle.style.background = 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
        if (indicator) {
            indicator.classList.remove('hidden');
            indicator.onclick = (e) => { e.stopPropagation(); openCreateStoryModal(); };
        }
    } else {
        circle.classList.add('my-story');
        circle.style.background = '';
        if (indicator) { indicator.classList.remove('hidden'); indicator.onclick = null; }
    }
}

window.handleMyStoryClick = function() {
    if (myStories && myStories.length > 0) openStoryViewer(myStories);
    else openCreateStoryModal();
};

async function loadStories() {
    const container = document.getElementById('stories-container');
    if (!container) return;
    try {
        const stories = await window.api.get('stories/feed');
        storiesList = stories;
        const grouped = stories.reduce((acc, story) => {
            if (!acc[story.userId]) {
                acc[story.userId] = {
                    userId: story.userId,
                    userName: story.authorName,
                    userAvatar: story.authorAvatarUrl,
                    stories: [],
                    isViewed: false
                };
            }
            acc[story.userId].stories.push(story);
            return acc;
        }, {});
        let groups = Object.values(grouped);
        groups.forEach(g => { g.isViewed = isGroupViewed(g.stories); });
        groups.sort((a, b) => {
            if (a.isViewed === b.isViewed) return 0;
            return a.isViewed ? 1 : -1;
        });
        const dynamicItems = container.querySelectorAll('.story-item:not(#my-story-item)');
        dynamicItems.forEach(item => item.remove());
        groups.forEach(group => {
            const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
            if (group.userId === currentUser.id) return;
            const item = document.createElement('div');
            item.className = `story-item ${group.isViewed ? 'viewed' : ''}`;
            item.onclick = () => openStoryViewer(group.stories);
            const avatar = group.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.userName)}&background=random`;
            const borderStyle = group.isViewed ? 'background: #dbdbdb;' : 'background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);';
            item.innerHTML = `
                <div class="story-circle-wrapper" style="${borderStyle}">
                    <img src="${avatar}" class="story-avatar" alt="${group.userName}">
                </div>
                <span class="story-username">${group.userName}</span>
            `;
            container.appendChild(item);
        });
    } catch (err) { console.error('Load stories error:', err); }
}

// CREATE STORY
window.openCreateStoryModal = function() {
    document.getElementById('create-story-modal').classList.remove('hidden');
    switchStoryType('Media');
};

window.closeCreateStoryModal = function() {
    document.getElementById('create-story-modal').classList.add('hidden');
    document.getElementById('story-preview').classList.add('hidden');
    document.getElementById('story-preview-video').classList.add('hidden');
    document.querySelector('.upload-placeholder').classList.remove('hidden');
    document.getElementById('story-file').value = '';
    document.getElementById('story-text-input').value = '';
    const submitBtn = document.getElementById('submit-story-btn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đăng tin ngay';
    delete submitBtn.dataset.url;
};

window.switchStoryType = function(type) {
    currentStoryType = type;
    const mediaArea = document.getElementById('story-media-area');
    const textArea = document.getElementById('story-text-area');
    const tabs = document.querySelectorAll('.story-tab');
    tabs.forEach(tab => {
        if (tab.innerText.includes(type === 'Media' ? 'Ảnh/Video' : 'Văn bản')) tab.classList.add('active');
        else tab.classList.remove('active');
    });
    if (type === 'Media') { mediaArea.classList.remove('hidden'); textArea.classList.add('hidden'); }
    else { mediaArea.classList.add('hidden'); textArea.classList.remove('hidden'); }
};

window.selectStoryBg = function(el) {
    const opts = document.querySelectorAll('.bg-opt');
    opts.forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    const preview = document.getElementById('text-story-preview');
    preview.style.background = el.style.background;
};

window.handleStoryFileSelect = async function(input) {
    const file = input.files[0];
    if (!file) return;
    const preview = document.getElementById('story-preview');
    const previewVideo = document.getElementById('story-preview-video');
    const placeholder = document.querySelector('.upload-placeholder');
    const submitBtn = document.getElementById('submit-story-btn');
    placeholder.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang tải...';
    try {
        const result = await window.api.uploadImage(file);
        const url = result.url;
        if (file.type.startsWith('image/')) {
            preview.src = url; preview.classList.remove('hidden'); previewVideo.classList.add('hidden');
        } else {
            previewVideo.src = url; previewVideo.classList.remove('hidden'); preview.classList.add('hidden');
        }
        submitBtn.dataset.url = url;
        submitBtn.dataset.type = file.type.startsWith('image/') ? 'Image' : 'Video';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng tin ngay';
    } catch (err) {
        alert('Lỗi tải file: ' + err.message);
        submitBtn.disabled = false; submitBtn.textContent = 'Đăng tin ngay'; placeholder.classList.remove('hidden');
    }
};

window.submitStory = async function() {
    const btn = document.getElementById('submit-story-btn');
    let data = {
        durationHours: parseInt(document.getElementById('story-duration').value),
        privacy: document.getElementById('story-privacy').value
    };
    if (currentStoryType === 'Media') {
        if (!btn.dataset.url) { alert('Vui lòng chọn ảnh hoặc video!'); return; }
        data.mediaUrl = btn.dataset.url;
        data.mediaType = btn.dataset.type;
    } else {
        const text = document.getElementById('story-text-input').value.trim();
        if (!text) { alert('Vui lòng nhập văn bản!'); return; }
        data.mediaType = 'Text';
        data.content = text;
        data.background = document.getElementById('text-story-preview').style.background;
    }
    try {
        btn.disabled = true;
        btn.textContent = 'Đang đăng...';
        await window.api.post('stories', data);
        closeCreateStoryModal();
        if (window.common) window.common.showToast('Đã đăng tin thành công!');
        loadMyStories();
        loadStories();
    } catch (err) { alert('Lỗi khi đăng tin: ' + err.message); btn.disabled = false; btn.textContent = 'Đăng tin ngay'; }
};

// STORY VIEWER
window.openStoryViewer = function(stories) {
    currentViewerStories = stories;
    currentStoryIndex = 0;
    document.getElementById('story-viewer-modal').classList.remove('hidden');
    showStory(0);
};

window.closeStoryViewer = function() {
    document.getElementById('story-viewer-modal').classList.add('hidden');
    clearTimeout(storyTimer);
    const content = document.getElementById('story-viewer-content');
    content.innerHTML = '';
    const input = document.getElementById('story-reply-input');
    if (input) input.value = '';
    loadStories();
    loadMyStories();
};

function showStory(index) {
    if (index < 0 || index >= currentViewerStories.length) { closeStoryViewer(); return; }
    currentStoryIndex = index;
    const story = currentViewerStories[index];
    markStoryAsViewed(story.id);

    window.api.post(`stories/${story.id}/view`, {}).catch(() => {});

    const user = JSON.parse(localStorage.getItem('user_info') || '{}');
    const isOwner = story.userId === user.id;

    const content = document.getElementById('story-viewer-content');
    const avatar = document.getElementById('story-viewer-avatar');
    const nameEl = document.getElementById('story-viewer-name');
    const timeEl = document.getElementById('story-viewer-time');
    const progressContainer = document.getElementById('story-progress-bar');
    const footer = document.querySelector('.story-viewer-footer');
    const authorTools = document.getElementById('story-author-tools');
    const likeBtn = document.getElementById('story-like-btn');
    const likeCountDisplay = document.getElementById('story-like-count-display');

    if (isOwner) {
        footer.classList.add('hidden');
        authorTools.classList.remove('hidden');
        likeCountDisplay.textContent = `${story.viewCount || 0} người xem & tim`;
    } else {
        footer.classList.remove('hidden');
        authorTools.classList.add('hidden');
        const liked = getLikedStories();
        if (liked.includes(story.id) || story.isLiked) {
            likeBtn.classList.add('liked');
            likeBtn.querySelector('i').className = 'fa-solid fa-heart';
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.querySelector('i').className = 'fa-regular fa-heart';
        }
    }

    const authorAvatar = story.authorAvatarUrl || (isOwner ? user.avatarUrl : null) || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.authorName || 'U')}&background=random`;
    const authorName = isOwner ? "Tin của bạn" : (story.authorName || "Người dùng");

    avatar.src = authorAvatar;
    nameEl.textContent = authorName;
    timeEl.textContent = window.common ? window.common.formatDate(story.createdAt) : '';

    progressContainer.innerHTML = currentViewerStories.map((_, i) => `
        <div class="story-progress-item">
            <div class="story-progress-fill" style="width: ${i < index ? '100%' : (i === index ? '0%' : '0%')}"></div>
        </div>
    `).join('');

    content.innerHTML = '';
    if (story.mediaType === 'Image') {
        const img = document.createElement('img');
        img.src = story.mediaUrl;
        content.appendChild(img);
    } else if (story.mediaType === 'Video') {
        const video = document.createElement('video');
        video.src = story.mediaUrl; video.autoplay = true; video.muted = true; video.playsInline = true;
        content.appendChild(video);
    } else if (story.mediaType === 'Text') {
        const textDiv = document.createElement('div');
        textDiv.className = 'text-story-display';
        textDiv.style.background = story.background || '#1a1a1a';
        textDiv.textContent = story.content;
        content.appendChild(textDiv);
    }

    remainingTime = STORY_DURATION;
    startTime = Date.now();
    storyPaused = false;
    setTimeout(() => {
        const fills = progressContainer.querySelectorAll('.story-progress-fill');
        if (fills[index]) {
            fills[index].style.transition = `width ${STORY_DURATION}ms linear`;
            fills[index].style.width = '100%';
        }
    }, 50);
    clearTimeout(storyTimer);
    storyTimer = setTimeout(() => { nextStory(); }, STORY_DURATION);
}

window.nextStory = function() {
    if (currentStoryIndex < currentViewerStories.length - 1) showStory(currentStoryIndex + 1);
    else closeStoryViewer();
};

window.prevStory = function() {
    if (currentStoryIndex > 0) showStory(currentStoryIndex - 1);
    else showStory(0);
};
