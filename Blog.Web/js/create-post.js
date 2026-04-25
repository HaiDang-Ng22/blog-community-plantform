// js/create-post.js

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initForm();
});

function checkAuth() {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
    }
}

function initForm() {
    const form = document.getElementById('form-create-post');
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    
    // Fill user info in preview
    const userName = userInfo.fullName || userInfo.username || 'User';
    const userAvatar = userInfo.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
    
    document.getElementById('user-name-mini').textContent = userName;
    document.getElementById('user-avatar-mini').src = userAvatar;

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('post-title').value; // Hidden
        const summary = document.getElementById('post-summary').value; // Hidden
        const content = document.getElementById('post-content').value.trim();

        // Collect all image URLs from hidden inputs
        const imageUrls = Array.from(document.querySelectorAll('.post-image-url-hidden')).map(input => input.value);

        if (!content) {
            showMessage('Vui lòng nhập nội dung bài viết.', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Đang chia sẻ...';

        try {
            await window.api.post('posts', {
                title: title || '',
                content,
                summary: summary || '',
                imageUrls
            });

            showMessage('Đã chia sẻ bài viết thành công!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            showMessage(error.message || 'Lỗi khi đăng bài. Vui lòng thử lại.', 'error');
            btn.disabled = false;
            btn.textContent = 'Chia sẻ';
        }
    });
}

// Global function for handling multiple image uploads
async function handleMultipleImageUpload(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    const fileNameSpan = document.getElementById('file-name');
    const previewGrid = document.getElementById('image-preview-grid');
    const urlsContainer = document.getElementById('image-urls-container');
    const addMoreBtn = document.getElementById('btn-add-more-images');

    fileNameSpan.textContent = `Đang tải ${files.length} ảnh...`;
    previewGrid.classList.remove('hidden');
    document.getElementById('image-empty-state').classList.add('hidden');
    addMoreBtn.classList.remove('hidden');

    for (const file of files) {
        try {
            const result = await window.api.uploadImage(file);
            
            // Add hidden input
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.className = 'post-image-url-hidden';
            hiddenInput.value = result.url;
            urlsContainer.appendChild(hiddenInput);

            renderPreviews();

        } catch (error) {
            console.error('Error uploading file:', file.name, error);
            alert(`Lỗi khi tải ảnh ${file.name}: ${error.message}`);
        }
    }

    // Clear input so same file can be uploaded again if removed
    input.value = '';
    fileNameSpan.textContent = `Đã tải xong. Tổng cộng ${urlsContainer.children.length} ảnh.`;
}

function renderPreviews() {
    const previewGrid = document.getElementById('image-preview-grid');
    const urlsContainer = document.getElementById('image-urls-container');
    const imageUrls = Array.from(urlsContainer.querySelectorAll('.post-image-url-hidden')).map(input => input.value);
    const addMoreBtn = document.getElementById('btn-add-more-images');
    const dotsContainer = document.getElementById('carousel-dots');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (imageUrls.length === 0) {
        previewGrid.classList.add('hidden');
        document.getElementById('image-empty-state').classList.remove('hidden');
        addMoreBtn.classList.add('hidden');
        dotsContainer.classList.add('hidden');
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        return;
    }

    previewGrid.classList.remove('hidden');
    document.getElementById('image-empty-state').classList.add('hidden');
    addMoreBtn.classList.remove('hidden');
    
    // Show navigation/dots if more than 1 image
    if (imageUrls.length > 1) {
        dotsContainer.classList.remove('hidden');
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
    } else {
        dotsContainer.classList.add('hidden');
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
    }

    previewGrid.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    imageUrls.forEach((url, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'preview-item';

        previewDiv.innerHTML = `
            <img src="${url}">
            <button type="button" class="remove-photo-btn" onclick="removeImage('${url}')">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        previewGrid.appendChild(previewDiv);

        // Add dot
        const dot = document.createElement('div');
        dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
        dotsContainer.appendChild(dot);
    });

    // Reset scroll to start
    previewGrid.scrollLeft = 0;
}

function updateCarouselUI(container) {
    const dots = document.getElementById('carousel-dots').children;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    // Update dots
    for (let i = 0; i < dots.length; i++) {
        if (i === index) {
            dots[i].classList.add('active');
        } else {
            dots[i].classList.remove('active');
        }
    }

    // Update arrows visibility (optional but nice)
    prevBtn.style.opacity = index === 0 ? '0.3' : '1';
    prevBtn.style.pointerEvents = index === 0 ? 'none' : 'auto';
    nextBtn.style.opacity = index === dots.length - 1 ? '0.3' : '1';
    nextBtn.style.pointerEvents = index === dots.length - 1 ? 'none' : 'auto';
}

function scrollCarousel(direction) {
    const container = document.getElementById('image-preview-grid');
    container.scrollBy({ left: direction * container.clientWidth, behavior: 'smooth' });
}

function removeImage(url) {
    const urlsContainer = document.getElementById('image-urls-container');
    const inputs = Array.from(urlsContainer.querySelectorAll('.post-image-url-hidden'));
    const inputToDelete = inputs.find(input => input.value === url);
    
    if (inputToDelete) {
        inputToDelete.remove();
        renderPreviews();
        const count = urlsContainer.children.length;
        document.getElementById('file-name').textContent = count > 0 ? `Đã cập nhật. Tổng cộng ${count} ảnh.` : '';
    }
}

function showMessage(msg, type) {
    const messageBox = document.getElementById('message-box');
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove('hidden');
}
