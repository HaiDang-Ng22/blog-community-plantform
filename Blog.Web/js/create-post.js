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

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('post-title').value.trim();
        const summary = document.getElementById('post-summary').value.trim();
        const content = document.getElementById('post-content').value.trim();

        // Collect all image URLs from hidden inputs
        const imageUrls = Array.from(document.querySelectorAll('.post-image-url-hidden')).map(input => input.value);

        if (!title || !content) {
            showMessage('Vui lòng nhập đầy đủ tiêu đề và nội dung.', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Đang đăng bài...';

        try {
            await window.api.post('posts', {
                title,
                content,
                summary,
                imageUrls
            });

            showMessage('Đăng bài thành công! Đang quay lại trang chủ...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            showMessage(error.message || 'Lỗi khi đăng bài. Vui lòng thử lại.', 'error');
            btn.disabled = false;
            btn.textContent = 'Đăng bài ngay';
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

    fileNameSpan.textContent = `Đang tải ${files.length} ảnh...`;
    previewGrid.classList.remove('hidden');
    previewGrid.style.display = 'grid';

    // Clear previous if needed or append? For now, clear.
    previewGrid.innerHTML = '';
    urlsContainer.innerHTML = '';

    for (const file of files) {
        try {
            const result = await window.api.uploadImage(file);
            
            // Add hidden input
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.className = 'post-image-url-hidden';
            hiddenInput.value = result.url;
            urlsContainer.appendChild(hiddenInput);

            // Add preview
            const previewDiv = document.createElement('div');
            previewDiv.style.position = 'relative';
            previewDiv.style.paddingTop = '100%'; // Square crop
            previewDiv.innerHTML = `
                <img src="${result.url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
            `;
            previewGrid.appendChild(previewDiv);

        } catch (error) {
            console.error('Error uploading file:', file.name, error);
            alert(`Lỗi khi tải ảnh ${file.name}: ${error.message}`);
        }
    }

    fileNameSpan.textContent = `Đã tải xong ${urlsContainer.children.length} ảnh.`;
}

function showMessage(msg, type) {
    const messageBox = document.getElementById('message-box');
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove('hidden');
}
