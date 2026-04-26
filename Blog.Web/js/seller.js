/* js/seller.js */
document.addEventListener('DOMContentLoaded', initializeSellerCenter);

async function initializeSellerCenter() {
    const container = document.getElementById('seller-content');
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

    // Admin handling
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
        } else if (app.status === 'Pending' || app.Status === 'Pending') {
            renderPending();
        } else if (app.status === 'Rejected' || app.Status === 'Rejected') {
            renderRegistration(`Đơn đăng ký trước đó bị từ chối. Lý do: ${app.adminNote || app.AdminNote || 'Sau khi xem xét chúng tôi chưa thể cấp quyền cho bạn.'}`);
        } else {
            renderRegistration();
        }
    } catch (e) {
        console.error('Initialization error:', e);
        container.innerHTML = `<div class="status-card" style="border-color: #EF4444;">
            <i class="fa fa-exclamation-triangle" style="color: #EF4444;"></i>
            <h2>Lỗi kết nối</h2>
            <p>Không thể tải dữ liệu kênh người bán. Vui lòng kiểm tra lại kết nối mạng hoặc đăng nhập lại.</p>
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
        if (msgBox) {
            msgBox.textContent = errorMsg;
            msgBox.className = 'message-box error';
            msgBox.classList.remove('hidden');
        }
    }

    const form = document.getElementById('form-shop-apply');
    if (form) {
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

    // Load data
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

// ============================
// Product Management
// ============================
let _cachedProducts = [];
let allCategories = [];

async function loadSellerProducts() {
    const tbody = document.getElementById('product-list-body');
    if (!tbody) return;
    
    try {
        const products = await window.api.get('seller/my-products');
        _cachedProducts = products;

        if (document.getElementById('stat-products')) {
            document.getElementById('stat-products').textContent = products.length;
        }

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;"><i class="fa-solid fa-box-open" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i>Chưa có sản phẩm nào.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>
                    <div class="prod-img-mini-container" style="width: 50px; height: 50px; overflow: hidden; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; display: flex; align-items: center; justify-content: center;">
                        <img src="${p.featuredImageUrl || 'https://via.placeholder.com/50'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/50'">
                    </div>
                </td>
                <td style="font-weight: 600; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${p.name}</td>
                <td style="color: #2563eb; font-weight: 600;">${formatCurrency(p.price)}</td>
                <td>
                    <span style="font-weight:600; color: ${p.stock === 0 ? '#ef4444' : p.stock < 10 ? '#f59e0b' : '#10b981'};">
                        ${p.stock}
                    </span>
                </td>
                <td><span class="badge ${p.stock === 0 ? 'badge-pending' : 'badge-success'}">${p.stock === 0 ? 'Hết hàng' : 'Đang bán'}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="action-pill edit" title="Chỉnh sửa" onclick="openEditProductModal('${p.id}')">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="action-pill delete" title="Xóa" onclick="confirmDeleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem; color: red;">Lỗi tải dữ liệu.</td></tr>';
    }
}

async function loadCategoriesForProduct() {
    try {
        allCategories = await window.api.get('marketplace/categories');
        resetCategoryCascade();
    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

// Category Cascade Logic
function getCategoryPath(id) {
    if (!id) return [];
    const path = [];
    let current = allCategories.find(c => c.id.toLowerCase() === id.toLowerCase());
    while (current) {
        path.unshift(current);
        if (!current.parentCategoryId) break;
        current = allCategories.find(c => c.id.toLowerCase() === current.parentCategoryId.toLowerCase());
    }
    return path;
}

function resetCategoryCascade() {
    const container = document.getElementById('category-cascade-selects');
    if (!container) return;
    container.innerHTML = '';
    const pathEl = document.getElementById('category-selected-path');
    if (pathEl) pathEl.textContent = '';
    
    const roots = allCategories.filter(c => !c.parentCategoryId);
    if (roots.length > 0) addCascadeLevel(roots, 0, 'category-cascade-selects', 'p-category', 'category-selected-path');
}

function addCascadeLevel(options, level, containerId, hiddenInputId, pathId, preSelectedPath = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    while (container.children.length > level) {
        container.removeChild(container.lastChild);
    }

    const select = document.createElement('select');
    select.className = 'cascade-select';
    select.innerHTML = `<option value="" disabled selected>Chọn danh mục cấp ${level + 1}</option>` + 
        options.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Pre-selection logic
    if (preSelectedPath && preSelectedPath[level]) {
        select.value = preSelectedPath[level].id;
    }

    select.onchange = () => {
        const val = select.value;
        const children = allCategories.filter(c => c.parentCategoryId === val);
        document.getElementById(hiddenInputId).value = children.length === 0 ? val : '';
        
        if (children.length > 0) {
            addCascadeLevel(children, level + 1, containerId, hiddenInputId, pathId);
        } else {
            // No more levels
            while (container.children.length > level + 1) container.removeChild(container.lastChild);
        }
        updateCategoryPath(containerId, pathId);
    };

    container.appendChild(select);

    // If pre-selected, trigger next level automatically
    if (preSelectedPath && preSelectedPath[level]) {
        const val = select.value;
        const children = allCategories.filter(c => c.parentCategoryId === val);
        if (children.length > 0) {
            addCascadeLevel(children, level + 1, containerId, hiddenInputId, pathId, preSelectedPath);
        }
    }
}

function updateCategoryPath(containerId, pathId) {
    const container = document.getElementById(containerId);
    const pathEl = document.getElementById(pathId);
    if (!pathEl) return;

    const parts = Array.from(container.querySelectorAll('select')).map(s => {
        const opt = s.options[s.selectedIndex];
        return opt.disabled ? null : opt.text;
    }).filter(v => v);

    pathEl.innerHTML = parts.length > 0 ? `<i class="fa-solid fa-location-dot"></i> ${parts.join(' › ')}` : '';
}

// Variant Management
function addNewVariantRow(isEdit = false) {
    const containerId = isEdit ? 'edit-variant-list-container' : 'variant-list-container';
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 8px; margin-bottom: 8px; align-items: center;";
    row.innerHTML = `
        <input type="text" class="v-name" placeholder="Tên (VD: Đỏ, 128GB)" style="padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <input type="number" class="v-price" placeholder="Giá (nếu đổi)" style="padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <input type="number" class="v-stock" placeholder="Kho" style="padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa fa-trash"></i></button>
    `;
    container.appendChild(row);
}

function collectVariants(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    return Array.from(container.querySelectorAll('.variant-row')).map(row => ({
        name: row.querySelector('.v-name').value,
        priceOverride: parseFloat(row.querySelector('.v-price').value) || 0,
        stock: parseInt(row.querySelector('.v-stock').value) || 0
    })).filter(v => v.name);
}

function fillVariants(containerId, variants) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    variants.forEach(v => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 40px; gap: 8px; margin-bottom: 8px; align-items: center;";
        row.innerHTML = `
            <input type="text" class="v-name" value="${v.name || ''}" placeholder="Tên" style="padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <input type="number" class="v-price" value="${v.priceOverride || ''}" placeholder="Giá" style="padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <input type="number" class="v-stock" value="${v.stock || ''}" placeholder="Kho" style="padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa fa-trash"></i></button>
        `;
        container.appendChild(row);
    });
}

// Modal Actions
function openAddProductModal() {
    document.getElementById('product-add-modal').classList.remove('hidden');
    document.getElementById('variant-list-container').innerHTML = '';
    resetCategoryCascade();
}

function closeAddProductModal() {
    document.getElementById('product-add-modal').classList.add('hidden');
}

document.getElementById('form-add-product').onsubmit = async (e) => {
    e.preventDefault();
    const categoryId = document.getElementById('p-category').value;
    if (!categoryId) { alert('Vui lòng chọn danh mục cuối cùng!'); return; }

    const images = document.getElementById('p-images').value.split(',').map(s => s.trim()).filter(s => s);
    const data = {
        name: document.getElementById('p-name').value,
        price: parseFloat(document.getElementById('p-price').value),
        stock: parseInt(document.getElementById('p-stock').value),
        categoryId: categoryId,
        description: document.getElementById('p-desc').value,
        imageUrls: images,
        variantGroupName1: document.getElementById('p-variant-group1').value,
        variantGroupName2: document.getElementById('p-variant-group2').value,
        variants: collectVariants('variant-list-container')
    };

    try {
        await window.api.post('seller/products', data);
        alert('Đăng sản phẩm thành công!');
        closeAddProductModal();
        loadSellerProducts();
    } catch (err) {
        alert(err.message || 'Lỗi khi đăng sản phẩm');
    }
};

// ============================
// Edit Product
// ============================
function openEditProductModal(id) {
    const p = _cachedProducts.find(x => x.id === id);
    if (!p) return;

    document.getElementById('edit-p-id').value = p.id;
    document.getElementById('edit-p-name').value = p.name;
    document.getElementById('edit-p-price').value = p.price;
    document.getElementById('edit-p-stock').value = p.stock;
    document.getElementById('edit-p-desc').value = p.description;
    
    // Handle images: could be imageUrls (if using DTO) or images (if entity)
    let imageUrls = [];
    if (p.imageUrls) {
        imageUrls = p.imageUrls;
    } else if (p.images) {
        imageUrls = p.images.map(img => typeof img === 'string' ? img : img.url);
    }
    document.getElementById('edit-p-images').value = imageUrls.join(', ');
    document.getElementById('edit-p-variant-group1').value = p.variantGroupName1 || '';
    document.getElementById('edit-p-variant-group2').value = p.variantGroupName2 || '';

    fillVariants('edit-variant-list-container', p.variants || []);
    
    // Category pre-selection
    document.getElementById('edit-p-category').value = p.categoryId;
    const path = getCategoryPath(p.categoryId);
    const roots = allCategories.filter(c => !c.parentCategoryId);
    
    const container = document.getElementById('edit-category-cascade-selects');
    container.innerHTML = '';
    addCascadeLevel(roots, 0, 'edit-category-cascade-selects', 'edit-p-category', 'edit-category-selected-path', path);
    updateCategoryPath('edit-category-cascade-selects', 'edit-category-selected-path');

    document.getElementById('product-edit-modal').classList.remove('hidden');
}

function closeEditProductModal() {
    document.getElementById('product-edit-modal').classList.add('hidden');
}

document.getElementById('form-edit-product').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-p-id').value;
    const categoryId = document.getElementById('edit-p-category').value;
    const images = document.getElementById('edit-p-images').value.split(',').map(s => s.trim()).filter(s => s);

    const data = {
        name: document.getElementById('edit-p-name').value,
        price: parseFloat(document.getElementById('edit-p-price').value),
        stock: parseInt(document.getElementById('edit-p-stock').value),
        categoryId: categoryId,
        description: document.getElementById('edit-p-desc').value,
        imageUrls: images,
        variantGroupName1: document.getElementById('edit-p-variant-group1').value,
        variantGroupName2: document.getElementById('edit-p-variant-group2').value,
        variants: collectVariants('edit-variant-list-container')
    };

    try {
        await window.api.put(`seller/products/${id}`, data);
        alert('Cập nhật sản phẩm thành công!');
        closeEditProductModal();
        loadSellerProducts();
    } catch (err) {
        alert(err.message || 'Lỗi khi cập nhật');
    }
};

async function confirmDeleteProduct(id, name) {
    if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${name}"?`)) return;
    try {
        await window.api.delete(`seller/products/${id}`);
        loadSellerProducts();
    } catch (e) {
        alert(e.message || 'Lỗi khi xóa');
    }
}

