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
            row.innerHTML = `
                <td>${report.reporterName}</td>
                <td>
                    <div class="clickable-title" onclick="showPostPreview('${report.id}')" style="font-weight:600;">${report.postTitle || 'Bài viết đã bị xóa'}</div>
                    <div style="font-size:0.8rem; color:#64748b;">Tác giả: ${report.postAuthorName}</div>
                </td>
                <td style="color:#ef4444; font-weight:500;">${report.reason}</td>
                <td style="color:#64748b; font-size:0.85rem;">${new Date(report.createdAt).toLocaleString('vi-VN')}</td>
                <td><span class="badge ${report.isResolved ? 'badge-resolved' : 'badge-pending'}">${report.isResolved ? 'Đã xử lý' : 'Chờ xử lý'}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-action" title="Xem nội dung" onclick="showPostPreview('${report.id}')"><i class="fa-solid fa-eye"></i></button>
                        ${!report.isResolved ? `
                            <button class="btn-action" style="color: #10b981;" title="Đã xem" onclick="resolveReport('${report.id}')"><i class="fa-solid fa-check"></i></button>
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

function showPostPreview(reportId) {
    const report = currentReports.find(r => r.id === reportId);
    if (!report) return;

    const modal = document.getElementById('post-preview-modal');
    const content = document.getElementById('post-preview-content');

    if (!report.postId) {
        content.innerHTML = '<div style="text-align:center; padding: 2rem; color: #64748b;">Bài viết này đã bị xóa hoặc không còn tồn tại.</div>';
    } else {
        content.innerHTML = `
            <div class="post-preview-header">
                <h1 class="post-preview-title">${report.postTitle}</h1>
                <div class="post-preview-meta">
                    <span><i class="fa-solid fa-user"></i> ${report.postAuthorName}</span>
                    <span>•</span>
                    <span><i class="fa-solid fa-calendar"></i> ${new Date(report.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
            </div>
            ${report.postImageUrl ? `
                <img src="${report.postImageUrl}" class="post-preview-image" alt="Featured image">
            ` : ''}
            <div class="post-preview-body">
                ${report.postContent}
            </div>
        `;
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
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
