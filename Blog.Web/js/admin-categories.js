// Admin Categories - Folder Drill-Down View
let allCategories = [];
let currentParentId = null; // null = root level
let navigationStack = []; // breadcrumb [{id, name}]

async function loadAdminCategories() {
    try {
        const response = await window.api.get(`admin/categories?t=${Date.now()}`);
        allCategories = response;
        renderFolderView();
        updateParentDropdown();
    } catch (error) {
        console.error('Failed to load categories:', error);
        window.common.showToast('Không thể tải danh mục', 'error');
    }
}

function buildCategoryTree(categories) {
    const map = new Map();
    const roots = [];
    categories.forEach(cat => map.set(cat.id, { ...cat, children: [] }));
    categories.forEach(cat => {
        if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
            map.get(cat.parentCategoryId).children.push(map.get(cat.id));
        } else {
            roots.push(map.get(cat.id));
        }
    });
    return { map, roots };
}

function drillDown(id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    navigationStack.push({ id: currentParentId, name: currentParentId ? allCategories.find(c => c.id === currentParentId)?.name : 'Tất cả danh mục' });
    currentParentId = id;
    renderFolderView();
}

function navigateTo(index) {
    // index = -1 means root, 0..n means a breadcrumb item
    if (index === -1) {
        currentParentId = null;
        navigationStack = [];
    } else {
        const target = navigationStack[index];
        currentParentId = target.id;
        navigationStack = navigationStack.slice(0, index);
    }
    renderFolderView();
}

