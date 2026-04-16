// Admin Report Management Logic

let currentReports = [];

async function loadAdminReports() {
    const list = document.getElementById('admin-reports-list');
    const badge = document.getElementById('report-count-badge');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const reports = await window.api.get('admin/reports');
        currentReports = reports;
        list.innerHTML = '';
        
        const pendingCount = reports.filter(r => !r.isResolved).length;
        if (badge) {
            if (pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        if (reports.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">Chưa có báo cáo vi phạm nào.</td></tr>';
            return;
        }

        reports.forEach(report => {
            const row = document.createElement('tr');
            
            // Privacy badge
            const privacyBadge = report.postAuthorIsPrivate
                ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:20px; background:#fef3c7; color:#92400e; margin-left:6px;" title="Bài viết trong tài khoản riêng tư"><i class="fa-solid fa-lock"></i> Riêng tư</span>`
                : '';

            row.innerHTML = `
                <td>${report.reporterName}</td>
                <td>
                    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                        <span class="clickable-title" onclick="showPostPreview('${report.id}')" style="font-weight:600;">${report.postTitle || 'Bài viết đã bị xóa'}</span>
                        ${privacyBadge}
                    </div>
                    <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">Tác giả: ${report.postAuthorName}</div>
                </td>
                <td style="color:#ef4444; font-weight:500;">${report.reason}</td>
                <td style="color:#64748b; font-size:0.85rem;">${new Date(report.createdAt).toLocaleString('vi-VN')}</td>
                <td><span class="badge ${report.isResolved ? 'badge-resolved' : 'badge-pending'}">${report.isResolved ? 'Đã xử lý' : 'Chờ xử lý'}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-action" title="Xem nội dung bài viết" onclick="showPostPreview('${report.id}')"><i class="fa-solid fa-eye"></i></button>
                        ${!report.isResolved ? `
                            <button class="btn-action" style="color: #10b981;" title="Đánh dấu đã xử lý" onclick="resolveReport('${report.id}')"><i class="fa-solid fa-check"></i></button>
                            ${report.postId ? `
                                <button class="btn-action danger" title="Xóa bài viết & Cảnh báo" onclick="deleteViolatingPost('${report.postId}', '${report.id}')"><i class="fa-solid fa-trash-can"></i></button>
                            ` : ''}
                        ` : '<i class="fa-solid fa-circle-check" style="color:#10b981; margin-left:10px; font-size: 1.2rem;"></i>'}
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (error) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi tải báo cáo: ${error.message}</td></tr>`;
    }
}

/**
 * Show full post preview for a report.
 * Uses data already in the report (from API), and fetches via admin endpoint
 * to guarantee full content regardless of privacy settings.
 */
async function showPostPreview(reportId) {
    const report = currentReports.find(r => r.id === reportId);
    if (!report) return;

    const modal = document.getElementById('post-preview-modal');
    const content = document.getElementById('post-preview-content');

    if (!report.postId) {
        content.innerHTML = '<div style="text-align:center; padding: 2rem; color: #64748b;"><i class="fa-solid fa-trash-can" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>Bài viết này đã bị xóa hoặc không còn tồn tại.</div>';
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        return;
    }

    // Show skeleton while loading
    content.innerHTML = `
        <div style="text-align:center; padding:2rem; color:#64748b;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
            Đang tải nội dung bài viết...
        </div>`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        // Fetch full post data via admin endpoint (bypasses all privacy restrictions)
        const post = await window.api.get(`admin/posts/${report.postId}`);
        
        const privacyWarning = post.authorIsPrivate
            ? `<div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fef9c3; border:1px solid #fde68a; border-radius:10px; margin-bottom:1.5rem; color:#92400e; font-size:0.875rem;">
                <i class="fa-solid fa-lock"></i>
                <span><strong>Bài viết riêng tư</strong> — Người dùng đã giới hạn hiển thị bài viết chỉ cho người theo dõi. Admin xem được vì mục đích kiểm duyệt.</span>
               </div>`
            : '';

        // Build image gallery (all images, not just featured)
        let imageGallery = '';
        const allImages = (post.imageUrls && post.imageUrls.length > 0) ? post.imageUrls : (post.featuredImageUrl ? [post.featuredImageUrl] : []);
        if (allImages.length === 1) {
            imageGallery = `<img src="${allImages[0]}" class="post-preview-image" alt="Ảnh bài viết" onerror="this.style.display='none'">`;
        } else if (allImages.length > 1) {
            const imgItems = allImages.map(url => 
                `<img src="${url}" style="width:100%; height:200px; object-fit:cover; border-radius:10px;" alt="Ảnh" onerror="this.style.display='none'">`
            ).join('');
            imageGallery = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; margin:1.5rem 0;">${imgItems}</div>`;
        }

        content.innerHTML = `
            ${privacyWarning}
            <div class="post-preview-header">
                <h1 class="post-preview-title">${post.title}</h1>
                <div class="post-preview-meta">
                    <span><i class="fa-solid fa-user"></i> ${post.authorName}</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-calendar"></i> ${new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-eye"></i> ${post.viewCount.toLocaleString()} lượt xem</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-heart"></i> ${post.likeCount.toLocaleString()} lượt thích</span>
                </div>
            </div>
            ${imageGallery}
            <div class="post-preview-body">${post.content}</div>
        `;
    } catch (err) {
        // Fallback: render from cached report data (may be partial)
        const privacyWarning = report.postAuthorIsPrivate
            ? `<div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fef9c3; border:1px solid #fde68a; border-radius:10px; margin-bottom:1.5rem; color:#92400e; font-size:0.875rem;">
                <i class="fa-solid fa-lock"></i>
                <span><strong>Bài viết riêng tư</strong> — Admin xem được vì mục đích kiểm duyệt.</span>
               </div>`
            : '';

        const allImages = (report.postImageUrls && report.postImageUrls.length > 0)
            ? report.postImageUrls
            : (report.postImageUrl ? [report.postImageUrl] : []);

        let imageGallery = '';
        if (allImages.length === 1) {
            imageGallery = `<img src="${allImages[0]}" class="post-preview-image" alt="Ảnh bài viết" onerror="this.style.display='none'">`;
        } else if (allImages.length > 1) {
            const imgItems = allImages.map(url =>
                `<img src="${url}" style="width:100%; height:200px; object-fit:cover; border-radius:10px;" alt="Ảnh" onerror="this.style.display='none'">`
            ).join('');
            imageGallery = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; margin:1.5rem 0;">${imgItems}</div>`;
        }

        content.innerHTML = `
            ${privacyWarning}
            <div class="post-preview-header">
                <h1 class="post-preview-title">${report.postTitle}</h1>
                <div class="post-preview-meta">
                    <span><i class="fa-solid fa-user"></i> ${report.postAuthorName}</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-calendar"></i> ${new Date(report.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
            </div>
            ${imageGallery}
            <div class="post-preview-body">${report.postContent}</div>
        `;
    }
}

function closePostPreview() {
    const modal = document.getElementById('post-preview-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = ''; 
}

async function deleteViolatingPost(postId, reportId) {
    if (!confirm('Xác nhận xóa bài viết này và gửi thông báo vi phạm đến người dùng?')) return;

    try {
        const result = await window.api.delete(`admin/posts/${postId}`);
        await window.api.post(`admin/reports/${reportId}/resolve`);
        closePostPreview();
        window.common.showToast(result.message, 'success');
        loadAdminReports();
    } catch (error) {
        window.common.showToast('Lỗi: ' + error.message, 'error');
    }
}

async function resolveReport(reportId) {
    try {
        await window.api.post(`admin/reports/${reportId}/resolve`);
        window.common.showToast('Đã đánh dấu báo cáo là đã xử lý', 'success');
        loadAdminReports();
    } catch (error) {
        window.common.showToast('Lỗi: ' + error.message, 'error');
    }
}

// Global scope attachment
window.loadAdminReports = loadAdminReports;
window.showPostPreview = showPostPreview;
window.closePostPreview = closePostPreview;
window.deleteViolatingPost = deleteViolatingPost;
window.resolveReport = resolveReport;
