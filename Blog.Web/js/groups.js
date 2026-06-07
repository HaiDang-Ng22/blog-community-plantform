// js/groups.js

let currentTab = 'my-groups'; // 'my-groups' or 'discover'

document.addEventListener('DOMContentLoaded', () => {
    requireAuth();
    
    // Setup tabs
    const tabs = document.querySelectorAll('.group-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.type;
            loadGroups();
        });
    });

    // Handle form submit
    const createForm = document.getElementById('create-group-form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateGroup);
    }

    loadGroups();
    loadOwnedGroups();
});

async function loadGroups() {
    const grid = document.getElementById('groups-grid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
    
    try {
        const endpoint = currentTab === 'my-groups' ? 'groups/my' : 'groups';
        const groups = await window.api.get(endpoint);
        
        if (!groups || groups.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding: 40px; color: #8e8e8e;">
                    <i class="fa-solid fa-users-slash fa-3x" style="margin-bottom:15px; opacity:0.5;"></i>
                    <p>Không tìm thấy cộng đồng nào.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = groups.map(g => renderGroupCard(g)).join('');
    } catch (err) {
        grid.innerHTML = '<div style="grid-column: 1/-1; color:red; text-align:center;">Lỗi tải dữ liệu.</div>';
    }
}

async function loadOwnedGroups() {
    const list = document.getElementById('my-owned-groups-list');
    if (!list) return;
    
    try {
        const groups = await window.api.get('groups/my');
        // Filter groups where user is admin/owner
        // The API my-groups might just return all joined groups.
        // We'll just show them all in this widget for now, or check role if available.
        if (!groups || groups.length === 0) {
            list.innerHTML = '<p style="color:#8e8e8e; font-size:0.9rem; padding:10px;">Bạn chưa tham gia nhóm nào.</p>';
            return;
        }

        list.innerHTML = groups.map(g => `
            <a href="group-detail.html?id=${g.id}" class="owned-group-item">
                <img src="${g.coverImageUrl || 'https://via.placeholder.com/100x100?text=G'}" class="owned-group-img" onerror="this.src='https://via.placeholder.com/100x100?text=G'">
                <div class="owned-group-text">
                    <div class="owned-group-name">${g.name}</div>
                    <div class="owned-group-members">${g.memberCount || 0} thành viên</div>
                </div>
            </a>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

function renderGroupCard(g) {
    const isJoined = g.isMember; // DTO returns isMember
    const cover = g.coverImageUrl || 'https://via.placeholder.com/400x200?text=Group+Cover';
    const privacyIcon = g.isPrivate ? '<i class="fa-solid fa-lock" title="Nhóm riêng tư"></i>' : '<i class="fa-solid fa-globe" title="Nhóm công khai"></i>';
    
    let actionBtn = '';
    if (currentTab === 'discover') {
        if (isJoined) {
            actionBtn = `<button class="btn secondary-btn" onclick="goToGroup(event, '${g.id}')">Đã tham gia</button>`;
        } else {
            actionBtn = `<button class="btn primary-btn" onclick="joinGroup(event, '${g.id}')">Tham gia ngay</button>`;
        }
    } else {
        actionBtn = `<button class="btn secondary-btn" onclick="goToGroup(event, '${g.id}')">Truy cập nhóm</button>`;
    }

    return `
        <div class="group-card" onclick="goToGroup(null, '${g.id}')">
            <img src="${cover}" class="group-cover" alt="Cover" onerror="this.src='https://via.placeholder.com/400x200?text=Group'">
            <div class="group-info">
                <div class="group-name">${g.name}</div>
                <div class="group-meta">
                    ${privacyIcon} ${g.isPrivate ? 'Riêng tư' : 'Công khai'} &bull; ${g.memberCount || 0} thành viên
                </div>
                <div class="group-desc">${g.description || 'Không có mô tả.'}</div>
                <div class="group-action">
                    ${actionBtn}
                </div>
            </div>
        </div>
    `;
}

function openCreateGroupModal() {
    document.getElementById('create-group-modal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
    document.getElementById('create-group-form').reset();
}

async function handleCreateGroup(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Đang tạo...';
    btn.disabled = true;

    const payload = {
        name: document.getElementById('group-name').value,
        description: document.getElementById('group-desc').value,
        coverImageUrl: document.getElementById('group-cover').value,
        isPrivate: document.getElementById('group-private').checked
    };

    try {
        const group = await window.api.post('groups', payload);
        closeCreateGroupModal();
        currentTab = 'my-groups';
        document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-type="my-groups"]').classList.add('active');
        
        loadGroups();
        loadOwnedGroups();
    } catch (err) {
        alert(err.message || 'Lỗi khi tạo nhóm');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function joinGroup(e, groupId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    try {
        await window.api.post(`groups/${groupId}/join`);
        loadGroups();
        loadOwnedGroups();
    } catch (err) {
        alert(err.message || 'Không thể tham gia nhóm');
    }
}

function goToGroup(e, groupId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    window.location.href = `group-detail.html?id=${groupId}`;
}
