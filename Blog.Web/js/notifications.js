// js/notifications.js
document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('noti-trigger');
    const dropdown = document.getElementById('noti-dropdown');
    
    if (trigger) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                loadNotifications();
            }
        });

        // Close on click outside
        document.addEventListener('click', () => dropdown.classList.add('hidden'));
        dropdown.addEventListener('click', (e) => e.stopPropagation());

        // Initial check
        checkUnreadCount();
        // Polling (optional, every 30s)
        setInterval(checkUnreadCount, 30000);
    }
});

async function checkUnreadCount() {
    if (window.loadNotificationBadge) {
        await window.loadNotificationBadge();
    }
}

async function loadNotifications() {
    const list = document.getElementById('noti-list');
    list.innerHTML = '<div class="noti-item">Đang tải...</div>';
    
    try {
        const notis = await window.api.get('notifications');
        list.innerHTML = '';
        
        if (notis.length === 0) {
            list.innerHTML = '<div class="noti-item">Không có thông báo nào</div>';
            return;
        }

        // Admin extra notifications (Reports)
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        if (userInfo.role === 'Admin' || userInfo.Role === 'Admin') {
            try {
                const reports = await window.api.get('admin/reports');
                const pendingReports = reports.filter(r => !r.isResolved);
                pendingReports.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'noti-item unread report-noti';
                    item.style.borderLeft = '4px solid #ef4444';
                    item.innerHTML = `
                        <div class="noti-avatar" style="display:flex; align-items:center; justify-content:center; background:#fee2e2; color:#ef4444;">
                            <i class="fa-solid fa-flag"></i>
                        </div>
                        <div class="noti-content">
                            <strong>${r.reporterName}</strong> đã báo cáo vi phạm: <em>${r.reason}</em>
                            <div class="noti-time">${formatTime(r.createdAt)}</div>
                        </div>
                    `;
                    item.onclick = () => window.location.href = 'admin.html';
                    list.appendChild(item);
                });
            } catch (e) { console.warn('Failed to load admin reports for notifications'); }
        }

        notis.forEach(n => {
            const item = document.createElement('div');
            item.className = `noti-item ${n.isRead ? '' : 'unread'}`;
            item.innerHTML = `
                <img src="${n.actorAvatarUrl || 'https://via.placeholder.com/40'}" class="noti-avatar">
                <div class="noti-content">
                    <strong>${n.actorName}</strong> ${n.message}
                    <div class="noti-time">${formatTime(n.createdAt)}</div>
                </div>
                <div class="noti-delete-btn" title="Xóa thông báo" onclick="deleteNotification('${n.id}', event)">
                    <i class="fa fa-times"></i>
                </div>
            `;
            item.onclick = async () => {
                if (!n.isRead) {
                    await window.api.post(`notifications/${n.id}/read`);
                    checkUnreadCount();
                }
                
                // Logic redirect based on type
                if (n.type === 'Like' || n.type === 'Comment') {
                    window.location.href = `index.html#post-${n.targetId}`;
                } else if (n.type === 'NewOrder' || n.type === 'OrderCancelled') {
                    window.location.href = `seller-order-detail.html?id=${n.targetId}`;
                } else if (n.type === 'OrderStatusUpdated') {
                    window.location.href = `order-detail.html?id=${n.targetId}`;
                } else if (n.type === 'Report' || n.type === 'Complaint') {
                    window.location.href = `admin.html`;
                } else if (n.targetId) {
                    // Fallback
                    window.location.href = `index.html#post-${n.targetId}`;
                }
            };
            list.appendChild(item);
        });
    } catch (e) {
        list.innerHTML = '<div class="noti-item">Lỗi khi tải thông báo</div>';
    }
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
}

// Add Mark all as read listener
document.getElementById('mark-all-read')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await window.api.post('notifications/read-all');
    loadNotifications();
    checkUnreadCount();
});

async function deleteNotification(id, event) {
    if (event) event.stopPropagation();
    try {
        await window.api.delete(`notifications/${id}`);
        loadNotifications();
        checkUnreadCount();
    } catch (e) {
        alert('Lỗi khi xóa thông báo');
    }
}
