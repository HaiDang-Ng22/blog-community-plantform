/* js/seller.js */
document.addEventListener('DOMContentLoaded', initializeSellerCenter);

async function initializeSellerCenter() {
    const container = document.getElementById('seller-content');
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

    // Logic: Admin không cần/không được đăng ký bán hàng
    if (userInfo.role === 'Admin' || userInfo.Role === 'Admin') {
        container.innerHTML = `<div class="status-card">
            <i class="fa fa-user-shield" style="color: #6366f1;"></i>
            <h2>Bạn đang là Admin</h2>
            <p>Tài khoản Quản trị viên không cần đăng ký bán hàng. Vui lòng sử dụng Trang Quản Trị để duyệt yêu cầu.</p>
            <a href="admin.html" class="btn primary-btn" style="display: inline-block; margin-top: 1.5rem; width: auto;">Đến Trang Quản Trị</a>
        </div>`;
        return;
    }
    
    try {
        // 1. Check if user already has a shop
        const shop = await window.api.get('seller/my-shop').catch(() => null);
        
        if (shop) {
            renderDashboard(shop);
            return;
        }

        // 2. If no shop, check application status
        const app = await window.api.get('seller/application-status');
        
        if (!app) {
            renderRegistration();
        } else if (app.status === 'Pending') {
            renderPending();
        } else if (app.status === 'Rejected') {
            renderRegistration(`Đơn đăng ký trước đó bị từ chối. Lý do: ${app.adminNote || 'Không có'}`);
        } else {
            // Should not happen as Shop would exist if Approved, but safe fallback
            renderRegistration();
        }
    } catch (e) {
        container.innerHTML = `<div class="status-card" style="border-color: #EF4444;">
            <i class="fa fa-exclamation-triangle" style="color: #EF4444;"></i>
            <h2>Lỗi kết nối</h2>
            <p>Không thể tải dữ liệu kênh người bán. Vui lòng kiểm tra đăng nhập.</p>
        </div>`;
    }
}

function renderRegistration(errorMsg = '') {
    const container = document.getElementById('seller-content');
    const tpl = document.getElementById('tpl-registration').content.cloneNode(true);
    container.innerHTML = '';
    container.appendChild(tpl);

    if (errorMsg) {
        const msgBox = document.getElementById('msg-box');
        msgBox.textContent = errorMsg;
        msgBox.className = 'message-box error';
        msgBox.classList.remove('hidden');
    }

    const form = document.getElementById('form-shop-apply');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            shopName: document.getElementById('shop-name').value,
            description: document.getElementById('shop-desc').value
        };

        try {
            await window.api.post('seller/apply', data);
            renderPending();
        } catch (err) {
            alert(err.message || 'Lỗi khi gửi đơn');
        }
    };
}

function renderPending() {
    const container = document.getElementById('seller-content');
    const tpl = document.getElementById('tpl-pending').content.cloneNode(true);
    container.innerHTML = '';
    container.appendChild(tpl);
}

async function renderDashboard(shop) {
    const container = document.getElementById('seller-content');
    const tpl = document.getElementById('tpl-dashboard').content.cloneNode(true);
    container.innerHTML = '';
    container.appendChild(tpl);

    document.getElementById('shop-title-display').textContent = shop.name;
    
    // Load dashboard data
    loadSellerProducts();
    loadIncomingOrders();
    loadCategoriesForProduct();
}

function switchSellerTab(tab) {
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}

// Product Management
async function loadSellerProducts() {
    const tbody = document.getElementById('product-list-body');
    const products = await window.api.get('seller/my-products');
    
    document.getElementById('stat-products').textContent = products.length;
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có sản phẩm nào.</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => `
        <tr>
            <td><img src="${p.featuredImageUrl || 'https://via.placeholder.com/50'}" class="prod-img-mini"></td>
            <td style="font-weight: 600;">${p.name}</td>
            <td>${formatCurrency(p.price)}</td>
            <td>${p.stock}</td>
            <td><span class="badge badge-success">Đang bán</span></td>
            <td>
                <button class="btn secondary-btn" style="padding: 4px 8px; width: auto;"><i class="fa fa-edit"></i></button>
            </td>
        </tr>
    `).join('');
}

let allCategories = [];

