// js/create-post.js

const urlParams = new URLSearchParams(window.location.search);
const targetGroupId = urlParams.get('groupId');

let postImages = []; // Array of objects: { url, filters, transforms }
let currentStep = 0;
let currentImageIndex = 0;
let isTextOnly = false;
let isPoll = false;
let isReel = false;
let reelUrl = '';

// Pan state
let isDraggingImage = false;
let startX, startY;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initUI();
    initDropzone();
});

function checkAuth() {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
    }
}

function initUI() {
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const userName = userInfo.fullName || userInfo.username || 'User';
    const userAvatar = userInfo.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
    
    document.getElementById('user-name-mini').textContent = userName;
    document.getElementById('user-avatar-mini').src = userAvatar;

    // Header buttons
    document.getElementById('cp-back-btn').addEventListener('click', () => {
        if (currentStep > 0) {
            if (isTextOnly && currentStep === 3) {
                goToStep(0);
            } else {
                goToStep(currentStep - 1);
            }
        }
    });

    document.getElementById('cp-next-btn').addEventListener('click', () => {
        if (currentStep < 3) goToStep(currentStep + 1);
    });

    document.getElementById('cp-share-btn').addEventListener('click', handlePublish);

    // Filter inputs
    ['brightness', 'contrast', 'saturate', 'blur'].forEach(f => {
        const input = document.getElementById(`adj-${f}`);
        input.addEventListener('input', applyFilters);
    });

    // Pan setup
    const cropImg = document.getElementById('current-crop-img');
    cropImg.addEventListener('mousedown', startPan);
    window.addEventListener('mousemove', handlePan);
    window.addEventListener('mouseup', endPan);

    // Content character count
    const contentTextarea = document.getElementById('post-content');
    const charCount = document.getElementById('char-count');
    contentTextarea.addEventListener('input', () => {
        const len = contentTextarea.value.length;
        charCount.textContent = `${len}/2200`;
    });
}

function initDropzone() {
    const dz = document.getElementById('cp-dropzone');
    const input = document.getElementById('post-image-file');
    if (!dz || !input) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dz.addEventListener(eventName, (e) => {
            e.preventDefault();
            dz.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dz.addEventListener(eventName, (e) => {
            e.preventDefault();
            dz.classList.remove('dragover');
        });
    });
    dz.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if (!files.length) return;
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
        initWizard(input);
    });
}

// Wizard & Steps
async function initWizard(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    isTextOnly = false;
    isPoll = false;
    isReel = false;
    postImages = [];
    reelUrl = '';

    const step0 = document.getElementById('step-0');
    const originalContent = step0.innerHTML;
    step0.innerHTML = '<div class="loading-spinner"></div><p style="margin-top:1rem">Đang tải tệp tin...</p>';

    // Check if there's a video in the selection
    const videoFile = files.find(f => f.type.startsWith('video/'));
    
    if (videoFile) {
        // Video mode (Reel)
        isReel = true;
        try {
            const result = await window.api.uploadImage(videoFile); // uploadImage helper handles FormData, works for videos too
            reelUrl = result.url;
            goToStep(3);
        } catch (error) {
            console.error('Error uploading video:', error);
            step0.innerHTML = originalContent;
            alert('Không thể tải video. Vui lòng thử lại.');
        }
        return;
    }

    // Image mode
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
            const result = await window.api.uploadImage(file);
            postImages.push({
                url: result.url,
                filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0 },
                transforms: { zoom: 1, x: 0, y: 0 }
            });
        } catch (error) {
            console.error('Error uploading image:', file.name, error);
        }
    }

    if (postImages.length > 0) {
        goToStep(1);
    } else {
        step0.innerHTML = originalContent;
        alert('Không thể tải ảnh. Vui lòng thử lại.');
    }
}

function initTextOnlyPost() {
    isTextOnly = true;
    isPoll = false;
    postImages = [];
    goToStep(3);
}

function initPollPost() {
    isPoll = true;
    isTextOnly = true;
    postImages = [];
    goToStep(3);
}

