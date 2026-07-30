// js/groups.js v3.0

let currentTab = 'my-groups';
let allGroups = [];
let uploadedAvatarUrl = null;
let uploadedCoverUrl = null;
let mediaUploadsInProgress = 0;

document.addEventListener('DOMContentLoaded', () => {
    requireAuth();

    // Setup tabs
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.type;
            document.getElementById('group-search-input').value = '';
            loadGroups();
        });
    });

    // Handle create form submit
    const createForm = document.getElementById('create-group-form');
    if (createForm) createForm.addEventListener('submit', handleCreateGroup);

    document.getElementById('group-sort')?.addEventListener('change', applyFilters);
    document.getElementById('group-search-reset')?.addEventListener('click', () => {
        const input = document.getElementById('group-search-input');
        input.value = '';
        input.focus();
        applyFilters();
    });
    bindCharacterCounter('group-name', 'group-name-count', 80);
    bindCharacterCounter('group-desc', 'group-desc-count', 500);

    document.getElementById('create-group-modal')?.addEventListener('click', event => {
        if (event.target.id === 'create-group-modal') closeCreateGroupModal();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeCreateGroupModal();
    });

    loadGroups();
    loadOwnedGroups();
});

/* ---- Data Loading ---- */

async function loadGroups() {
    const grid = document.getElementById('groups-grid');
    grid.innerHTML = `<div class="groups-loading"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Đang tải...</p></div>`;
    try {
        const endpoint = currentTab === 'my-groups' ? 'groups/my' : 'groups';
        allGroups = await window.api.get(endpoint) || [];

        if (currentTab === 'pending') {
            allGroups = allGroups.filter(group => group.memberStatus === 'Pending');
        }

        if (allGroups.length === 0) {
            renderEmpty();
            return;
        }
        applyFilters();
    } catch (err) {
        grid.innerHTML = `<div class="groups-loading" style="color:var(--text-secondary)"><i class="fa-solid fa-triangle-exclamation fa-2x"></i><p>Không thể tải dữ liệu.</p></div>`;
    }
}

