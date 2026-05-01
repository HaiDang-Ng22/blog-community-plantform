// js/create-post.js

let postImages = []; // Array of objects: { url, filters, transforms }
let currentStep = 0;
let currentImageIndex = 0;

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
        if (currentStep > 0) goToStep(currentStep - 1);
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
        const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
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

    const step0 = document.getElementById('step-0');
    const originalContent = step0.innerHTML;
    step0.innerHTML = '<div class="loading-spinner"></div><p style="margin-top:1rem">Đang tải ảnh...</p>';

    for (const file of files) {
        try {
            const result = await window.api.uploadImage(file);
            postImages.push({
                url: result.url,
                filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0 },
                transforms: { zoom: 1, x: 0, y: 0 }
            });
        } catch (error) {
            console.error('Error uploading file:', file.name, error);
        }
    }

    if (postImages.length > 0) {
        goToStep(1);
    } else {
        step0.innerHTML = originalContent;
        alert('Không thể tải ảnh. Vui lòng thử lại.');
    }
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
        title.textContent = 'Tạo bài viết mới';
        showPreview(3, currentImageIndex);
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
        await window.api.post('posts', {
            title: 'Social Post',
            content,
            summary: '',
            imageUrls: postImages.map(p => p.url)
        });

        alert('Đã chia sẻ bài viết thành công!');
        window.location.href = 'index.html';
    } catch (error) {
        alert(error.message || 'Lỗi khi đăng bài.');
        shareBtn.disabled = false;
        shareBtn.textContent = 'Chia sẻ';
    }
}

window.initWizard = initWizard;
window.removeImage = removeImage;
window.applyFilters = applyFilters;
window.applyZoom = applyZoom;