function addPollOption() {
    const list = document.getElementById('poll-options-list');
    const count = list.querySelectorAll('input').length;
    if (count >= 10) {
        alert('Tối đa 10 lựa chọn.');
        return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'poll-option-input';
    input.placeholder = `Lựa chọn ${count + 1}`;
    list.appendChild(input);
}

function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.cp-step').forEach(s => s.classList.add('hidden'));
    const targetStep = document.getElementById(`step-${step}`);
    targetStep.classList.remove('hidden');

    const backBtn = document.getElementById('cp-back-btn');
    const nextBtn = document.getElementById('cp-next-btn');
    const shareBtn = document.getElementById('cp-share-btn');
    const title = document.getElementById('cp-modal-title');

    backBtn.classList.toggle('hidden', step === 0);
    nextBtn.classList.toggle('hidden', step === 0 || step === 3);
    shareBtn.classList.toggle('hidden', step !== 3);

    // Text only adjustments
    if (step === 3) {
        const step3 = document.getElementById('step-3');
        const pollEditor = document.getElementById('poll-editor');
        const finalImg = document.getElementById('final-preview-img');
        const finalVideo = document.getElementById('final-preview-video');
        
        if (isTextOnly) {
            step3.classList.add('cp-text-only');
            title.textContent = isPoll ? 'Tạo thăm dò ý kiến' : 'Bài viết văn bản';
            
            const textarea = document.getElementById('post-content');
            textarea.placeholder = isPoll ? 'Đặt câu hỏi...' : 'Viết gì đó...';
            
            pollEditor.classList.toggle('hidden', !isPoll);
            finalImg.classList.add('hidden');
            finalVideo.classList.add('hidden');
        } else if (isReel) {
            step3.classList.remove('cp-text-only');
            title.textContent = 'Tạo Reel';
            pollEditor.classList.add('hidden');
            
            finalImg.classList.add('hidden');
            finalVideo.classList.remove('hidden');
            finalVideo.src = reelUrl;
        } else {
            step3.classList.remove('cp-text-only');
            title.textContent = 'Tạo bài viết mới';
            pollEditor.classList.add('hidden');
            
            finalImg.classList.remove('hidden');
            finalVideo.classList.add('hidden');
            showPreview(3, currentImageIndex);
        }
    }

    if (step === 1) {
        title.textContent = 'Cắt';
        renderReorderList();
        showPreview(1, currentImageIndex);
        updateZoomSlider();
    } else if (step === 2) {
        title.textContent = 'Chỉnh sửa';
        showPreview(2, currentImageIndex);
        updateFilterSliders();
    } else if (step === 3) {
        if (!isTextOnly) {
            showPreview(3, currentImageIndex);
        }
    }
}

function renderReorderList() {
    const list = document.getElementById('reorder-list');
    list.innerHTML = '';
    postImages.forEach((imgObj, idx) => {
        const item = document.createElement('div');
        item.className = `cp-thumb-item ${idx === currentImageIndex ? 'active' : ''}`;
        item.draggable = true;
        item.innerHTML = `
            <img src="${imgObj.url}">
            <button type="button" class="remove-btn" onclick="removeImage(${idx}, event)"><i class="fa-solid fa-x"></i></button>
        `;

        item.onclick = () => {
            currentImageIndex = idx;
            renderReorderList();
            showPreview(currentStep, idx);
            if (currentStep === 1) updateZoomSlider();
            if (currentStep === 2) updateFilterSliders();
        };

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', idx);
            item.classList.add('dragging');
        });
        item.addEventListener('dragover', (e) => e.preventDefault());
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = idx;
            reorderImages(fromIdx, toIdx);
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));

        list.appendChild(item);
    });
}

function reorderImages(from, to) {
    if (from === to) return;
    const item = postImages.splice(from, 1)[0];
    postImages.splice(to, 0, item);
    currentImageIndex = to;
    renderReorderList();
    showPreview(currentStep, to);
}

function showPreview(step, idx) {
    let imgId = step === 1 ? 'current-crop-img' : (step === 2 ? 'current-edit-img' : 'final-preview-img');
    const imgElement = document.getElementById(imgId);
    if (imgElement && postImages[idx]) {
        imgElement.src = postImages[idx].url;
        applyStoredVisuals(imgElement, idx);
    }
}

function removeImage(idx, e) {
    if (e) e.stopPropagation();
    postImages.splice(idx, 1);
    if (postImages.length === 0) {
        goToStep(0);
        document.getElementById('post-image-file').value = '';
    } else {
        currentImageIndex = 0;
        renderReorderList();
        showPreview(currentStep, 0);
    }
}