async function loadOwnedGroups() {
    const list = document.getElementById('my-owned-groups-list');
    if (!list) return;
    try {
        const groups = await window.api.get('groups/my') || [];
        const owned = groups.filter(g => g.role === 'Admin' || g.ownerId === getCurrentUserId());
        const pendingTotal = owned.reduce((total, group) => total + (group.pendingRequestCount || 0), 0);
        updateSummary(groups, pendingTotal);

        if (owned.length === 0) {
            list.innerHTML = `<p style="color:var(--text-secondary);font-size:0.85rem;padding:8px 4px;">Bạn chưa quản lý nhóm nào.</p>`;
            return;
        }

        list.innerHTML = owned.map(g => `
            <a href="group-detail.html?id=${g.id}" class="owned-group-item">
                ${g.avatarImageUrl
                    ? `<img src="${g.avatarImageUrl}" class="owned-group-img" onerror="this.style.display='none'">`
                    : `<div class="owned-group-img" style="display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;">${g.name.charAt(0).toUpperCase()}</div>`
                }
                <div class="owned-group-text">
                    <div class="owned-group-name">${escHtml(g.name)}</div>
                    <div class="owned-group-role"><i class="fa-solid fa-crown" style="font-size:0.65rem;"></i> Quản trị viên</div>
                    <div class="owned-group-members">${g.memberCount || 0} thành viên</div>
                </div>
                ${g.pendingRequestCount > 0 ? `<span class="owned-pending-badge" title="Yêu cầu đang chờ">${g.pendingRequestCount}</span>` : ''}
            </a>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

function getCurrentUserId() {
    try {
        return JSON.parse(localStorage.getItem('user_info') || '{}').id || '';
    } catch { return ''; }
}

/* ---- Rendering ---- */

function renderGroups(groups) {
    const grid = document.getElementById('groups-grid');
    if (!groups || groups.length === 0) { renderEmpty(); return; }
    grid.innerHTML = groups.map((g, i) => renderGroupCard(g, i)).join('');
}

function renderEmpty() {
    const grid = document.getElementById('groups-grid');
    const msg = currentTab === 'my-groups'
        ? 'Bạn chưa tham gia cộng đồng nào. Hãy khám phá và tham gia!'
        : currentTab === 'pending'
            ? 'Bạn không có yêu cầu tham gia nào đang chờ duyệt.'
            : 'Không tìm thấy cộng đồng nào phù hợp.';
    grid.innerHTML = `
        <div class="groups-loading" style="grid-column:1/-1;">
            <i class="fa-solid fa-users-slash fa-3x" style="opacity:0.35;"></i>
            <p style="color:var(--text-secondary);">${msg}</p>
        </div>`;
}

function renderGroupCard(g, index = 0) {
    const cover = g.coverImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(g.name)}&size=400&background=6366f1&color=fff&bold=true&format=png`;
    const privacyBadge = g.isPrivate
        ? `<span class="group-privacy-badge private"><i class="fa-solid fa-lock"></i> Riêng tư</span>`
        : `<span class="group-privacy-badge public"><i class="fa-solid fa-globe"></i> Công khai</span>`;

    let avatarHtml = '';
    if (g.avatarImageUrl) {
        avatarHtml = `<img src="${g.avatarImageUrl}" class="group-card-avatar" onerror="this.style.display='none';" alt="">`;
    } else {
        avatarHtml = `<div class="group-card-avatar-fallback">${g.name.charAt(0).toUpperCase()}</div>`;
    }

    let actionBtn = '';
    const status = g.memberStatus;
    if (currentTab === 'pending') {
        actionBtn = `<button class="btn-pending-cancel" onclick="cancelJoinRequest(event,'${g.id}')"><i class="fa-solid fa-xmark"></i> Hủy yêu cầu</button>`;
    } else if (currentTab === 'discover') {
        if (status === 'Approved') {
            actionBtn = `<button class="btn-visit" onclick="goToGroup(event,'${g.id}')"><i class="fa-solid fa-arrow-right"></i> Đã tham gia</button>`;
        } else if (status === 'Pending') {
            actionBtn = `<button class="btn-visit" style="opacity:0.6;cursor:default;" disabled><i class="fa-solid fa-clock"></i> Đang chờ duyệt</button>`;
        } else {
            actionBtn = `<button class="btn-join" onclick="joinGroup(event,'${g.id}')"><i class="fa-solid ${g.isPrivate ? 'fa-paper-plane' : 'fa-user-plus'}"></i> ${g.isPrivate ? 'Gửi yêu cầu' : 'Tham gia'}</button>`;
        }
    } else {
        actionBtn = `<button class="btn-visit" onclick="goToGroup(event,'${g.id}')"><i class="fa-solid fa-arrow-right"></i> Truy cập nhóm</button>`;
    }

    return `
        <div class="group-card" onclick="goToGroup(null,'${g.id}')" style="animation-delay:${index * 0.05}s;">
            <div class="group-card-cover-wrap">
                <img src="${cover}" class="group-cover" alt="${escHtml(g.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(g.name)}&size=400&background=8b5cf6&color=fff&bold=true'">
                ${privacyBadge}
                ${g.role === 'Admin' ? '<span class="group-owner-badge"><i class="fa-solid fa-crown"></i> Quản trị</span>' : ''}
                ${avatarHtml}
            </div>
            <div class="group-info">
                <div class="group-name" title="${escHtml(g.name)}">${escHtml(g.name)}</div>
                <div class="group-meta">
                    <i class="fa-solid fa-users" style="font-size:0.75rem;"></i> ${g.memberCount || 0} thành viên
                    ${g.pendingRequestCount > 0 ? `<span class="card-pending"><i class="fa-solid fa-user-clock"></i> ${g.pendingRequestCount} chờ duyệt</span>` : ''}
                </div>
                <div class="group-desc">${escHtml(g.description || 'Không có mô tả.')}</div>
                <div class="group-action">${actionBtn}</div>
            </div>
        </div>`;
}

/* ---- Search / Filter ---- */

function filterGroups(query) {
    document.getElementById('group-search-reset')?.classList.toggle('hidden', !query.trim());
    applyFilters();
}

function applyFilters() {
    const query = normalizeSearch(document.getElementById('group-search-input')?.value || '');
    const sort = document.getElementById('group-sort')?.value || 'popular';
    let filtered = allGroups.filter(group => {
        if (!query) return true;
        return normalizeSearch(group.name).includes(query) || normalizeSearch(group.description || '').includes(query);
    });

    filtered = [...filtered].sort((left, right) => {
        if (sort === 'newest') return new Date(right.createdAt) - new Date(left.createdAt);
        if (sort === 'name') return left.name.localeCompare(right.name, 'vi');
        return (right.memberCount || 0) - (left.memberCount || 0);
    });
    if (filtered.length) renderGroups(filtered); else renderEmpty();
}

function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

/* ---- Modal Helpers ---- */

function openCreateGroupModal() {
    uploadedAvatarUrl = null;
    uploadedCoverUrl = null;
    document.getElementById('create-group-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    setTimeout(() => document.getElementById('group-name')?.focus(), 80);
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
    document.getElementById('create-group-form').reset();
    uploadedAvatarUrl = null;
    uploadedCoverUrl = null;
    document.body.classList.remove('modal-open');
    // Reset avatar preview
    const preview = document.getElementById('create-avatar-preview');
    preview.innerHTML = '<i class="fa-solid fa-image"></i>';
    document.getElementById('create-cover-preview').innerHTML = '<i class="fa-solid fa-panorama"></i><span>Chọn ảnh bìa</span>';
    document.getElementById('create-cover-preview').classList.remove('has-image');
    updateCharacterCounter('group-name', 'group-name-count', 80);
    updateCharacterCounter('group-desc', 'group-desc-count', 500);
}

async function previewAvatar(input) {
    const file = getValidImage(input);
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('create-avatar-preview');
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary via API
    mediaUploadsInProgress++;
    try {
        const result = await window.api.uploadImage(file);
        uploadedAvatarUrl = result.url;
    } catch (err) {
        console.error('Avatar upload failed:', err);
        showToast('Không thể tải ảnh lên. URL avatar sẽ để trống.', 'warning');
    } finally {
        mediaUploadsInProgress--;
    }
}

async function previewCover(input) {
    const file = getValidImage(input);
    if (!file) return;
    const preview = document.getElementById('create-cover-preview');
    preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Xem trước ảnh bìa">`;
    preview.classList.add('has-image');
    mediaUploadsInProgress++;
    try {
        const result = await window.api.uploadImage(file);
        uploadedCoverUrl = result.url;
    } catch (err) {
        uploadedCoverUrl = null;
        showToast('Không thể tải ảnh bìa. Vui lòng thử lại.', 'error');
    } finally {
        mediaUploadsInProgress--;
    }
}

function getValidImage(input) {
    const file = input.files?.[0];
    if (!file) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        input.value = '';
        showToast('Ảnh phải là JPG, PNG hoặc WebP và không quá 5MB.', 'warning');
        return null;
    }
    return file;
}

/* ---- Create Group ---- */

async function handleCreateGroup(e) {
    e.preventDefault();
    if (mediaUploadsInProgress > 0) {
        showToast('Ảnh đang được tải lên, vui lòng chờ một chút.', 'info');
        return;
    }
    const btn = e.target.querySelector('button[type="submit"]') || document.querySelector('button[form="create-group-form"][type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';

    const payload = {
        name: document.getElementById('group-name').value.trim(),
        description: document.getElementById('group-desc').value.trim(),
        coverImageUrl: uploadedCoverUrl || null,
        avatarImageUrl: uploadedAvatarUrl || null,
        isPrivate: document.getElementById('group-private').checked
    };

    try {
        const createdGroup = await window.api.post('groups', payload);
        closeCreateGroupModal();
        currentTab = 'my-groups';
        document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-type="my-groups"]').classList.add('active');
        await loadGroups();
        await loadOwnedGroups();
        if (createdGroup?.id) {
            showToast('Đã tạo cộng đồng. Bạn là quản trị viên của nhóm!', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Lỗi khi tạo nhóm', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-sparkles"></i> Tạo cộng đồng';
    }
}

/* ---- Join / Navigate ---- */

async function joinGroup(e, groupId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const btn = e?.target?.closest('button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    try {
        const result = await window.api.post(`groups/${groupId}/join`);
        showToast(result?.message || 'Đã cập nhật trạng thái tham gia.', result?.requiresApproval ? 'info' : 'success');
        // Refresh list to reflect pending/approved status
        await loadGroups();
        await loadOwnedGroups();
    } catch (err) {
        showToast(err.message || 'Không thể tham gia nhóm', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Tham gia'; }
    }
}

async function cancelJoinRequest(e, groupId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!confirm('Bạn muốn hủy yêu cầu tham gia cộng đồng này?')) return;
    try {
        await window.api.post(`groups/${groupId}/leave`);
        showToast('Đã hủy yêu cầu tham gia.', 'success');
        await loadGroups();
    } catch (err) {
        showToast(err.message || 'Không thể hủy yêu cầu.', 'error');
    }
}

function updateSummary(myGroups = [], pendingTotal = 0) {
    const groupStat = document.getElementById('stat-groups');
    const memberStat = document.getElementById('stat-members');
    const pendingStat = document.getElementById('stat-pending');
    if (groupStat) groupStat.textContent = myGroups.length.toLocaleString('vi-VN');
    if (memberStat) memberStat.textContent = myGroups.reduce((total, group) => total + (group.memberCount || 0), 0).toLocaleString('vi-VN');
    if (pendingStat) pendingStat.textContent = pendingTotal.toLocaleString('vi-VN');
}

function bindCharacterCounter(inputId, counterId, maximum) {
    document.getElementById(inputId)?.addEventListener('input', () => updateCharacterCounter(inputId, counterId, maximum));
}

function updateCharacterCounter(inputId, counterId, maximum) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (input && counter) counter.textContent = `${input.value.length}/${maximum}`;
}

function goToGroup(e, groupId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    window.location.href = `group-detail.html?id=${groupId}`;
}

/* ---- Utility ---- */

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info') {
    const existing = document.getElementById('zynk-toast');
    if (existing) existing.remove();

    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#6366f1' };
    const toast = document.createElement('div');
    toast.id = 'zynk-toast';
    toast.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        background:${colors[type]}; color:#fff; padding:12px 24px;
        border-radius:12px; font-weight:600; font-size:0.9rem; z-index:99999;
        box-shadow:0 4px 20px rgba(0,0,0,0.2); animation:slideUp 0.3s ease;
        max-width:360px; text-align:center;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Expose globals
window.openCreateGroupModal = openCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.joinGroup = joinGroup;
window.cancelJoinRequest = cancelJoinRequest;
window.goToGroup = goToGroup;
window.filterGroups = filterGroups;
window.previewAvatar = previewAvatar;
window.previewCover = previewCover;
