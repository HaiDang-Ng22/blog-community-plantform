// Admin Categories - Hybrid Grid/Tree View
let allCategories = [];
let currentPath = []; // Array of category objects for breadcrumb
let currentCategory = null; // Currently viewed category object

async function loadAdminCategories() {
    try {
        const response = await window.api.get(`admin/categories?t=${Date.now()}`);
        allCategories = response;
        renderView();
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

function renderView() {
    if (!currentCategory) {
        renderGrid();
    } else {
        renderDrillDownTree();
    }
}

// --- Grid View (Main Level) ---
function renderGrid() {
    const folderView = document.getElementById('categories-folder-view');
    const treeView = document.getElementById('categories-tree-view');
    folderView.classList.remove('hidden');
    treeView.classList.add('hidden');

    const roots = allCategories.filter(c => !c.parentCategoryId);
    
    let html = '';
    
    // Breadcrumb (Only if deep, but here we are at root)
    html += `
        <div class="breadcrumb-container">
            <span class="breadcrumb-item active"><i class="fa-solid fa-house"></i> Tất cả danh mục</span>
        </div>
    `;

    if (roots.length === 0) {
        html += `
            <div class="tree-empty">
                <i class="fa-solid fa-folder-open" style="font-size:3rem; color:#cbd5e1; display:block; margin-bottom:1rem;"></i>
                <p>Chưa có danh mục nào.</p>
            </div>`;
    } else {
        html += `<div class="cat-grid">`;
        roots.forEach(cat => {
            const childCount = allCategories.filter(c => c.parentCategoryId === cat.id).length;
            const iconClass = cat.icon || (childCount > 0 ? 'fa-folder' : 'fa-tag');
            html += `
                <div class="cat-card">
                    <div class="cat-card-header" onclick="drillDown('${cat.id}')">
                        <div class="cat-card-icon">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div class="tree-node-name" style="font-size:1rem;">${cat.name}</div>
                            <div class="tree-node-meta">${childCount} mục con</div>
                        </div>
                        <i class="fa-solid fa-chevron-right" style="color:#cbd5e1; font-size:0.8rem;"></i>
                    </div>
                    <div class="cat-card-actions">
                        <button class="action-btn-sm add" onclick="openAddSubModal('${cat.id}')" title="Thêm mục con">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button class="action-btn-sm edit" onclick="editCategory('${cat.id}')" title="Sửa">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn-sm delete" onclick="deleteCategory('${cat.id}')" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    folderView.innerHTML = html;
}

// --- Drill-down Tree View ---
function drillDown(id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    
    currentCategory = cat;
    // Build path
    currentPath = [];
    let temp = cat;
    while (temp) {
        currentPath.unshift(temp);
        temp = allCategories.find(c => c.id === temp.parentCategoryId);
    }
    
    renderView();
}

function goBack() {
    if (currentPath.length > 1) {
        const parent = currentPath[currentPath.length - 2];
        drillDown(parent.id);
    } else {
        currentCategory = null;
        currentPath = [];
        renderView();
    }
}

function goToLevel(index) {
    if (index === -1) {
        currentCategory = null;
        currentPath = [];
    } else {
        const cat = currentPath[index];
        currentCategory = cat;
        currentPath = currentPath.slice(0, index + 1);
    }
    renderView();
}

function renderDrillDownTree() {
    const folderView = document.getElementById('categories-folder-view');
    const treeView = document.getElementById('categories-tree-view');
    folderView.classList.add('hidden');
    treeView.classList.remove('hidden');

    const treeRoot = document.getElementById('tree-root-nodes');
    
    // Breadcrumb (Global context)
    const bcHtml = `
        <div class="breadcrumb-container" style="margin-bottom: 2.5rem; width: 100%; max-width: 900px;">
            <span class="breadcrumb-item" onclick="goToLevel(-1)"><i class="fa-solid fa-house"></i> Gốc</span>
            ${currentPath.map((p, i) => `
                <i class="fa-solid fa-chevron-right" style="font-size:0.7rem; opacity:0.5;"></i>
                <span class="breadcrumb-item ${i === currentPath.length - 1 ? 'active' : ''}" onclick="goToLevel(${i})">${p.name}</span>
            `).join('')}
        </div>
    `;

    // Only render the CURRENT category and its IMMEDIATE children
    const children = allCategories.filter(c => c.parentCategoryId === currentCategory.id);
    const iconClass = currentCategory.icon || (children.length > 0 ? 'fa-folder' : 'fa-tag');

    treeRoot.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
            ${bcHtml}
            
            <div class="tree-node-group">
                <!-- Parent Node (Current) -->
                <div class="tree-node" id="node-${currentCategory.id}" style="background: white; border-color: #6366f1; border-width: 2px;">
                    <div class="node-actions-pill">
                        <button class="action-btn-sm add" onclick="openAddSubModal('${currentCategory.id}')" title="Thêm mục con">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button class="action-btn-sm edit" onclick="editCategory('${currentCategory.id}')" title="Sửa">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn-sm delete" onclick="deleteCategory('${currentCategory.id}')" title="Xóa">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="tree-node-icon">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="tree-node-content">
                        <div class="tree-node-name" style="color:#6366f1;">${currentCategory.name}</div>
                        <div class="tree-node-meta">${children.length} mục con</div>
                    </div>
                </div>

                <!-- Immediate Children -->
                ${children.length > 0 ? `
                    <div class="tree-sub-items">
                        ${children.map(child => `
                            <div class="tree-node" id="node-${child.id}" onclick="drillDown('${child.id}')">
                                <div class="node-actions-pill">
                                    <button class="action-btn-sm add" onclick="openAddSubModal('${child.id}'); event.stopPropagation();" title="Thêm mục con">
                                        <i class="fa-solid fa-plus"></i>
                                    </button>
                                    <button class="action-btn-sm edit" onclick="editCategory('${child.id}'); event.stopPropagation();" title="Sửa">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="action-btn-sm delete" onclick="deleteCategory('${child.id}'); event.stopPropagation();" title="Xóa">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                                <div class="tree-node-icon" style="background: #94a3b8;">
                                    <i class="fa-solid ${child.icon || 'fa-tag'}"></i>
                                </div>
                                <div class="tree-node-content">
                                    <div class="tree-node-name">${child.name}</div>
                                    <div class="tree-node-meta">Nhấn để xem mục con</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="margin-top: 20px; color: var(--text-secondary); font-style: italic; font-size: 0.85rem;">
                        Chưa có mục con trong danh mục này
                    </div>
                `}
            </div>
        </div>
    `;

    setTimeout(() => {
        drawTreeLines();
        setupDragToScroll();
    }, 50);
}

function renderNodeGroup(node) {
    const childCount = node.children ? node.children.length : 0;
    const iconClass = node.icon || (childCount > 0 ? 'fa-folder' : 'fa-tag');
    
    return `
    <div class="tree-node-group" id="group-${node.id}">
        <div class="tree-node" id="node-${node.id}" 
             onmouseenter="highlightBranch('${node.id}', true)" 
             onmouseleave="highlightBranch('${node.id}', false)">
            <div class="node-actions-pill">
                <button class="action-btn-sm add" onclick="openAddSubModal('${node.id}')" title="Thêm mục con">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button class="action-btn-sm edit" onclick="editCategory('${node.id}')" title="Sửa">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="action-btn-sm delete" onclick="deleteCategory('${node.id}')" title="Xóa">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="tree-node-icon">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="tree-node-content" onclick="drillDown('${node.id}')">
                <div class="tree-node-name">${node.name}</div>
                <div class="tree-node-meta">${childCount} mục con</div>
            </div>
        </div>
        ${childCount > 0 ? `
            <div class="tree-sub-items">
                ${node.children.map(child => renderNodeGroup(child)).join('')}
            </div>
        ` : ''}
    </div>`;
}

// --- Search Logic ---
function handleCategorySearch(query) {
    const resultsDiv = document.getElementById('category-search-results');
    if (!query || query.length < 1) {
        resultsDiv.classList.add('hidden');
        return;
    }

    const filtered = allCategories.filter(c => 
        c.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);

    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="search-result-item">Không tìm thấy kết quả</div>';
    } else {
        resultsDiv.innerHTML = filtered.map(c => {
            const path = getCategoryPathString(c.id);
            return `
                <div class="search-result-item" onclick="selectSearchResult('${c.id}')">
                    <i class="fa-solid ${c.icon || 'fa-tag'}"></i>
                    <div class="search-result-info">
                        <div class="search-result-name">${c.name}</div>
                        <div class="search-result-path">${path}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    resultsDiv.classList.remove('hidden');
}

function getCategoryPathString(id) {
    let path = [];
    let temp = allCategories.find(c => c.id === id);
    while (temp) {
        path.unshift(temp.name);
        temp = allCategories.find(c => c.id === temp.parentCategoryId);
    }
    return path.join(' > ');
}

function selectSearchResult(id) {
    document.getElementById('category-search-results').classList.add('hidden');
    document.getElementById('category-search-input').value = '';
    drillDown(id);
}

// Close search on click outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        document.getElementById('category-search-results').classList.add('hidden');
    }
});

// --- Existing Tree Logic (Modified for Vertical SVG) ---
function drawTreeLines() {
    const svg = document.getElementById('tree-svg-layer');
    const container = document.getElementById('categories-tree-view');
    if (!svg || !container || container.classList.contains('hidden')) return;

    svg.innerHTML = '';
    svg.setAttribute('width', container.scrollWidth);
    svg.setAttribute('height', container.scrollHeight);

    // Only draw lines for the visible subtree starting from currentCategory
    const visibleNodes = container.querySelectorAll('.tree-node');
    const nodeIds = Array.from(visibleNodes).map(n => n.id.replace('node-', ''));

    nodeIds.forEach(id => {
        const cat = allCategories.find(c => c.id === id);
        if (cat && cat.parentCategoryId && nodeIds.includes(cat.parentCategoryId)) {
            const parentNode = document.getElementById(`node-${cat.parentCategoryId}`);
            const childNode = document.getElementById(`node-${cat.id}`);
            
            if (parentNode && childNode) {
                const pRect = parentNode.getBoundingClientRect();
                const cRect = childNode.getBoundingClientRect();
                const contRect = container.getBoundingClientRect();

                // Vertical logic: Parent bottom center -> Child top center
                const startX = (pRect.left - contRect.left) + (pRect.width / 2) + container.scrollLeft;
                const startY = (pRect.top - contRect.top) + pRect.height + container.scrollTop;
                
                const endX = (cRect.left - contRect.left) + (cRect.width / 2) + container.scrollLeft;
                const endY = (cRect.top - contRect.top) + container.scrollTop;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const cp1y = startY + (endY - startY) / 2;
                const cp2y = startY + (endY - startY) / 2;
                
                const d = `M ${startX} ${startY} C ${startX} ${cp1y}, ${endX} ${cp2y}, ${endX} ${endY}`;
                path.setAttribute('d', d);
                path.setAttribute('class', 'tree-curve');
                path.setAttribute('data-from', cat.parentCategoryId);
                path.setAttribute('data-to', cat.id);
                svg.appendChild(path);
            }
        }
    });
}

function highlightBranch(nodeId, active) {
    const lines = document.querySelectorAll(`path[data-from="${nodeId}"], path[data-to="${nodeId}"]`);
    lines.forEach(line => {
        if (active) line.classList.add('active');
        else line.classList.remove('active');
    });
}

function setupDragToScroll() {
    const container = document.getElementById('categories-tree-view');
    if (!container) return;
    let isDown = false, startX, startY, scrollLeft, scrollTop;

    container.onmousedown = (e) => {
        if (e.target.closest('.tree-node')) return;
        isDown = true;
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
    };
    container.onmouseleave = () => isDown = false;
    container.onmouseup = () => isDown = false;
    container.onmousemove = (e) => {
        if (!isDown) return;
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        container.scrollLeft = scrollLeft - (x - startX);
        container.scrollTop = scrollTop - (y - startY);
    };
}

window.addEventListener('resize', drawTreeLines);

// --- Modal & API helpers ---
function openAddSubModal(parentId) {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');
    form.reset();
    document.getElementById('category-id').value = '';
    document.getElementById('category-modal-title').textContent = 'Thêm Danh mục con';
    updateParentDropdown();
    if (parentId) document.getElementById('category-parent').value = parentId;
    modal.classList.remove('hidden');
}

function updateParentDropdown() {
    const select = document.getElementById('category-parent');
    if (!select) return;
    const currentId = document.getElementById('category-id').value;
    select.innerHTML = '<option value="">-- Không có (Danh mục gốc) --</option>';
    const { roots } = buildCategoryTree(allCategories);
    function addOptions(nodes, level = 0) {
        nodes.forEach(node => {
            if (node.id === currentId) return;
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = '  '.repeat(level) + (level > 0 ? '└─ ' : '') + node.name;
            select.appendChild(option);
            if (node.children && node.children.length > 0) addOptions(node.children, level + 1);
        });
    }
    addOptions(roots);
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
        // If we are currently in a category, default parent to it
        if (currentCategory) document.getElementById('category-parent').value = currentCategory.id;
    }
    modal.classList.remove('hidden');
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
}

async function handleCategorySubmit(event) {
    event.preventDefault();
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const parentId = document.getElementById('category-parent').value || null;
    
    // Local check for duplicates in same parent (though backend handles global, this is specifically requested)
    const siblings = allCategories.filter(c => c.parentCategoryId === parentId && c.id !== id);
    if (siblings.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        window.common.showToast('Tên danh mục con này đã tồn tại trong nhóm này', 'error');
        return;
    }

    const data = {
        name: name,
        icon: document.getElementById('category-icon').value,
        parentCategoryId: parentId
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
    const descendants = getAllDescendants(id);
    if (!confirm(`Bạn có chắc muốn xóa danh mục này? ${descendants.length > 0 ? `Toàn bộ ${descendants.length} mục con sẽ bị xóa theo.` : ''}`)) return;

    try {
        await window.api.delete(`admin/categories/${id}`);
        window.common.showToast('Đã xóa thành công', 'success');
        if (currentCategory && (currentCategory.id === id || descendants.includes(currentCategory.id))) {
            currentCategory = null;
            currentPath = [];
        }
        await loadAdminCategories();
    } catch (error) {
        window.common.showToast(error.message || 'Không thể xóa', 'error');
    }
}

function getAllDescendants(id) {
    const result = [];
    const queue = [id];
    while (queue.length > 0) {
        const current = queue.shift();
        const children = allCategories.filter(c => c.parentCategoryId === current);
        children.forEach(c => { result.push(c.id); queue.push(c.id); });
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
window.goToLevel = goToLevel;
window.handleCategorySearch = handleCategorySearch;
window.selectSearchResult = selectSearchResult;
window.highlightBranch = highlightBranch;