// Pan & Zoom Logic
function startPan(e) {
    if (currentStep !== 1) return;
    isDraggingImage = true;
    startX = e.clientX;
    startY = e.clientY;
    document.getElementById('current-crop-img').style.cursor = 'grabbing';
}

function handlePan(e) {
    if (!isDraggingImage || currentStep !== 1) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;

    const t = postImages[currentImageIndex].transforms;
    t.x += dx / t.zoom;
    t.y += dy / t.zoom;
    applyTransforms();
}

function endPan() {
    isDraggingImage = false;
    const img = document.getElementById('current-crop-img');
    if (img) img.style.cursor = 'grab';
}

function applyZoom() {
    const zoom = document.getElementById('adj-zoom').value;
    postImages[currentImageIndex].transforms.zoom = parseFloat(zoom);
    applyTransforms();
}

function applyTransforms() {
    const t = postImages[currentImageIndex].transforms;
    const imgId = currentStep === 1 ? 'current-crop-img' : (currentStep === 2 ? 'current-edit-img' : 'final-preview-img');
    const img = document.getElementById(imgId);
    if (img) {
        img.style.transform = `scale(${t.zoom}) translate(${t.x}px, ${t.y}px)`;
    }
}

function updateZoomSlider() {
    const t = postImages[currentImageIndex].transforms;
    document.getElementById('adj-zoom').value = t.zoom;
}

// Filter Logic
function applyFilters() {
    const b = document.getElementById('adj-brightness').value;
    const c = document.getElementById('adj-contrast').value;
    const s = document.getElementById('adj-saturate').value;
    const bl = document.getElementById('adj-blur').value;

    // Update value badges dynamically
    const valBrightness = document.getElementById('val-brightness');
    const valContrast = document.getElementById('val-contrast');
    const valSaturate = document.getElementById('val-saturate');
    const valBlur = document.getElementById('val-blur');

    if (valBrightness) valBrightness.textContent = `${b}%`;
    if (valContrast) valContrast.textContent = `${c}%`;
    if (valSaturate) valSaturate.textContent = `${s}%`;
    if (valBlur) valBlur.textContent = `${bl}px`;

    postImages[currentImageIndex].filters = { brightness: b, contrast: c, saturate: s, blur: bl };
    const img = document.getElementById('current-edit-img');
    if (img) {
        img.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) blur(${bl}px)`;
    }
}

function updateFilterSliders() {
    const f = postImages[currentImageIndex].filters;
    document.getElementById('adj-brightness').value = f.brightness;
    document.getElementById('adj-contrast').value = f.contrast;
    document.getElementById('adj-saturate').value = f.saturate;
    document.getElementById('adj-blur').value = f.blur;

    // Update value badges on loading state
    const valBrightness = document.getElementById('val-brightness');
    const valContrast = document.getElementById('val-contrast');
    const valSaturate = document.getElementById('val-saturate');
    const valBlur = document.getElementById('val-blur');

    if (valBrightness) valBrightness.textContent = `${f.brightness}%`;
    if (valContrast) valContrast.textContent = `${f.contrast}%`;
    if (valSaturate) valSaturate.textContent = `${f.saturate}%`;
    if (valBlur) valBlur.textContent = `${f.blur}px`;
    
    // Auto active preset cards based on filter parameters
    document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('active'));
    
    let matchedPreset = 'custom';
    if (f.brightness == 100 && f.contrast == 100 && f.saturate == 100 && f.blur == 0) matchedPreset = 'original';
    else if (f.brightness == 110 && f.contrast == 120 && f.saturate == 125 && f.blur == 0) matchedPreset = 'clarendon';
    else if (f.brightness == 115 && f.contrast == 110 && f.saturate == 140 && f.blur == 0) matchedPreset = 'juno';
    else if (f.brightness == 105 && f.contrast == 95 && f.saturate == 80 && f.blur == 0) matchedPreset = 'valencia';
    else if (f.brightness == 100 && f.contrast == 130 && f.saturate == 0 && f.blur == 0) matchedPreset = 'monochrome';
    else if (f.brightness == 110 && f.contrast == 90 && f.saturate == 70 && f.blur == 0) matchedPreset = 'gingham';
    
    if (matchedPreset !== 'custom') {
        const activeCard = document.querySelector(`.preset-card[onclick*="'${matchedPreset}'"]`);
        if (activeCard) activeCard.classList.add('active');
    }
}

function switchEditorTab(tabName) {
    const tabPresets = document.getElementById('tab-presets');
    const tabAdjustments = document.getElementById('tab-adjustments');
    const presetsContainer = document.getElementById('editor-presets-container');
    const adjustmentsContainer = document.getElementById('editor-adjustments-container');
    
    if (tabName === 'presets') {
        tabPresets.classList.add('active');
        tabAdjustments.classList.remove('active');
        presetsContainer.classList.remove('hidden');
        adjustmentsContainer.classList.add('hidden');
    } else {
        tabPresets.classList.remove('active');
        tabAdjustments.classList.add('active');
        presetsContainer.classList.add('hidden');
        adjustmentsContainer.classList.remove('hidden');
    }
}

function applyPreset(presetName) {
    // Select active card UI styling
    document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('active'));
    
    const activeCard = document.querySelector(`.preset-card[onclick*="'${presetName}'"]`);
    if (activeCard) activeCard.classList.add('active');

    let b = 100, c = 100, s = 100, bl = 0;
    switch(presetName) {
        case 'clarendon':
            b = 110; c = 120; s = 125; bl = 0;
            break;
        case 'juno':
            b = 115; c = 110; s = 140; bl = 0;
            break;
        case 'valencia':
            b = 105; c = 95; s = 80; bl = 0;
            break;
        case 'monochrome':
            b = 100; c = 130; s = 0; bl = 0;
            break;
        case 'gingham':
            b = 110; c = 90; s = 70; bl = 0;
            break;
        case 'original':
        default:
            b = 100; c = 100; s = 100; bl = 0;
            break;
    }

    // Set slider values
    document.getElementById('adj-brightness').value = b;
    document.getElementById('adj-contrast').value = c;
    document.getElementById('adj-saturate').value = s;
    document.getElementById('adj-blur').value = bl;

    // Apply filters
    applyFilters();
}

function applyStoredVisuals(img, idx) {
    const item = postImages[idx];
    if (!item) return;
    const f = item.filters;
    const t = item.transforms;
    img.style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px)`;
    img.style.transform = `scale(${t.zoom}) translate(${t.x}px, ${t.y}px)`;
}

