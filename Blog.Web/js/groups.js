// js/groups.js v2.0

let currentTab = 'my-groups';
let allGroups = [];
let uploadedAvatarUrl = null;

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

        if (allGroups.length === 0) {
            renderEmpty();
            return;
        }
        renderGroups(allGroups);
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
    if (currentTab === 'discover') {
        if (status === 'Approved') {
            actionBtn = `<button class="btn-visit" onclick="goToGroup(event,'${g.id}')"><i class="fa-solid fa-arrow-right"></i> Đã tham gia</button>`;
        } else if (status === 'Pending') {
            actionBtn = `<button class="btn-visit" style="opacity:0.6;cursor:default;" disabled><i class="fa-solid fa-clock"></i> Đang chờ duyệt</button>`;
        } else {
            actionBtn = `<button class="btn-join" onclick="joinGroup(event,'${g.id}')"><i class="fa-solid fa-user-plus"></i> Tham gia</button>`;
        }
    } else {
        actionBtn = `<button class="btn-visit" onclick="goToGroup(event,'${g.id}')"><i class="fa-solid fa-arrow-right"></i> Truy cập nhóm</button>`;
    }

    return `
        <div class="group-card" onclick="goToGroup(null,'${g.id}')" style="animation-delay:${index * 0.05}s;">
            <div class="group-card-cover-wrap">
                <img src="${cover}" class="group-cover" alt="${escHtml(g.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(g.name)}&size=400&background=8b5cf6&color=fff&bold=true'">
                ${privacyBadge}
                ${avatarHtml}
            </div>
            <div class="group-info">
                <div class="group-name" title="${escHtml(g.name)}">${escHtml(g.name)}</div>
                <div class="group-meta">
                    <i class="fa-solid fa-users" style="font-size:0.75rem;"></i> ${g.memberCount || 0} thành viên
                </div>
                <div class="group-desc">${escHtml(g.description || 'Không có mô tả.')}</div>
                <div class="group-action">${actionBtn}</div>
            </div>
        </div>`;
}

/* ---- Search / Filter ---- */

function filterGroups(query) {
    if (!query.trim()) {
        renderGroups(allGroups);
        return;
    }
    const q = query.toLowerCase();
    const filtered = allGroups.filter(g =>
        g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)
    );
    renderGroups(filtered);
}

/* ---- Modal Helpers ---- */

function openCreateGroupModal() {
    uploadedAvatarUrl = null;
    document.getElementById('create-group-modal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
    document.getElementById('create-group-form').reset();
    uploadedAvatarUrl = null;
    // Reset avatar preview
    const preview = document.getElementById('create-avatar-preview');
    preview.innerHTML = '<i class="fa-solid fa-image"></i>';
}

async function previewAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('create-avatar-preview');
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary via API
    try {
        const result = await window.api.uploadImage(file);
        uploadedAvatarUrl = result.url;
    } catch (err) {
        console.error('Avatar upload failed:', err);
        showToast('Không thể tải ảnh lên. URL avatar sẽ để trống.', 'warning');
    }
}

/* ---- Create Group ---- */

async function handleCreateGroup(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';

    const payload = {
        name: document.getElementById('group-name').value.trim(),
        description: document.getElementById('group-desc').value.trim(),
        coverImageUrl: document.getElementById('group-cover').value.trim() || null,
        avatarImageUrl: uploadedAvatarUrl || null,
        isPrivate: document.getElementById('group-private').checked
    };

    try {
        await window.api.post('groups', payload);
        closeCreateGroupModal();
        showToast('Đã tạo cộng đồng thành công! 🎉', 'success');
        currentTab = 'my-groups';
        document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-type="my-groups"]').classList.add('active');
        await loadGroups();
        await loadOwnedGroups();
    } catch (err) {
        showToast(err.message || 'Lỗi khi tạo nhóm', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Tạo Nhóm';
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
        await window.api.post(`groups/${groupId}/join`);
        // Refresh list to reflect pending/approved status
        await loadGroups();
        await loadOwnedGroups();
    } catch (err) {
        showToast(err.message || 'Không thể tham gia nhóm', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Tham gia'; }
    }
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
window.goToGroup = goToGroup;
window.filterGroups = filterGroups;
window.previewAvatar = previewAvatar;
