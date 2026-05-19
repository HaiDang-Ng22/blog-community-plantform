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
let storyStream = null;
let cameraFacingMode = 'user';
let activeImageSrc = null;
let activeVideoFile = null;
let activeMediaType = 'Image';
let storyOverlays = [];
let currentStoryFilter = 'normal';
let currentOverlayColor = '#ffffff';

window.openCreateStoryModal = function() {
    document.getElementById('create-story-modal').classList.remove('hidden');
    switchStoryType('Media');
    resetStoryMedia();
};

window.closeCreateStoryModal = function() {
    stopStoryCamera();
    document.getElementById('create-story-modal').classList.add('hidden');
    resetStoryMedia();
};

window.switchStoryType = function(type) {
    currentStoryType = type;
    const mediaArea = document.getElementById('story-media-area');
    const textArea = document.getElementById('story-text-area');
    const bgSelection = document.getElementById('story-bg-selection-container');
    const toolbar = document.getElementById('story-editor-toolbar');
    const filters = document.getElementById('story-filters-container');
    
    const tabs = document.querySelectorAll('.story-tab');
    tabs.forEach(tab => {
        if (tab.innerText.includes(type === 'Media' ? 'Ảnh/Video' : 'Văn bản')) tab.classList.add('active');
        else tab.classList.remove('active');
    });
    
    if (type === 'Media') {
        mediaArea.classList.remove('hidden');
        textArea.classList.add('hidden');
        if (bgSelection) bgSelection.classList.add('hidden');
        stopStoryCamera();
    } else {
        mediaArea.classList.add('hidden');
        textArea.classList.remove('hidden');
        if (bgSelection) bgSelection.classList.remove('hidden');
        if (toolbar) toolbar.classList.add('hidden');
        if (filters) filters.classList.add('hidden');
        stopStoryCamera();
    }
};

window.selectStoryBg = function(el) {
    const opts = document.querySelectorAll('.bg-opt');
    opts.forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    const preview = document.getElementById('text-story-preview');
    preview.style.background = el.style.background;
};