function renderFolderView() {
    const container = document.getElementById('categories-folder-view');
    if (!container) return;

    const { map, roots } = buildCategoryTree(allCategories);

    // Get children of current level
    let items;
    if (currentParentId === null) {
        items = roots;
    } else {
        const parentNode = map.get(currentParentId);
        items = parentNode ? parentNode.children : [];
    }

    // --- Breadcrumb ---
    let breadcrumbHtml = `<div class="cat-breadcrumb">
        <button class="crumb-btn ${currentParentId === null ? 'active' : ''}" onclick="navigateTo(-1)">
            <i class="fa-solid fa-layer-group"></i> Tất cả danh mục
        </button>`;
    navigationStack.forEach((crumb, i) => {
        if (crumb.id !== null) {
            breadcrumbHtml += `<span class="crumb-sep"><i class="fa-solid fa-chevron-right"></i></span>
            <button class="crumb-btn" onclick="navigateTo(${i})">${crumb.name}</button>`;
        }
    });
    if (currentParentId !== null) {
        const currentCat = allCategories.find(c => c.id === currentParentId);
        breadcrumbHtml += `<span class="crumb-sep"><i class="fa-solid fa-chevron-right"></i></span>
            <span class="crumb-current">${currentCat?.name || ''}</span>`;
    }
    breadcrumbHtml += `</div>`;

    // --- Folder Grid ---
    let gridHtml = '';
    if (items.length === 0) {
        gridHtml = `<div class="cat-empty">
            <i class="fa-solid fa-folder-open" style="font-size:3rem; color:#cbd5e1; display:block; margin-bottom:1rem;"></i>
            <p style="color:var(--text-secondary);">Chưa có danh mục con nào</p>
            <button class="btn primary-btn" style="width:auto; margin-top:1rem; padding: 0.6rem 1.4rem;" onclick="openAddSubModal('${currentParentId || ''}')">
                <i class="fa-solid fa-plus"></i> Thêm danh mục con
            </button>
        </div>`;
    } else {
        gridHtml = `<div class="cat-grid">`;
        items.forEach(item => {
            const childCount = item.children ? item.children.length : 0;
            const iconClass = item.icon || (childCount > 0 ? 'fa-folder' : 'fa-tag');
            gridHtml += `
            <div class="cat-card">
                <div class="cat-card-body" onclick="drillDown('${item.id}')" title="Mở danh mục">
                    <div class="cat-card-icon">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="cat-card-info">
                        <div class="cat-card-name">${item.name}</div>
                        <div class="cat-card-meta">
                            ${childCount > 0
                                ? `<span class="cat-chip chip-folder"><i class="fa-solid fa-folder"></i> ${childCount} danh mục con</span>`
                                : `<span class="cat-chip chip-leaf"><i class="fa-solid fa-tag"></i> Không có mục con</span>`
                            }
                            <span class="cat-chip chip-slug">${item.slug}</span>
                        </div>
                    </div>
                    ${childCount > 0 ? `<i class="fa-solid fa-chevron-right cat-card-arrow"></i>` : ''}
                </div>
                <div class="cat-card-actions">
                    <button class="btn-action" onclick="openAddSubModal('${item.id}')" title="Thêm mục con" style="color:#10b981;border-color:#10b981;">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="btn-action" onclick="editCategory('${item.id}')" title="Sửa">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action danger" onclick="deleteCategory('${item.id}')" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
        });
        gridHtml += `</div>`;
    }

    container.innerHTML = breadcrumbHtml + gridHtml;
}

// --- Modal helpers ---
function openAddSubModal(parentId) {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');
    form.reset();
    document.getElementById('category-id').value = '';
    document.getElementById('category-modal-title').textContent = parentId ? 'Thêm Danh mục con' : 'Thêm Danh mục mới';
    updateParentDropdown();
    if (parentId) document.getElementById('category-parent').value = parentId;
    modal.classList.remove('hidden');
}

function updateParentDropdown() {
    const select = document.getElementById('category-parent');
    if (!select) return;
    const currentId = document.getElementById('category-id').value;
    select.innerHTML = '<option value="">-- Không có (Danh mục gốc) --</option>';
    allCategories.filter(c => c.id !== currentId).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

function openCategoryModal(cat = null) {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');
    form.reset();
    document.getElementById('category-id').value = '';
    if (cat) {
        document.getElementById('category-modal-title').textContent = 'Chỉnh sửa Danh mục';
        document.getElementById('category-id').value = cat.id;
        document.getElementById('category-name').value = cat.name;
        document.getElementById('category-icon').value = cat.icon || '';
        updateParentDropdown();
        document.getElementById('category-parent').value = cat.parentCategoryId || '';
    } else {
        document.getElementById('category-modal-title').textContent = 'Thêm Danh mục mới';
        updateParentDropdown();
        // Pre-select current folder as parent
        if (currentParentId) {
            document.getElementById('category-parent').value = currentParentId;
        }
    }
    modal.classList.remove('hidden');
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
}

async function handleCategorySubmit(event) {
    event.preventDefault();
    const id = document.getElementById('category-id').value;
    const data = {
        name: document.getElementById('category-name').value,
        icon: document.getElementById('category-icon').value,
        parentCategoryId: document.getElementById('category-parent').value || null
    };
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang lưu...';
    try {
        if (id) {
            await window.api.put(`admin/categories/${id}`, data);
            window.common.showToast('Đã cập nhật danh mục', 'success');
        } else {
            await window.api.post('admin/categories', data);
            window.common.showToast('Đã thêm danh mục mới', 'success');
        }
        closeCategoryModal();
        await loadAdminCategories();
    } catch (error) {
        console.error('Save category error:', error);
        window.common.showToast(error.message || 'Lỗi khi lưu danh mục', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function editCategory(id) {
    const cat = allCategories.find(c => c.id === id);
    if (cat) openCategoryModal(cat);
}

async function deleteCategory(id) {
    const cat = allCategories.find(c => c.id === id);
    const descendants = getAllDescendants(id);
    const childCount = descendants.length;

    let msg;
    if (childCount > 0) {
        msg = `⚠️ Danh mục "${cat?.name}" có ${childCount} danh mục con.\n\nXóa sẽ xóa toàn bộ danh mục con theo.\nBạn có chắc chắn muốn xóa không?`;
    } else {
        msg = `Bạn có chắc muốn xóa danh mục "${cat?.name}"?`;
    }
    if (!confirm(msg)) return;

    try {
        const result = await window.api.delete(`admin/categories/${id}`);
        const successMsg = result?.message || (childCount > 0
            ? `Đã xóa "${cat?.name}" và ${childCount} danh mục con`
            : `Đã xóa danh mục "${cat?.name}"`);
        window.common.showToast(successMsg, 'success');
        // If we deleted the current folder we're viewing, go back up
        if (currentParentId === id || descendants.includes(currentParentId)) {
            currentParentId = null;
            navigationStack = [];
        }
        await loadAdminCategories();
    } catch (error) {
        console.error('Delete category error:', error);
        window.common.showToast(error.message || 'Không thể xóa danh mục', 'error');
    }
}

// Get all descendant IDs of a given category id
function getAllDescendants(id) {
    const result = [];
    const queue = [id];
    while (queue.length > 0) {
        const current = queue.shift();
        const children = allCategories.filter(c => c.parentCategoryId === current);
        children.forEach(c => {
            result.push(c.id);
            queue.push(c.id);
        });
    }
    return result;
}

// Global scope
window.loadAdminCategories = loadAdminCategories;
window.handleCategorySubmit = handleCategorySubmit;
window.deleteCategory = deleteCategory;
window.editCategory = editCategory;
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.openAddSubModal = openAddSubModal;
window.drillDown = drillDown;
window.navigateTo = navigateTo;
