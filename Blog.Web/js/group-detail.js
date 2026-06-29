// js/group-detail.js v2.0

const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('id');
let currentGroup = null;
let isApprovedMember = false;
let isAdmin = false;
let editUploadedAvatarUrl = null;
let editUploadedCoverUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();

    if (!groupId) {
        alert('Không tìm thấy ID nhóm');
        window.location.href = 'groups.html';
        return;
    }

    // Set quick post avatar
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const avatarImg = document.getElementById('quick-post-avatar');
    if (avatarImg && userInfo.avatarUrl) avatarImg.src = userInfo.avatarUrl;

    await loadGroupDetails();

    // Report modal setup
    const reportOtherRadio = document.getElementById('reason-group-other-radio');
    const reportOtherText  = document.getElementById('report-group-other-text');
    if (reportOtherRadio && reportOtherText) {
        document.querySelectorAll('input[name="report-group-reason"]').forEach(r => {
            r.addEventListener('change', () => {
                if (reportOtherRadio.checked) {
                    reportOtherText.classList.remove('hidden');
                    reportOtherText.required = true;
                } else {
                    reportOtherText.classList.add('hidden');
                    reportOtherText.required = false;
                }
            });
        });
    }
    document.getElementById('report-group-form')?.addEventListener('submit', handleReportGroup);
    document.getElementById('edit-group-form')?.addEventListener('submit', handleEditGroupSubmit);
});

/* ===== Load Group Details ===== */

async function loadGroupDetails() {
    try {
        currentGroup = await window.api.get(`groups/${groupId}`);

        // --- Banner ---
        const cover = currentGroup.coverImageUrl || '';
        document.getElementById('gd-cover').src = cover
            ? cover
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentGroup.name) + '&size=1200&background=1a1a2e&color=818cf8&bold=true&format=png';

        document.getElementById('gd-name').textContent = currentGroup.name;
        document.getElementById('gd-desc').textContent = currentGroup.description || 'Chưa có mô tả.';
        document.getElementById('gd-members').innerHTML = `<i class="fa-solid fa-users"></i> ${currentGroup.memberCount || 0} thành viên`;
        document.title = `${currentGroup.name} - Zynk`;

        // Avatar
        const avatarWrap = document.getElementById('gd-avatar-wrap');
        if (currentGroup.avatarImageUrl) {
            avatarWrap.innerHTML = `<img src="${currentGroup.avatarImageUrl}" alt="${escHtml(currentGroup.name)}">`;
        } else {
            document.getElementById('gd-avatar-letter').textContent = currentGroup.name.charAt(0).toUpperCase();
        }

        // Privacy badge
        const privacyEl = document.getElementById('gd-privacy');
        if (currentGroup.isPrivate) {
            privacyEl.innerHTML = '<i class="fa-solid fa-lock"></i> Riêng tư';
            privacyEl.className = 'gd-meta-chip private';
        } else {
            privacyEl.innerHTML = '<i class="fa-solid fa-globe"></i> Công khai';
            privacyEl.className = 'gd-meta-chip public';
        }

        // Determine membership status
        const memberStatus = currentGroup.memberStatus; // 'Approved', 'Pending', or null
        isApprovedMember = memberStatus === 'Approved';
        isAdmin = isApprovedMember && (currentGroup.role === 'Admin' || currentGroup.ownerId === getCurrentUserId());

        // Action buttons
        const btnJoin    = document.getElementById('gd-btn-join');
        const btnPending = document.getElementById('gd-btn-pending');
        const btnLeave   = document.getElementById('gd-btn-leave');

        btnJoin.classList.add('hidden');
        btnPending.classList.add('hidden');
        btnLeave.classList.add('hidden');

        if (isApprovedMember) {
            btnLeave.classList.remove('hidden');
        } else if (memberStatus === 'Pending') {
            btnPending.classList.remove('hidden');
        } else {
            btnJoin.classList.remove('hidden');
        }

        // Admin controls
        if (isAdmin) {
            document.getElementById('admin-widget').classList.remove('hidden');
            document.getElementById('pending-widget').classList.remove('hidden');
            await loadPendingMembers();
        }

        // Feed visibility
        const postsGrid  = document.getElementById('posts-grid');
        const noPosts    = document.getElementById('no-posts');
        const lockMsg    = document.getElementById('private-lock-msg');
        const quickPost  = document.getElementById('group-quick-post');

        if (currentGroup.isPrivate && !isApprovedMember) {
            lockMsg.classList.remove('hidden');
            postsGrid.classList.add('hidden');
            noPosts.classList.add('hidden');
            quickPost.style.display = 'none';
        } else {
            lockMsg.classList.add('hidden');
            postsGrid.classList.remove('hidden');
            if (isApprovedMember) quickPost.style.display = 'flex';
            await loadGroupPosts();
        }

    } catch (err) {
        console.error(err);
        alert('Không thể tải thông tin nhóm.');
        window.location.href = 'groups.html';
    }
}

