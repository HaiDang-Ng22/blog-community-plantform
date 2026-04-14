// Admin Categories Management Logic
let allCategories = [];

async function loadAdminCategories() {
    try {
        // Add cache busting to ensure we get fresh data after delete/create
        const response = await window.api.get(`admin/categories?t=${Date.now()}`);
        allCategories = response;
        renderCategoriesTable();
        updateParentDropdown();
    } catch (error) {
        console.error('Failed to load categories:', error);
        window.common.showToast('Không thể tải danh mục', 'error');
    }
}

function renderCategoriesTable() {
    const list = document.getElementById('admin-categories-list');
    if (!list) return;

    list.innerHTML = allCategories.map(cat => {
        const parent = allCategories.find(c => c.id === cat.parentCategoryId);
        return `
            <tr class="${parent ? 'sub-row' : 'parent-row'}">
                <td><i class="fa-solid ${cat.icon || (parent ? 'fa-minus' : 'fa-folder')}" style="font-size: 1.1rem; color: #6366f1;"></i></td>
                <td style="font-weight: 600;">${parent ? '&nbsp;&nbsp;└ ' : ''}${cat.name}</td>
                <td><span class="badge ${parent ? 'badge-user' : 'badge-admin'}">${parent ? 'Con: ' + parent.name : 'Danh mục Gốc'}</span></td>
                <td style="font-family: monospace; font-size: 0.85rem;">${cat.slug}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        ${!parent ? `<button class="btn-action" onclick="openAddSubModal('${cat.id}')" title="Thêm danh mục con" style="color: #10b981; border-color: #10b981;"><i class="fa-solid fa-plus"></i></button>` : ''}
                        <button class="btn-action" onclick="editCategory('${cat.id}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-action danger" onclick="deleteCategory('${cat.id}')" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddSubModal(parentId) {
    const modal = document.getElementById('category-modal');
    const title = document.getElementById('category-modal-title');
    const form = document.getElementById('category-form');
    
    form.reset();
    document.getElementById('category-id').value = '';
    title.textContent = 'Thêm Danh mục con';
    
    updateParentDropdown();
    document.getElementById('category-parent').value = parentId;
    
    modal.classList.remove('hidden');
}

function updateParentDropdown() {
    const select = document.getElementById('category-parent');
    if (!select) return;

    const currentId = document.getElementById('category-id').value;
    
    // Clear and add default
    select.innerHTML = '<option value="">-- Không có (Danh mục gốc) --</option>';
    
    // Only allow categories that are not the current one (to avoid circularity)
    const validParents = allCategories.filter(c => c.id !== currentId);
    
    validParents.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

function openCategoryModal(cat = null) {
    const modal = document.getElementById('category-modal');
    const title = document.getElementById('category-modal-title');
    const form = document.getElementById('category-form');
    
    form.reset();
    document.getElementById('category-id').value = '';
    
    if (cat) {
        title.textContent = 'Chỉnh sửa Danh mục';
        document.getElementById('category-id').value = cat.id;
        document.getElementById('category-name').value = cat.name;
        document.getElementById('category-icon').value = cat.icon || '';
        
        // Update dropdown before setting value to ensure the parent option exists
        updateParentDropdown();
        document.getElementById('category-parent').value = cat.parentCategoryId || '';
    } else {
        title.textContent = 'Thêm Danh mục mới';
        updateParentDropdown();
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
        loadAdminCategories();
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
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    
    try {
        await window.api.delete(`admin/categories/${id}`);
        window.common.showToast('Đã xóa danh mục', 'success');
        loadAdminCategories();
    } catch (error) {
        console.error('Delete category error:', error);
        window.common.showToast(error.message || 'Không thể xóa danh mục', 'error');
    }
}
// Global scope attachment
window.loadAdminCategories = loadAdminCategories;
window.handleCategorySubmit = handleCategorySubmit;
window.deleteCategory = deleteCategory;
window.editCategory = editCategory;
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.openAddSubModal = openAddSubModal;
