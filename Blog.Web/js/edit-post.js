// js/edit-post.js
document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    if (!postId) {
        alert('Không tìm thấy ID bài viết!');
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
            alert('Không tải được dữ liệu bài viết.');
            return;
        }

        // Điền dữ liệu vào form
        document.getElementById('post-title').value = post.title || '';
        document.getElementById('post-summary').value = post.summary || '';
        document.getElementById('post-content').value = post.content || '';

        // Hiển thị trước ảnh cũ
        const imageGrid = document.getElementById('image-preview-grid');
        const container = document.getElementById('image-urls-container');
        
        let imagesToLoad = [];
        if (post.imageUrls && post.imageUrls.length > 0) {
            imagesToLoad = post.imageUrls;
        } else if (post.featuredImageUrl) {
            imagesToLoad = [post.featuredImageUrl];
        }

        if (imagesToLoad.length > 0) {
            imageGrid.classList.remove('hidden');
            imagesToLoad.forEach((url, i) => {
                // Hiển thị preview
                const imgWrap = document.createElement('div');
                imgWrap.style.position = 'relative';
                imgWrap.innerHTML = `
                    <img src="${url}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px;">
                `;
                imageGrid.appendChild(imgWrap);

                // Hidden input (giữ lại data cũ)
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'original-image-url';
                input.value = url;
                container.appendChild(input);
            });
            document.getElementById('file-name').textContent = `Đã tải ${imagesToLoad.length} ảnh ban đầu.`;
        }

    } catch (error) {
        alert('Lỗi: ' + error.message);
        window.location.href = 'index.html';
    }
}

async function handleMultipleImageUpload(input) {
    const files = input.files;
    if (!files || files.length === 0) return;

    if (files.length > 5) {
        alert('Chỉ được chọn tối đa 5 ảnh!');
        input.value = '';
        return;
    }

    const container = document.getElementById('image-urls-container');
    const imageGrid = document.getElementById('image-preview-grid');
    const fileNameSpan = document.getElementById('file-name');

    // Xóa trắng dữ liệu ảnh cũ
    container.innerHTML = '';
    imageGrid.innerHTML = '';
    imageGrid.classList.remove('hidden');
    
    // Đánh dấu người dùng đã tải ảnh mới
    isNewImagesUploaded = true;

    fileNameSpan.textContent = `Đang tải lên ${files.length} ảnh...`;
    
    // Upload từng file
    let uploadedCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Placeholder cho preview
        const wrapId = `preview-${Date.now()}-${i}`;
        const imgWrap = document.createElement('div');
        imgWrap.id = wrapId;
        imgWrap.style.position = 'relative';
        imgWrap.innerHTML = `
            <div style="width: 100%; aspect-ratio: 1; background: #f1f5f9; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-spinner fa-spin" style="color: #94a3b8;"></i>
            </div>
        `;
        imageGrid.appendChild(imgWrap);

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('http://localhost:5246/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            
            // Cập nhật thẻ ẩn
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'uploaded-image-url';
            hiddenInput.value = data.url;
            container.appendChild(hiddenInput);

            document.getElementById(wrapId).innerHTML = `
                <img src="${data.url}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px;">
            `;
            uploadedCount++;
        } catch (error) {
            console.error('Error uploading:', error);
            document.getElementById(wrapId).innerHTML = `
                <div style="width: 100%; aspect-ratio: 1; background: #fee2e2; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #ef4444; font-size: 0.8rem; text-align: center;">
                    Lỗi tải
                </div>
            `;
        }
    }
    
    fileNameSpan.textContent = `Đã chọn và tải xong ${uploadedCount} ảnh mới.`;
}

async function handleEditSubmit(e, postId) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const msgBox = document.getElementById('message-box');
    
    // Lấy link ảnh từ hidden inputs
    // Tùy thuộc vào isNewImagesUploaded, ta lấymảng input nào
    const selector = isNewImagesUploaded ? 'input[name="uploaded-image-url"]' : 'input[name="original-image-url"]';
    const inputs = document.querySelectorAll(selector);
    const imageUrls = Array.from(inputs).map(input => input.value);
    
    const postData = {
        title: document.getElementById('post-title').value.trim(),
        summary: document.getElementById('post-summary').value.trim(),
        content: document.getElementById('post-content').value.trim(),
        imageUrls: imageUrls
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';

    try {
        const result = await window.api.put(`posts/${postId}`, postData);
        msgBox.className = 'message-box success';
        msgBox.innerHTML = result.message || 'Cập nhật thành công!';
        
        // Quay về trang cũ
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (error) {
        msgBox.className = 'message-box error';
        msgBox.innerHTML = error.message;
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Lưu thay đổi';
    }
}
