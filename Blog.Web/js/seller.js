/* js/seller.js */
document.addEventListener('DOMContentLoaded', initializeSellerCenter);

let _revenueChart = null;
let _currentConversationId = null;

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
                description: document.getElementById('shop-desc').value,
                citizenId: document.getElementById('citizen-id').value,
                fullName: document.getElementById('full-name').value,
                gender: document.getElementById('gender').value,
                dateOfBirth: document.getElementById('dob').value,
                hometown: document.getElementById('hometown').value,
                occupation: document.getElementById('occupation').value
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
    loadDashboardStats();
    loadSellerProducts();
    loadIncomingOrders();
    loadCategoriesForProduct();
    loadPaymentSettings(shop);

    // Init listeners
    setTimeout(initOrderTabListeners, 50);
}

function switchSellerTab(tab) {
    // 1. Update UI
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));

    // Find the clicked element or default to the one that matches the tab
    const activeTabLink = document.querySelector(`.tab-link[onclick*="'${tab}'"]`);
    if (activeTabLink) activeTabLink.classList.add('active');

    const targetSection = document.getElementById(`section-${tab}`);
    if (targetSection) targetSection.classList.add('active');

    // 2. Load Data
    if (tab === 'overview') loadDashboardStats();
    if (tab === 'vouchers') loadVouchers();
    if (tab === 'messages') loadShopConversations();
    if (tab === 'marketing') console.log('Marketing tab active'); // Placeholder for future logic
}

async function loadDashboardStats() {
    try {
        const stats = await window.api.get('seller/dashboard-stats');
        document.getElementById('stat-orders').textContent = stats.totalOrders;
        document.getElementById('stat-revenue').textContent = formatCurrency(stats.totalRevenue);
        document.getElementById('stat-products').textContent = stats.totalProducts;

        renderRevenueChart(stats.revenueChart);
    } catch (e) {
        console.error('Failed to load dashboard stats', e);
    }
}

function renderRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    if (_revenueChart) _revenueChart.destroy();

    _revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Doanh thu',
                data: data.map(d => d.revenue),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            }
        }
    });
}