// ============================
// Order Management
// ============================
let activeOrderTab = 'All';
let orderSearchKeyword = '';

async function loadIncomingOrders() {
    const container = document.getElementById('order-list-container');
    if (!container) return;

    try {
        // Fetch with filters
        const query = `status=${activeOrderTab}&keyword=${encodeURIComponent(orderSearchKeyword)}`;
        const orders = await window.api.get(`seller/incoming-orders?${query}`);
        
        // Update stats (only on initial load or "All" tab)
        if (activeOrderTab === 'All' && !orderSearchKeyword) {
            if (document.getElementById('stat-orders')) document.getElementById('stat-orders').textContent = orders.length;
            const revenue = orders.filter(o => o.status === 'Completed' || o.status === 'Delivered').reduce((acc, o) => acc + o.totalAmount, 0);
            if (document.getElementById('stat-revenue')) document.getElementById('stat-revenue').textContent = formatCurrency(revenue);
        }

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="no-posts" style="padding: 4rem; text-align: center; background: #fff; border-radius: 1rem; border: 1px dashed #e2e8f0;">
                    <i class="fa fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem; display: block;"></i>
                    <p style="color: #64748b; font-weight: 500;">Không tìm thấy đơn hàng nào phù hợp.</p>
                </div>`;
            return;
        }

        container.innerHTML = orders.map(o => `
            <div class="order-premium-card" style="background: white; border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1.5fr min-content; gap: 1.5rem; align-items: center;">
                <div class="order-base">
                    <div class="order-id-label">Mã đơn: #${o.id.substring(0,8).toUpperCase()}</div>
                    <div class="customer-info" style="margin: 0.75rem 0;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(o.customerName)}&background=random" class="customer-avatar">
                        <div>
                            <div class="customer-name">${o.customerName}</div>
                            <div class="customer-phone">${o.phoneNumber}</div>
                        </div>
                    </div>
                    <div>
                        <span class="status-badge ${o.status.toLowerCase()}">${getStatusText(o.status)}</span>
                    </div>
                </div>
                <div class="order-items" style="border-left: 1px solid #f1f5f9; padding-left: 1rem;">
                    ${o.items.map(i => `
                        <div class="order-item-inline" style="margin-bottom: 8px;">
                            <img src="${i.productImageUrl || 'https://via.placeholder.com/44'}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;">
                            <div style="flex: 1; overflow: hidden;">
                                <div class="item-txt" style="font-size: 0.85rem; font-weight: 600;">${i.productName}</div>
                                <div style="font-size: 0.75rem; color: #94a3b8;">PL: ${i.variantName || 'Mặc định'} | SL: x${i.quantity}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="order-actions" style="border-left: 1px solid #f1f5f9; padding-left: 1rem; text-align: right; min-width: 160px;">
                    <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.25rem;">Tổng thanh toán</div>
                    <div class="total-price-highlight" style="margin-bottom: 1rem;">${formatCurrency(o.totalAmount)}</div>
                    <div class="order-card-actions">
                        ${getActionButtons(o.id, o.status, o.paymentMethod)}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="padding: 1rem; color: red; text-align: center;">Lỗi tải đơn hàng. Vui lòng thử lại.</div>';
    }
}

function initOrderTabListeners() {
    const tabs = document.querySelectorAll('.order-tab');
    if (!tabs.length) return;
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeOrderTab = tab.dataset.status;
            loadIncomingOrders();
        });
    });

    // Enter key for search
    const searchInput = document.getElementById('order-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyOrderFilters();
        });
    }
}

function applyOrderFilters() {
    const input = document.getElementById('order-search-input');
    orderSearchKeyword = input ? input.value.trim() : '';
    loadIncomingOrders();
}

async function renderDashboard(shop) {
    const container = document.getElementById('seller-content');
    const tpl = document.getElementById('tpl-dashboard').content.cloneNode(true);
    container.innerHTML = '';
    container.appendChild(tpl);

    document.getElementById('shop-title-display').textContent = shop.name;

    // Load data
    loadSellerProducts();
    loadIncomingOrders();
    loadCategoriesForProduct();
    
    // Init listeners after DOM injected
    setTimeout(initOrderTabListeners, 50);
}

function getStatusText(s) {
    const map = {
        'Unpaid': 'Chờ nhận',
        'AwaitingShipment': 'Chờ vận chuyển',
        'AwaitingCollection': 'Chuẩn bị hàng',
        'InTransit': 'Đang giao',
        'Delivered': 'Đã giao',
        'Completed': 'Hoàn thành',
        'Cancelled': 'Đã hủy',
        'Returned': 'Trả hàng'
    };
    return map[s] || s;
}

function getActionButtons(id, status, paymentMethod) {
    const s = status.toLowerCase();
    let buttons = '';

    if (s === 'unpaid' && paymentMethod === 'COD') {
        buttons += `<button class="btn-premium confirm" onclick="updateOrderStatus('${id}', 'AwaitingShipment')" style="background:#6366f1;">Xác nhận</button>`;
    }
    else if (s === 'awaitingshipment') {
        buttons += `<button class="btn-premium confirm" onclick="updateOrderStatus('${id}', 'AwaitingCollection')">Chuẩn bị hàng</button>`;
    }
    else if (s === 'awaitingcollection') {
        buttons += `<button class="btn-premium confirm" style="background:#2563eb;" onclick="updateOrderStatus('${id}', 'InTransit')">Giao cho ĐVVC</button>`;
    }
    else if (s === 'intransit') {
        buttons += `<button class="btn-premium confirm" style="background:#10b981;" onclick="updateOrderStatus('${id}', 'Delivered')">Hoàn tất giao</button>`;
    }
    else if (s === 'delivered') {
        buttons += `<button class="btn-premium confirm" style="background:#10b981;" onclick="updateOrderStatus('${id}', 'Completed')">Xác nhận đã nhận</button>`;
    }

    buttons += `<button class="btn-premium detail" onclick="window.location.href='seller-order-detail.html?id=${id}'">Chi tiết</button>`;
    return buttons;
}

async function updateOrderStatus(id, status) {
    if (!confirm('Xác nhận chuyển trạng thái đơn hàng?')) return;
    try {
        await window.api.patch(`orders/${id}/status`, { status });
        loadIncomingOrders();
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

async function handleImageUpload(inputEl, targetId) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    
    const file = inputEl.files[0];
    const btn = inputEl.previousElementSibling;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>...';
    btn.disabled = true;

    try {
        const result = await window.api.uploadImage(file);
        
        const textarea = document.getElementById(targetId);
        const currentVals = textarea.value.split(',').map(s => s.trim()).filter(s => s);
        currentVals.push(result.url);
        textarea.value = currentVals.join(', ');
        
        alert('Tải ảnh lên thành công!');
    } catch (e) {
        console.error(e);
        alert('Lỗi tải ảnh: ' + e.message);
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
        inputEl.value = ''; // Reset input
    }
}

// Global exposure
window.addNewVariantRow = addNewVariantRow;
window.openAddProductModal = openAddProductModal;
window.closeAddProductModal = closeModalProductAdd; // Re-alias for consistency
window.closeAddProductModal = closeAddProductModal;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.updateOrderStatus = updateOrderStatus;
window.switchSellerTab = switchSellerTab;
window.confirmDeleteProduct = confirmDeleteProduct;
window.applyOrderFilters = applyOrderFilters;
window.handleImageUpload = handleImageUpload;