/* ===== Load Group Posts — FIXED ===== */

async function loadGroupPosts() {
    const grid   = document.getElementById('posts-grid');
    const noPosts = document.getElementById('no-posts');
    grid.innerHTML = '<div class="post-card skeleton"></div>';

    try {
        const posts = await window.api.get(`groups/${groupId}/posts`);

        if (!posts || posts.length === 0) {
            grid.innerHTML = '';
            noPosts.classList.remove('hidden');
            return;
        }

        noPosts.classList.add('hidden');
        grid.innerHTML = '';

        posts.forEach(p => {
            // Cache for modal usage
            if (!window._postCache) window._postCache = {};
            window._postCache[p.id] = p;

            // Use common.createPostCard (returns a DOM element — fixes the render-to-mainpage bug)
            if (window.common && window.common.createPostCard) {
                grid.appendChild(window.common.createPostCard(p));
            }
        });

        if (window.postActions && window.postActions.setupReadMore) {
            window.postActions.setupReadMore();
        }

    } catch (err) {
        if (err.status === 404 || err.message?.includes('404')) {
            grid.innerHTML = '';
            noPosts.classList.remove('hidden');
        } else {
            grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px;">Lỗi tải bài viết.</p>';
        }
    }
}

/* ===== Join / Leave ===== */

async function toggleJoinGroup() {
    try {
        if (isApprovedMember) {
            if (!confirm('Bạn có chắc muốn rời nhóm này?')) return;
            await window.api.post(`groups/${groupId}/leave`);
        } else {
            await window.api.post(`groups/${groupId}/join`);
        }
        await loadGroupDetails();
    } catch (err) {
        alert(err.message || 'Đã xảy ra lỗi');
    }
}

/* ===== Pending Members ===== */

async function loadPendingMembers() {
    const list  = document.getElementById('pending-list');
    const badge = document.getElementById('pending-count-badge');
    try {
        const pending = await window.api.get(`groups/${groupId}/pending-members`);
        if (!pending || pending.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">Không có yêu cầu nào.</p>';
            badge.style.display = 'none';
            return;
        }

        badge.textContent = pending.length;
        badge.style.display = '';

        list.innerHTML = pending.map(m => `
            <div class="pending-member-item" id="pending-${m.userId}">
                <div class="pending-member-avatar">
                    ${m.avatarUrl
                        ? `<img src="${m.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
                        : escHtml((m.fullName || 'U').charAt(0).toUpperCase())
                    }
                </div>
                <div class="pending-member-info">
                    <div class="pending-member-name">${escHtml(m.fullName)}</div>
                    <div class="pending-member-time">@${escHtml(m.username)} · ${formatRelTime(m.requestedAt)}</div>
                </div>
                <div class="pending-member-btns">
                    <button class="btn-approve" onclick="approveMember('${m.userId}')">Duyệt</button>
                    <button class="btn-reject"  onclick="rejectMember('${m.userId}')">Từ chối</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Pending members error:', err);
    }
}

async function approveMember(userId) {
    const row = document.getElementById(`pending-${userId}`);
    if (row) row.style.opacity = '0.5';
    try {
        await window.api.post(`groups/${groupId}/approve/${userId}`);
        if (row) row.remove();
        // Update badge count
        await loadPendingMembers();
        // Refresh member count
        currentGroup = await window.api.get(`groups/${groupId}`);
        document.getElementById('gd-members').innerHTML = `<i class="fa-solid fa-users"></i> ${currentGroup.memberCount || 0} thành viên`;
    } catch (err) {
        if (row) row.style.opacity = '1';
        alert(err.message || 'Lỗi khi duyệt thành viên');
    }
}

async function rejectMember(userId) {
    const row = document.getElementById(`pending-${userId}`);
    if (row) row.style.opacity = '0.5';
    try {
        await window.api.post(`groups/${groupId}/reject/${userId}`);
        if (row) row.remove();
        await loadPendingMembers();
    } catch (err) {
        if (row) row.style.opacity = '1';
        alert(err.message || 'Lỗi khi từ chối');
    }
}

/* ===== Edit Group Modal ===== */