async function handlePublish() {
    const content = document.getElementById('post-content').value.trim();
    if (!content) {
        alert('Vui lòng nhập nội dung bài viết.');
        return;
    }

    const shareBtn = document.getElementById('cp-share-btn');
    shareBtn.disabled = true;
    shareBtn.textContent = 'Đang chia sẻ...';

    try {
        const pollData = isPoll ? {
            question: content,
            options: Array.from(document.querySelectorAll('.poll-option-input'))
                .map(i => i.value.trim())
                .filter(v => v.length > 0),
            durationHours: 24 // Default 24h
        } : null;

        if (isPoll && pollData.options.length < 2) {
            alert('Vui lòng nhập ít nhất 2 lựa chọn.');
            shareBtn.disabled = false;
            shareBtn.textContent = 'Chia sẻ';
            return;
        }

        await window.api.post('posts', {
            title: isPoll ? 'Poll' : (isReel ? 'Reel' : 'Social Post'),
            content,
            summary: '',
            imageUrls: isReel ? [] : postImages.map(p => p.url),
            videoUrl: isReel ? reelUrl : null,
            type: isReel ? 'Reel' : (isPoll ? 'Poll' : 'Standard'),
            poll: pollData,
            isAnonymous: document.getElementById('anonymous-toggle')?.checked || false,
            groupId: targetGroupId
        });

        window.common.showToast('Đã chia sẻ bài viết thành công!', 'success');
        setTimeout(() => {
            if (targetGroupId) {
                window.location.href = `group-detail.html?id=${targetGroupId}`;
            } else {
                window.location.href = 'index.html';
            }
        }, 1500);
    } catch (error) {
        window.common.showToast(error.message || 'Lỗi khi đăng bài.', 'error');
        shareBtn.disabled = false;
        shareBtn.textContent = 'Chia sẻ';
    }
}

window.initWizard = initWizard;
window.initTextOnlyPost = initTextOnlyPost;
window.removeImage = removeImage;
window.applyFilters = applyFilters;
window.applyZoom = applyZoom;
window.initPollPost = initPollPost;
window.addPollOption = addPollOption;
window.switchEditorTab = switchEditorTab;
window.applyPreset = applyPreset;