window.resetStoryMedia = function() {
    document.getElementById('story-editor-container').classList.add('hidden');
    document.getElementById('story-camera-container').classList.add('hidden');
    document.getElementById('story-media-source-select').classList.remove('hidden');
    
    document.getElementById('story-file').value = '';
    activeImageSrc = null;
    activeVideoFile = null;
    activeMediaType = 'Image';
    storyOverlays = [];
    currentStoryFilter = 'normal';
    
    document.getElementById('editor-overlays-container').innerHTML = '';
    
    const imgEl = document.getElementById('story-preview');
    imgEl.className = 'hidden';
    imgEl.style.filter = 'none';
    imgEl.src = '';
    
    const videoEl = document.getElementById('story-preview-video');
    videoEl.className = 'hidden';
    videoEl.src = '';
    
    document.getElementById('story-editor-toolbar').classList.add('hidden');
    document.getElementById('story-filters-container').classList.add('hidden');
    
    // Clear doodles
    drawStrokes = [];
    currentStroke = [];
    if (drawingCtx && drawingCanvas) {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    const drawingBtn = document.getElementById('drawing-mode-btn');
    if (drawingBtn) {
        drawingBtn.classList.remove('active');
        drawingBtn.style.color = '';
    }
    const undoBtn = document.getElementById('drawing-undo-btn');
    if (undoBtn) undoBtn.classList.add('hidden');
    isDrawingMode = false;
    disableDrawing();
    
    const submitBtn = document.getElementById('submit-story-btn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đăng tin ngay';
};

window.startStoryCamera = async function() {
    document.getElementById('story-media-source-select').classList.add('hidden');
    document.getElementById('story-camera-container').classList.remove('hidden');
    
    try {
        const constraints = {
            video: {
                facingMode: cameraFacingMode,
                width: { ideal: 1080 },
                height: { ideal: 1920 }
            },
            audio: false
        };
        
        storyStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('story-camera-stream');
        video.srcObject = storyStream;
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const flipBtn = document.getElementById('camera-flip-btn');
        if (videoDevices.length > 1) {
            flipBtn.style.display = 'flex';
        } else {
            flipBtn.style.display = 'none';
        }
    } catch (err) {
        alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập: ' + err.message);
        resetStoryMedia();
    }
};

window.stopStoryCamera = function() {
    if (storyStream) {
        storyStream.getTracks().forEach(track => track.stop());
        storyStream = null;
    }
    const video = document.getElementById('story-camera-stream');
    if (video) video.srcObject = null;
    document.getElementById('story-camera-container').classList.add('hidden');
};

window.toggleCameraFacing = async function() {
    cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    const video = document.getElementById('story-camera-stream');
    if (cameraFacingMode === 'user') {
        video.style.transform = 'scaleX(-1)';
    } else {
        video.style.transform = 'scaleX(1)';
    }
    stopStoryCamera();
    startStoryCamera();
};

window.captureStoryPhoto = function() {
    const video = document.getElementById('story-camera-stream');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    
    const ctx = canvas.getContext('2d');
    if (cameraFacingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    stopStoryCamera();
    activeImageSrc = dataUrl;
    activeMediaType = 'Image';
    enterEditorMode();
};

function enterEditorMode() {
    document.getElementById('story-camera-container').classList.add('hidden');
    document.getElementById('story-media-source-select').classList.add('hidden');
    document.getElementById('story-editor-container').classList.remove('hidden');
    
    const imgEl = document.getElementById('story-preview');
    const videoEl = document.getElementById('story-preview-video');
    const toolbar = document.getElementById('story-editor-toolbar');
    const filters = document.getElementById('story-filters-container');
    
    if (activeMediaType === 'Image') {
        imgEl.src = activeImageSrc;
        imgEl.classList.remove('hidden');
        videoEl.classList.add('hidden');
        toolbar.classList.remove('hidden');
        filters.classList.remove('hidden');
        
        document.querySelectorAll('.filter-opt').forEach(opt => opt.classList.remove('active'));
        const normalOpt = document.querySelector('.filter-opt[data-filter="normal"]');
        if (normalOpt) normalOpt.classList.add('active');
    } else {
        imgEl.classList.add('hidden');
        videoEl.classList.remove('hidden');
        toolbar.classList.add('hidden');
        filters.classList.add('hidden');
    }
}

window.handleStoryFileSelect = function(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
        activeMediaType = 'Image';
        const reader = new FileReader();
        reader.onload = function(e) {
            activeImageSrc = e.target.result;
            enterEditorMode();
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        activeMediaType = 'Video';
        activeVideoFile = file;
        
        const videoUrl = URL.createObjectURL(file);
        const videoEl = document.getElementById('story-preview-video');
        videoEl.src = videoUrl;
        enterEditorMode();
    } else {
        alert('Vui lòng chọn file hình ảnh hoặc video hợp lệ!');
    }
};

window.applyStoryFilter = function(filterName) {
    currentStoryFilter = filterName;
    document.querySelectorAll('.filter-opt').forEach(opt => {
        if (opt.getAttribute('data-filter') === filterName) opt.classList.add('active');
        else opt.classList.remove('active');
    });
    
    const imgEl = document.getElementById('story-preview');
    imgEl.style.filter = getCanvasFilter(filterName);
};

// Drag and drop logic
let activeDragItem = null;
let initialMouseX;
let initialMouseY;
let startLeftPercent = 50;
let startTopPercent = 50;

function setupDragEvents(el) {
    el.addEventListener('mousedown', dragStart, false);
    el.addEventListener('touchstart', dragStart, { passive: false });
}

function dragStart(e) {
    if (e.target.closest('.delete-overlay-btn')) return;
    if (e.target.isContentEditable) return; // Allow user to type
    
    activeDragItem = e.currentTarget;
    document.querySelectorAll('.draggable-overlay').forEach(o => o.classList.remove('selected'));
    activeDragItem.classList.add('selected');
    
    initialMouseX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    initialMouseY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    
    startLeftPercent = parseFloat(activeDragItem.style.left) || 50;
    startTopPercent = parseFloat(activeDragItem.style.top) || 50;
    
    document.addEventListener('mousemove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd, false);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd, false);
}

function drag(e) {
    if (activeDragItem) {
        e.preventDefault();
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - initialMouseX;
        const deltaY = clientY - initialMouseY;
        
        const parentRect = activeDragItem.parentElement.getBoundingClientRect();
        if (parentRect.width === 0 || parentRect.height === 0) return;
        
        const deltaXPercent = (deltaX / parentRect.width) * 100;
        const deltaYPercent = (deltaY / parentRect.height) * 100;
        
        activeDragItem.style.left = (startLeftPercent + deltaXPercent) + '%';
        activeDragItem.style.top = (startTopPercent + deltaYPercent) + '%';
    }
}

function dragEnd() {
    activeDragItem = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', dragEnd);
}

// Inline Text Overlay
let activeTextEditor = null;

window.addInlineTextOverlay = function() {
    const wrapper = document.getElementById('editor-overlays-container');
    
    const div = document.createElement('div');
    div.className = 'draggable-overlay inline-text-editor';
    div.contentEditable = true;
    div.style.left = '50%';
    div.style.top = '50%';
    div.style.transform = 'translate(-50%, -50%)';
    div.style.position = 'absolute';
    div.style.color = '#ffffff';
    div.style.fontFamily = "'Inter', sans-serif";
    div.style.fontSize = '28px';
    div.style.fontWeight = 'bold';
    div.style.outline = 'none';
    div.style.whiteSpace = 'pre-wrap';
    div.style.textAlign = 'center';
    div.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
    
    wrapper.appendChild(div);
    div.focus();
    
    activeTextEditor = div;
    const palette = document.getElementById('drawing-color-palette');
    const fontSelector = document.getElementById('text-font-selector');
    if (palette) palette.classList.remove('hidden');
    if (fontSelector) fontSelector.classList.remove('hidden');
    
    const delBtn = document.createElement('div');
    delBtn.className = 'delete-overlay-btn hidden';
    delBtn.innerHTML = '&times;';
    delBtn.contentEditable = false;
    delBtn.onclick = function(e) {
        e.stopPropagation();
        div.remove();
        if (activeTextEditor === div) activeTextEditor = null;
    };
    div.appendChild(delBtn);
    
    div.addEventListener('click', function(e) {
        if (!e.target.closest('.delete-overlay-btn')) {
            div.contentEditable = true;
            div.classList.add('inline-text-editor');
            delBtn.classList.add('hidden');
            div.focus();
            
            activeTextEditor = div;
            if (palette) palette.classList.remove('hidden');
            if (fontSelector) {
                fontSelector.classList.remove('hidden');
                fontSelector.value = div.style.fontFamily || "'Inter', sans-serif";
            }
        }
    });
    
    div.addEventListener('blur', function() {
        const clone = div.cloneNode(true);
        const child = clone.querySelector('.delete-overlay-btn');
        if (child) clone.removeChild(child);
        
        if (!clone.textContent.trim()) {
            div.remove();
            if (activeTextEditor === div) activeTextEditor = null;
        } else {
            div.contentEditable = false; // Fix text drag bug
            div.classList.remove('inline-text-editor');
            delBtn.classList.remove('hidden');
            setupDragEvents(div);
        }
        
        setTimeout(() => {
            if (document.activeElement !== div) {
                if (activeTextEditor === div) activeTextEditor = null;
                if (!isDrawingMode && palette) {
                    palette.classList.add('hidden');
                }
                if (fontSelector) fontSelector.classList.add('hidden');
            }
        }, 150);
    });
};

// Freehand Drawing (Vẽ tay)
let isDrawingMode = false;
let drawingCanvas = null;
let drawingCtx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawStrokes = [];
let currentStroke = [];

window.toggleDrawingMode = function() {
    isDrawingMode = !isDrawingMode;
    const btn = document.getElementById('drawing-mode-btn');
    const undoBtn = document.getElementById('drawing-undo-btn');
    const palette = document.getElementById('drawing-color-palette');
    const fontSelector = document.getElementById('text-font-selector');
    
    if (isDrawingMode) {
        btn.classList.add('active');
        btn.style.color = '#ff3b30';
        if (undoBtn) undoBtn.classList.remove('hidden');
        if (palette) palette.classList.remove('hidden');
        if (fontSelector) fontSelector.classList.add('hidden'); // Hide font selector when drawing
        enableDrawing();
    } else {
        btn.classList.remove('active');
        btn.style.color = '';
        if (undoBtn) undoBtn.classList.add('hidden');
        if (palette && !activeTextEditor) palette.classList.add('hidden');
        disableDrawing();
    }
};

window.setDrawColor = function(el, color) {
    document.querySelectorAll('.draw-color-opt').forEach(opt => opt.style.transform = 'scale(1)');
    el.style.transform = 'scale(1.3)';
    if (drawingCtx && isDrawingMode) {
        drawingCtx.strokeStyle = color;
    }
    if (activeTextEditor) {
        activeTextEditor.style.color = color;
        activeTextEditor.focus();
    }
};

window.changeTextFont = function(fontName) {
    if (activeTextEditor) {
        activeTextEditor.style.fontFamily = fontName;
        activeTextEditor.focus();
    }
};

window.undoDraw = function() {
    if (drawStrokes.length > 0) {
        drawStrokes.pop();
        redrawCanvas();
    }
};

function redrawCanvas() {
    if (!drawingCanvas || !drawingCtx) return;
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    drawStrokes.forEach(stroke => {
        if (stroke.length < 2) return;
        drawingCtx.beginPath();
        drawingCtx.moveTo(stroke[0].x, stroke[0].y);
        for(let i = 1; i < stroke.length; i++) {
            drawingCtx.lineTo(stroke[i].x, stroke[i].y);
        }
        drawingCtx.stroke();
    });
}

function enableDrawing() {
    const wrapper = document.getElementById('story-preview-wrapper');
    if (!drawingCanvas) {
        drawingCanvas = document.createElement('canvas');
        drawingCanvas.className = 'drawing-canvas';
        drawingCanvas.id = 'story-drawing-canvas';
        wrapper.appendChild(drawingCanvas);
        
        drawingCanvas.width = wrapper.offsetWidth;
        drawingCanvas.height = wrapper.offsetHeight;
        drawingCtx = drawingCanvas.getContext('2d');
        drawingCtx.lineCap = 'round';
        drawingCtx.lineJoin = 'round';
        drawingCtx.lineWidth = 6;
        drawingCtx.strokeStyle = '#ff3b30';
        
        const startDraw = (e) => {
            isDrawing = true;
            const rect = drawingCanvas.getBoundingClientRect();
            lastX = (e.clientX || e.touches[0].clientX) - rect.left;
            lastY = (e.clientY || e.touches[0].clientY) - rect.top;
            currentStroke = [{x: lastX, y: lastY}];
        };
        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const rect = drawingCanvas.getBoundingClientRect();
            const currentX = (e.clientX || e.touches[0].clientX) - rect.left;
            const currentY = (e.clientY || e.touches[0].clientY) - rect.top;
            drawingCtx.beginPath();
            drawingCtx.moveTo(lastX, lastY);
            drawingCtx.lineTo(currentX, currentY);
            drawingCtx.stroke();
            lastX = currentX;
            lastY = currentY;
            currentStroke.push({x: lastX, y: lastY});
        };
        const stopDraw = () => {
            if (isDrawing && currentStroke.length > 1) {
                drawStrokes.push([...currentStroke]);
            }
            isDrawing = false;
            currentStroke = [];
        };
        
        drawingCanvas.addEventListener('mousedown', startDraw);
        drawingCanvas.addEventListener('mousemove', draw);
        drawingCanvas.addEventListener('mouseup', stopDraw);
        drawingCanvas.addEventListener('mouseout', stopDraw);
        
        drawingCanvas.addEventListener('touchstart', startDraw, {passive: false});
        drawingCanvas.addEventListener('touchmove', draw, {passive: false});
        drawingCanvas.addEventListener('touchend', stopDraw);
    }
    drawingCanvas.style.pointerEvents = 'auto';
    document.querySelectorAll('.draggable-overlay').forEach(o => o.style.pointerEvents = 'none');
}

function disableDrawing() {
    if (drawingCanvas) drawingCanvas.style.pointerEvents = 'none';
    document.querySelectorAll('.draggable-overlay').forEach(o => o.style.pointerEvents = 'auto');
}

window.updateTextStoryPreview = function() {
    const input = document.getElementById('story-text-input');
    const length = input.value.length;
    if (length > 100) {
        input.style.fontSize = '1.1rem';
    } else if (length > 50) {
        input.style.fontSize = '1.3rem';
    } else {
        input.style.fontSize = '1.6rem';
    }
};

window.submitStory = async function() {
    const btn = document.getElementById('submit-story-btn');
    let data = {
        durationHours: parseInt(document.getElementById('story-duration').value),
        privacy: document.getElementById('story-privacy').value
    };
    
    try {
        btn.disabled = true;
        btn.textContent = 'Đang xử lý...';
        
        if (currentStoryType === 'Media') {
            if (activeMediaType === 'Image') {
                if (!activeImageSrc) {
                    alert('Vui lòng chọn hoặc chụp ảnh!');
                    btn.disabled = false;
                    btn.textContent = 'Đăng tin ngay';
                    return;
                }
                
                const renderCanvas = document.createElement('canvas');
                const ctx = renderCanvas.getContext('2d');
                
                const img = new Image();
                img.src = activeImageSrc;
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                
                renderCanvas.width = img.naturalWidth || 720;
                renderCanvas.height = img.naturalHeight || 1280;
                
                if (currentStoryFilter !== 'normal') {
                    ctx.filter = getCanvasFilter(currentStoryFilter);
                }
                
                ctx.drawImage(img, 0, 0, renderCanvas.width, renderCanvas.height);
                ctx.filter = 'none';
                
                const wrapper = document.getElementById('story-preview-wrapper');
                const pWidth = wrapper.offsetWidth || 1;
                const pHeight = wrapper.offsetHeight || 1;
                const scaleX = renderCanvas.width / pWidth;
                const scaleY = renderCanvas.height / pHeight;
                
                // Draw Doodle Canvas
                if (drawingCanvas) {
                    ctx.drawImage(drawingCanvas, 0, 0, renderCanvas.width, renderCanvas.height);
                }
                
                // Draw Text Overlays
                const overlays = document.querySelectorAll('.draggable-overlay');
                overlays.forEach(el => {
                    const clone = el.cloneNode(true);
                    const btnNode = clone.querySelector('.delete-overlay-btn');
                    if (btnNode) clone.removeChild(btnNode);
                    const text = clone.innerText || clone.textContent;
                    
                    const xPercent = parseFloat(el.style.left || '50');
                    const yPercent = parseFloat(el.style.top || '50');
                    
                    const baseFontSize = parseFloat(el.style.fontSize) || 28;
                    const canvasFontSize = baseFontSize * scaleX;
                    ctx.font = `bold ${canvasFontSize}px 'Inter', sans-serif`;
                    ctx.textBaseline = 'top';
                    ctx.textAlign = 'center';
                    
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 4 * scaleX;
                    ctx.shadowOffsetX = 1 * scaleX;
                    ctx.shadowOffsetY = 1 * scaleX;
                    
                    const textLines = text.split('\n');
                    const xPx = (xPercent / 100) * renderCanvas.width;
                    let yPx = (yPercent / 100) * renderCanvas.height;
                    
                    ctx.fillStyle = el.style.color || '#ffffff';
                    
                    const totalHeight = textLines.length * canvasFontSize * 1.25;
                    yPx -= totalHeight / 2; // adjust for translate(-50%, -50%)
                    
                    textLines.forEach((line, index) => {
                        const lineY = yPx + (index * canvasFontSize * 1.25);
                        ctx.fillText(line, xPx, lineY);
                    });
                    
                    ctx.shadowColor = 'transparent';
                });
                
                const blob = await new Promise(resolve => renderCanvas.toBlob(resolve, 'image/jpeg', 0.9));
                const file = new File([blob], 'captured_story.jpg', { type: 'image/jpeg' });
                
                btn.textContent = 'Đang tải ảnh...';
                const result = await window.api.uploadImage(file);
                data.mediaUrl = result.url;
                data.mediaType = 'Image';
            } else {
                if (!activeVideoFile) {
                    alert('Vui lòng chọn video!');
                    btn.disabled = false;
                    btn.textContent = 'Đăng tin ngay';
                    return;
                }
                
                btn.textContent = 'Đang tải video...';
                const result = await window.api.uploadImage(activeVideoFile);
                data.mediaUrl = result.url;
                data.mediaType = 'Video';
            }
        } else {
            const text = document.getElementById('story-text-input').value.trim();
            if (!text) { alert('Vui lòng nhập văn bản!'); btn.disabled = false; btn.textContent = 'Đăng tin ngay'; return; }
            data.mediaType = 'Text';
            data.content = text;
            data.background = document.getElementById('text-story-preview').style.background;
        }
        
        btn.textContent = 'Đang đăng...';
        await window.api.post('stories', data);
        closeCreateStoryModal();
        if (window.common) window.common.showToast('Đã đăng tin thành công!');
        loadMyStories();
        loadStories();
    } catch (err) {
        alert('Lỗi khi đăng tin: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Đăng tin ngay';
    }
};

function getCanvasFilter(filterName) {
    switch (filterName) {
        case 'vintage':
            return 'sepia(0.4) contrast(1.1) brightness(0.95)';
        case 'sepia':
            return 'sepia(0.85)';
        case 'grayscale':
            return 'grayscale(1)';
        case 'warm':
            return 'saturate(1.35) sepia(0.1) hue-rotate(-5deg)';
        case 'cool':
            return 'saturate(0.9) hue-rotate(10deg) brightness(1.02)';
        case 'cyber':
            return 'hue-rotate(45deg) saturate(1.8) contrast(1.15)';
        default:
            return 'none';
    }
}

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