async function loadCategoriesForProduct() {
    try {
        allCategories = await window.api.get('marketplace/categories');
        resetCategoryCascade();
    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

/**
 * Reset the cascade to level 0 (root categories only)
 */
function resetCategoryCascade() {
    const container = document.getElementById('category-cascade-selects');
    const pathEl = document.getElementById('category-selected-path');
    if (!container) return;
    container.innerHTML = '';
    if (pathEl) pathEl.textContent = '';
    document.getElementById('p-category').value = '';

    const roots = allCategories.filter(c => !c.parentCategoryId);
    if (roots.length > 0) {
        addCascadeLevel(roots, 0, 'Chọn danh mục chính');
    }
}

/**
 * Add a new <select> dropdown for a given level.
 * @param {Array} options - list of category objects for this level
 * @param {number} level - depth level (0 = root)
 * @param {string} placeholder - placeholder text
 */
function addCascadeLevel(options, level, placeholder) {
    const container = document.getElementById('category-cascade-selects');
    if (!container) return;

    // Remove any dropdowns deeper than this level (user went back up)
    while (container.children.length > level) {
        container.removeChild(container.lastChild);
    }

    const labelMap = ['Chọn danh mục chính', 'Chọn danh mục con', 'Chọn danh mục con của con'];
    const select = document.createElement('select');
    select.className = 'cascade-select';
    select.style.cssText = 'width:100%; padding:0.65rem 1rem; border-radius:10px; border:1px solid var(--input-border,#e2e8f0); background:var(--input-bg,#f8fafc); color:var(--text-primary,#1e293b); font-family:inherit; font-size:0.95rem; transition:0.2s; outline:none; cursor:pointer;';
    select.dataset.level = level;

    // Placeholder option
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    placeholderOpt.textContent = labelMap[level] || `Chọn cấp ${level + 1}`;
    select.appendChild(placeholderOpt);

    // Category options
    options.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => onCascadeChange(select, level));
    container.appendChild(select);

    // Focus animation
    select.addEventListener('focus', () => select.style.borderColor = '#6366f1');
    select.addEventListener('blur', () => select.style.borderColor = 'var(--input-border,#e2e8f0)');
}

/**
 * Called when user selects a value in a cascade dropdown.
 */
function onCascadeChange(select, level) {
    const selectedId = select.value;
    const container = document.getElementById('category-cascade-selects');

    // Remove all dropdowns deeper than current level
    while (container.children.length > level + 1) {
        container.removeChild(container.lastChild);
    }

    // Set selected category value (may be overridden if children exist)
    document.getElementById('p-category').value = selectedId;

    // Update breadcrumb path
    updateCategoryPath();

    // Find children of selected category
    const children = allCategories.filter(c => c.parentCategoryId === selectedId);
    if (children.length > 0) {
        // Has children: add next level dropdown and clear the final value until user picks a leaf
        document.getElementById('p-category').value = '';
        addCascadeLevel(children, level + 1, '');
    }
}

/**
 * Build and display the breadcrumb path of selected categories.
 */
function updateCategoryPath() {
    const container = document.getElementById('category-cascade-selects');
    const pathEl = document.getElementById('category-selected-path');
    if (!pathEl || !container) return;

    const parts = [];
    Array.from(container.querySelectorAll('select')).forEach(sel => {
        if (sel.value) {
            const cat = allCategories.find(c => c.id === sel.value);
            if (cat) parts.push(cat.name);
        }
    });

    if (parts.length > 0) {
        pathEl.innerHTML = `<i class="fa-solid fa-location-dot" style="margin-right:4px;"></i>${parts.join(' › ')}`;
    } else {
        pathEl.textContent = '';
    }
}

function openAddProductModal() {
    document.getElementById('product-add-modal').classList.remove('hidden');
    // Reset cascade to root level
    resetCategoryCascade();
}

function closeAddProductModal() {
    document.getElementById('product-add-modal').classList.add('hidden');
}

document.getElementById('form-add-product').onsubmit = async (e) => {
    e.preventDefault();

    const categoryId = document.getElementById('p-category').value;
    if (!categoryId) {
        const wrapper = document.getElementById('category-cascade-wrapper');
        wrapper.style.animation = 'none';
        wrapper.offsetHeight; // reflow
        wrapper.style.animation = 'shake 0.3s ease';
        const pathEl = document.getElementById('category-selected-path');
        if (pathEl) pathEl.innerHTML = '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Vui lòng chọn đến danh mục cuối cùng!</span>';
        return;
    }

    const data = {
        name: document.getElementById('p-name').value,
        price: parseFloat(document.getElementById('p-price').value),
        stock: parseInt(document.getElementById('p-stock').value),
        categoryId: categoryId,
        description: document.getElementById('p-desc').value,
        imageUrls: document.getElementById('p-image').value ? [document.getElementById('p-image').value] : []
    };

    // Button is OUTSIDE the form (in the sticky footer), so query from document
    const submitBtn = document.querySelector('button[form="form-add-product"][type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang đăng...';
    }

    try {
        await window.api.post('seller/products', data);
        if (window.common?.showToast) window.common.showToast('Đăng sản phẩm thành công!', 'success');
        else alert('Đăng sản phẩm thành công!');
        closeAddProductModal();
        loadSellerProducts();
    } catch (err) {
        if (window.common?.showToast) window.common.showToast('Lỗi: ' + (err.message || 'Không thể đăng sản phẩm'), 'error');
        else alert('Lỗi: ' + (err.message || 'Không thể đăng sản phẩm'));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
};

// Order Management
async function loadIncomingOrders() {
    const tbody = document.getElementById('order-list-body');
    const orders = await window.api.get('seller/incoming-orders');
    
    document.getElementById('stat-orders').textContent = orders.length;
    const revenue = orders.filter(o => o.status === 'Completed').reduce((acc, o) => acc + o.totalAmount, 0);
    document.getElementById('stat-revenue').textContent = formatCurrency(revenue);

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có đơn hàng nào.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td>#${o.id.substring(0, 8)}</td>
            <td>Khách hàng Zynk</td>
            <td style="font-weight: 700;">${formatCurrency(o.totalAmount)}</td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td><span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
            <td style="display: flex; gap: 5px;">
                <button class="btn primary-btn" style="padding: 4px 8px; width: auto; font-size: 0.7rem;" onclick="updateOrderStatus('${o.id}', 'Completed')">Xong</button>
            </td>
        </tr>
    `).join('');
}

async function updateOrderStatus(id, status) {
    try {
        await window.api.patch(`orders/${id}/status`, status);
        loadIncomingOrders();
    } catch (e) {
        alert('Lỗi cập nhật trạng thái');
    }
}

function getStatusBadgeClass(status) {
    if (status === 'Pending') return 'badge-warning';
    if (status === 'Completed') return 'badge-success';
    return 'badge-warning';
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}