// ============================
// Voucher Management
// ============================
async function loadVouchers() {
    const tbody = document.getElementById('voucher-list-body');
    if (!tbody) return;

    try {
        const vouchers = await window.api.get('seller/vouchers');
        if (vouchers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Chưa có mã giảm giá nào.</td></tr>';
            return;
        }

        tbody.innerHTML = vouchers.map(v => `
            <tr>
                <td><strong>${v.code}</strong></td>
                <td>${v.description}</td>
                <td>${v.discountType === 'Percentage' ? v.discountValue + '%' : formatCurrency(v.discountValue)}</td>
                <td style="font-size: 0.85rem;">${new Date(v.startDate).toLocaleDateString('vi')} - ${new Date(v.endDate).toLocaleDateString('vi')}</td>
                <td>${v.usedCount} / ${v.usageLimit || '∞'}</td>
                <td>
                    <button class="action-pill delete" onclick="deleteVoucher('${v.id}')"><i class="fa fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Lỗi tải dữ liệu.</td></tr>';
    }
}

function openAddVoucherModal() {
    document.getElementById('voucher-add-modal').classList.remove('hidden');
}

function closeAddVoucherModal() {
    document.getElementById('voucher-add-modal').classList.add('hidden');
}

document.getElementById('form-add-voucher').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        code: document.getElementById('v-code').value,
        description: document.getElementById('v-desc').value,
        discountType: document.getElementById('v-type').value,
        discountValue: parseFloat(document.getElementById('v-value').value),
        minOrderValue: parseFloat(document.getElementById('v-min-order').value) || 0,
        maxDiscountAmount: parseFloat(document.getElementById('v-max-discount').value) || 0,
        startDate: document.getElementById('v-start').value,
        endDate: document.getElementById('v-end').value,
        usageLimit: parseInt(document.getElementById('v-limit').value) || null
    };

    try {
        await window.api.post('seller/vouchers', data);
        alert('Tạo mã giảm giá thành công!');
        closeAddVoucherModal();
        loadVouchers();
    } catch (err) {
        alert(err.message || 'Lỗi khi tạo voucher');
    }
};

async function deleteVoucher(id) {
    if (!confirm('Xóa mã giảm giá này?')) return;
    try {
        await window.api.delete(`seller/vouchers/${id}`);
        loadVouchers();
    } catch (e) {
        alert(e.message);
    }
}

// ============================
// Shop Chat Management
// ============================
async function loadShopConversations() {
    const sidebar = document.getElementById('chat-sidebar');
    if (!sidebar) return;

    try {
        const convs = await window.api.get('shopchat/conversations');
        if (convs.length === 0) {
            sidebar.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Chưa có tin nhắn nào.</p>';
            return;
        }

        sidebar.innerHTML = convs.map(c => `
            <div class="chat-item ${c.id === _currentConversationId ? 'active' : ''}" onclick="selectConversation('${c.id}')">
                <img src="${c.buyerAvatar || 'https://ui-avatars.com/api/?name=' + c.buyerName}" class="chat-avatar">
                <div class="chat-info">
                    <div class="chat-name">${c.buyerName}</div>
                    <div class="chat-last-msg">${c.lastMessage || 'Gửi một hình ảnh'}</div>
                </div>
                ${c.unreadCount > 0 ? `<div class="chat-unread">${c.unreadCount}</div>` : ''}
            </div>
        `).join('');
    } catch (e) {
        sidebar.innerHTML = '<p style="color: red; padding: 20px;">Lỗi tải hội thoại.</p>';
    }
}

async function selectConversation(id) {
    _currentConversationId = id;
    loadShopConversations(); // Update active state in sidebar

    const main = document.getElementById('chat-main');
    main.innerHTML = `
        <div class="chat-header">
            <h3 id="chat-buyer-name">Đang tải...</h3>
        </div>
        <div class="chat-messages" id="chat-messages">
            <div style="text-align: center; padding: 2rem;"><i class="fa fa-spinner fa-spin"></i></div>
        </div>
        <div class="chat-input-area">
            <input type="text" id="chat-input" placeholder="Nhập tin nhắn..." onkeypress="if(event.key === 'Enter') sendShopMessage()">
            <button onclick="sendShopMessage()"><i class="fa fa-paper-plane"></i></button>
        </div>
    `;

    try {
        const messages = await window.api.get(`shopchat/messages/${id}`);
        const msgContainer = document.getElementById('chat-messages');
        msgContainer.innerHTML = messages.map(m => `
            <div class="message ${m.isMe ? 'me' : 'other'}">
                <div class="message-content">${m.content}</div>
                <div class="message-time">${new Date(m.createdAt).toLocaleTimeString('vi', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `).join('');
        msgContainer.scrollTop = msgContainer.scrollHeight;
    } catch (e) {
        alert('Lỗi tải tin nhắn');
    }
}

async function sendShopMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !_currentConversationId) return;

    try {
        const msg = await window.api.post('shopchat/send', {
            conversationId: _currentConversationId,
            content: content
        });
        
        const msgContainer = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message me';
        msgDiv.innerHTML = `
            <div class="message-content">${msg.content}</div>
            <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString('vi', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        msgContainer.appendChild(msgDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        input.value = '';
        
        loadShopConversations(); // Update last message in sidebar
    } catch (e) {
        alert('Lỗi gửi tin nhắn');
    }
}

// ============================
// Product Management (Preserved & Enhanced)
// ============================
let _cachedProducts = [];
let allCategories = [];

async function loadSellerProducts() {
    const tbody = document.getElementById('product-list-body');
    if (!tbody) return;
    
    try {
        const products = await window.api.get('seller/my-products');
        _cachedProducts = products;

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Chưa có sản phẩm nào.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td><img src="${p.featuredImageUrl || 'https://via.placeholder.com/50'}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"></td>
                <td title="${p.name}">${p.name}</td>
                <td>${formatCurrency(p.price)}</td>
                <td>${p.stock}</td>
                <td><span class="badge ${p.stock === 0 ? 'badge-pending' : 'badge-success'}">${p.stock === 0 ? 'Hết hàng' : 'Đang bán'}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="action-pill edit" onclick="openEditProductModal('${p.id}')"><i class="fa fa-edit"></i></button>
                        <button class="action-pill delete" onclick="confirmDeleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')"><i class="fa fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Lỗi tải dữ liệu.</td></tr>';
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

// Category Cascade Logic (Preserved)
function resetCategoryCascade() {
    const container = document.getElementById('category-cascade-selects');
    if (!container) return;
    container.innerHTML = '';
    const roots = allCategories.filter(c => !c.parentCategoryId);
    if (roots.length > 0) addCascadeLevel(roots, 0, 'category-cascade-selects', 'p-category', 'category-selected-path');
}

function addCascadeLevel(options, level, containerId, hiddenInputId, pathId, preSelectedPath = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    while (container.children.length > level) container.removeChild(container.lastChild);

    const select = document.createElement('select');
    select.className = 'cascade-select';
    select.innerHTML = `<option value="" disabled selected>Chọn danh mục cấp ${level + 1}</option>` + 
        options.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (preSelectedPath && preSelectedPath[level]) select.value = preSelectedPath[level].id;

    select.onchange = () => {
        const val = select.value;
        const children = allCategories.filter(c => c.parentCategoryId && c.parentCategoryId.toLowerCase() === val.toLowerCase());
        document.getElementById(hiddenInputId).value = children.length === 0 ? val : '';
        if (children.length > 0) addCascadeLevel(children, level + 1, containerId, hiddenInputId, pathId);
        else while (container.children.length > level + 1) container.removeChild(container.lastChild);
        updateCategoryPath(containerId, pathId);
    };
    container.appendChild(select);
    if (preSelectedPath && preSelectedPath[level]) {
        const children = allCategories.filter(c => c.parentCategoryId && c.parentCategoryId.toLowerCase() === select.value.toLowerCase());
        if (children.length > 0) addCascadeLevel(children, level + 1, containerId, hiddenInputId, pathId, preSelectedPath);
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

// ============================
// Order Management (Preserved)
// ============================
let activeOrderTab = 'All';
let orderSearchKeyword = '';

async function loadIncomingOrders() {
    const container = document.getElementById('order-list-container');
    if (!container) return;
    try {
        const query = `status=${activeOrderTab}&keyword=${encodeURIComponent(orderSearchKeyword)}`;
        const orders = await window.api.get(`seller/incoming-orders?${query}`);
        
        if (orders.length === 0) {
            container.innerHTML = '<div class="no-posts" style="padding: 2rem; text-align: center;">Không có đơn hàng nào.</div>';
            return;
        }

        container.innerHTML = orders.map(o => `
            <div class="order-premium-card" style="background: white; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1.5fr min-content; gap: 1rem; align-items: center;">
                <div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #64748b;">#${o.id.substring(0,8).toUpperCase()}</div>
                    <div style="font-weight: 600; margin: 4px 0;">${o.customerName}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8;">${o.phoneNumber}</div>
                    <div style="margin-top: 8px;"><span class="status-badge ${o.status.toLowerCase()}">${getStatusText(o.status)}</span></div>
                </div>
                <div style="border-left: 1px solid #f1f5f9; padding-left: 1rem;">
                    ${o.items.map(i => `<div style="font-size: 0.8rem;">${i.productName} x${i.quantity}</div>`).join('')}
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700; color: #2563eb; margin-bottom: 8px;">${formatCurrency(o.totalAmount)}</div>
                    <div class="order-card-actions">${getActionButtons(o.id, o.status, o.paymentMethod)}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: red;">Lỗi tải đơn hàng.</p>';
    }
}

function initOrderTabListeners() {
    const tabs = document.querySelectorAll('.order-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeOrderTab = tab.dataset.status;
            loadIncomingOrders();
        };
    });
}

function getStatusText(s) {
    const map = { 'Unpaid': 'Chờ nhận', 'AwaitingShipment': 'Chờ giao', 'InTransit': 'Đang giao', 'Delivered': 'Đã giao', 'Completed': 'Hoàn thành', 'Cancelled': 'Đã hủy' };
    return map[s] || s;
}

function getActionButtons(id, status, paymentMethod) {
    const s = status.toLowerCase();
    let buttons = '';
    if (s === 'unpaid') buttons += `<button class="btn-premium confirm" onclick="updateOrderStatus('${id}', 'AwaitingShipment')">Xác nhận</button>`;
    else if (s === 'awaitingshipment') buttons += `<button class="btn-premium confirm" onclick="updateOrderStatus('${id}', 'InTransit')">Giao hàng</button>`;
    else if (s === 'intransit') buttons += `<button class="btn-premium confirm" onclick="updateOrderStatus('${id}', 'Delivered')">Đã giao</button>`;
    
    buttons += `<button class="btn-premium detail" onclick="window.location.href='seller-order-detail.html?id=${id}'">Chi tiết</button>`;
    return buttons;
}

async function updateOrderStatus(id, status) {
    if (!confirm('Xác nhận chuyển trạng thái?')) return;
    try {
        await window.api.patch(`orders/${id}/status`, { status });
        loadIncomingOrders();
    } catch (e) {
        alert(e.message);
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Payment Settings (Preserved)
async function loadPaymentSettings(shop) {
    const form = document.getElementById('form-payment-settings');
    if (!form) return;
    if (shop.bankName) document.getElementById('bank-name').value = shop.bankName;
    if (shop.bankAccountNumber) document.getElementById('bank-account-number').value = shop.bankAccountNumber;
    if (shop.bankAccountName) document.getElementById('bank-account-name').value = shop.bankAccountName;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            bankName: document.getElementById('bank-name').value,
            bankAccountNumber: document.getElementById('bank-account-number').value,
            bankAccountName: document.getElementById('bank-account-name').value.toUpperCase()
        };
        try {
            await window.api.put('seller/payment-settings', data);
            alert('Đã lưu cấu hình thanh toán.');
        } catch (err) {
            alert(err.message);
        }
    };
}

// Global exposure
window.switchSellerTab = switchSellerTab;
window.openAddVoucherModal = openAddVoucherModal;
window.closeAddVoucherModal = closeAddVoucherModal;
window.deleteVoucher = deleteVoucher;
window.selectConversation = selectConversation;
window.sendShopMessage = sendShopMessage;
window.openAddProductModal = () => document.getElementById('product-add-modal').classList.remove('hidden');
window.closeAddProductModal = () => document.getElementById('product-add-modal').classList.add('hidden');
window.updateOrderStatus = updateOrderStatus;