function openEditGroupModal() {
    if (!currentGroup) return;
    editUploadedAvatarUrl = currentGroup.avatarImageUrl || null;
    editUploadedCoverUrl  = currentGroup.coverImageUrl  || null;

    document.getElementById('edit-group-name').value    = currentGroup.name;
    document.getElementById('edit-group-desc').value    = currentGroup.description || '';
    document.getElementById('edit-group-private').checked = currentGroup.isPrivate;

    // Show avatar preview
    const avatarPrev = document.getElementById('edit-avatar-preview');
    if (currentGroup.avatarImageUrl) {
        avatarPrev.innerHTML = `<img src="${currentGroup.avatarImageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
    } else {
        avatarPrev.innerHTML = '<i class="fa-solid fa-image"></i>';
    }

    // Show cover preview
    const coverPrev = document.getElementById('edit-cover-preview');
    if (currentGroup.coverImageUrl) {
        coverPrev.innerHTML = `<img src="${currentGroup.coverImageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
    } else {
        coverPrev.innerHTML = '<i class="fa-solid fa-panorama"></i>';
    }

    document.getElementById('edit-group-modal').classList.remove('hidden');
}

function closeEditGroupModal() {
    document.getElementById('edit-group-modal').classList.add('hidden');
}

async function handleEditAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('edit-avatar-preview').innerHTML =
            `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
    };
    reader.readAsDataURL(file);

    try {
        const res = await window.api.uploadImage(file);
        editUploadedAvatarUrl = res.url;
    } catch (err) {
        alert('Không thể tải ảnh đại diện lên. Vui lòng thử lại.');
    }
}

async function handleEditCoverUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('edit-cover-preview').innerHTML =
            `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
    };
    reader.readAsDataURL(file);

    try {
        const res = await window.api.uploadImage(file);
        editUploadedCoverUrl = res.url;
    } catch (err) {
        alert('Không thể tải ảnh bìa lên. Vui lòng thử lại.');
    }
}

async function handleEditGroupSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    const payload = {
        name:           document.getElementById('edit-group-name').value.trim(),
        description:    document.getElementById('edit-group-desc').value.trim(),
        coverImageUrl:  editUploadedCoverUrl  || currentGroup.coverImageUrl  || null,
        avatarImageUrl: editUploadedAvatarUrl || currentGroup.avatarImageUrl || null,
        isPrivate:      document.getElementById('edit-group-private').checked
    };

    try {
        await window.api.put(`groups/${groupId}`, payload);
        closeEditGroupModal();
        showToast('Đã cập nhật thông tin nhóm!', 'success');
        await loadGroupDetails();
    } catch (err) {
        alert(err.message || 'Lỗi khi cập nhật nhóm');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi';
    }
}

/* ===== Report Group ===== */

function openReportGroupModal()  { document.getElementById('report-group-modal').classList.remove('hidden'); }
function closeReportGroupModal() { document.getElementById('report-group-modal').classList.add('hidden'); }

async function handleReportGroup(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Đang gửi...';
    btn.disabled = true;

    const radios = document.getElementsByName('report-group-reason');
    let reason = '';
    for (const r of radios) { if (r.checked) { reason = r.value; break; } }
    if (reason === 'Khác') reason = document.getElementById('report-group-other-text').value.trim();

    try {
        await window.api.post(`groups/${groupId}/report`, { reason });
        alert('Đã gửi báo cáo cho Quản trị viên xử lý.');
        closeReportGroupModal();
    } catch (err) {
        alert(err.message || 'Lỗi khi báo cáo');
    } finally {
        btn.textContent = 'Gửi báo cáo';
        btn.disabled = false;
    }
}

/* ===== Navigate to Create Post ===== */

function goToCreateGroupPost() {
    window.location.href = `create-post.html?groupId=${groupId}`;
}

/* ===== Utility ===== */

function getCurrentUserId() {
    try { return JSON.parse(localStorage.getItem('user_info') || '{}').id || ''; }
    catch { return ''; }
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatRelTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'vừa xong';
    if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
}

function showToast(msg, type = 'info') {
    const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#6366f1' };
    const old = document.getElementById('gd-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'gd-toast';
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${colors[type]};color:#fff;padding:12px 24px;border-radius:12px;font-weight:600;font-size:0.9rem;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.2);max-width:360px;text-align:center;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

// Expose globals
window.toggleJoinGroup      = toggleJoinGroup;
window.openReportGroupModal = openReportGroupModal;
window.closeReportGroupModal = closeReportGroupModal;
window.openEditGroupModal   = openEditGroupModal;
window.closeEditGroupModal  = closeEditGroupModal;
window.approveMember        = approveMember;
window.rejectMember         = rejectMember;
window.goToCreateGroupPost  = goToCreateGroupPost;
window.handleEditAvatarUpload = handleEditAvatarUpload;
window.handleEditCoverUpload  = handleEditCoverUpload;
