// js/edit-post.js
document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const userName = userInfo.fullName || userInfo.username || 'User';
    const userAvatar = userInfo.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
    document.getElementById('user-name-mini').textContent = userName;
    document.getElementById('user-avatar-mini').src = userAvatar;

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    if (!postId) {
        alert(window.t('post_id_not_found'));
        window.location.href = 'index.html';
        return;
    }

    await loadPostData(postId);

    document.getElementById('form-edit-post').addEventListener('submit', (e) => handleEditSubmit(e, postId));
});

let isNewImagesUploaded = false; // Flag to check if we should override images

async function loadPostData(postId) {
    try {
        const post = await window.api.get(`posts/${postId}`);
        if (!post) {
            alert(window.t('load_post_failed'));
            return;
        }

        // Điền dữ liệu vào form
        document.getElementById('post-title').value = post.title || '';
        document.getElementById('post-summary').value = post.summary || '';
        document.getElementById('post-content').value = post.content || '';

        // Hiển thị trước ảnh cũ
        const container = document.getElementById('image-urls-container');
        
        let imagesToLoad = [];
        if (post.imageUrls && post.imageUrls.length > 0) {
            imagesToLoad = post.imageUrls;
        } else if (post.featuredImageUrl) {
            imagesToLoad = [post.featuredImageUrl];
        }

        if (imagesToLoad.length > 0) {
            imagesToLoad.forEach(url => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.className = 'post-image-url-hidden';
                input.value = url;
                container.appendChild(input);
            });
            renderPreviews();
            document.getElementById('file-name').textContent = window.t('loaded_original_images').replace('{count}', imagesToLoad.length);
        } else {
            document.getElementById('image-empty-state').classList.remove('hidden');
        }

    } catch (error) {
        alert('Lỗi: ' + error.message);
        window.location.href = 'index.html';
    }
}

async function handleMultipleImageUpload(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    const container = document.getElementById('image-urls-container');
    const previewGrid = document.getElementById('image-preview-grid');
    const fileNameSpan = document.getElementById('file-name');
    const addMoreBtn = document.getElementById('btn-add-more-images');

    fileNameSpan.textContent = window.t('uploading_images').replace('{count}', files.length);
    previewGrid.classList.remove('hidden');
    document.getElementById('image-empty-state').classList.add('hidden');
    addMoreBtn.classList.remove('hidden');

    for (const file of files) {
        try {
            const result = await window.api.uploadImage(file);
            
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.className = 'post-image-url-hidden';
            hiddenInput.value = result.url;
            container.appendChild(hiddenInput);

            renderPreviews();
        } catch (error) {
            console.error('Error uploading:', error);
            alert(`Lỗi khi tải ảnh ${file.name}: ${error.message}`);
        }
    }
    
    input.value = '';
    fileNameSpan.textContent = `Đã tải xong. Tổng cộng ${container.children.length} ảnh.`;
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

    // Update arrows visibility
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

async function handleEditSubmit(e, postId) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const msgBox = document.getElementById('message-box');
    
    // Lấy link ảnh từ hidden inputs
    const inputs = document.querySelectorAll('.post-image-url-hidden');
    const imageUrls = Array.from(inputs).map(input => input.value);
    
    const postData = {
        title: document.getElementById('post-title').value.trim() || '',
        summary: document.getElementById('post-summary').value.trim() || '',
        content: document.getElementById('post-content').value.trim(),
        imageUrls: imageUrls
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${window.t('processing')}`;

    try {
        const result = await window.api.put(`posts/${postId}`, postData);
        msgBox.className = 'message-box success';
        msgBox.innerHTML = result.message || window.t('update_success');
        
        // Quay về trang cũ
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (error) {
        msgBox.className = 'message-box error';
        msgBox.innerHTML = error.message;
        submitBtn.disabled = false;
        submitBtn.innerHTML = window.t('save_changes');
    }
}
