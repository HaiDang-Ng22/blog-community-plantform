// js/seller-order-detail.js

document.addEventListener('DOMContentLoaded', async () => {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    if (!localStorage.getItem('auth_token') || !userInfo) {
        window.location.href = 'auth.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    if (!orderId) {
        window.location.href = 'seller-center.html';
        return;
    }

    await loadSellerOrderDetails(orderId);
});

async function loadSellerOrderDetails(orderId) {
    try {
        const order = await window.api.get(`orders/${orderId}`);
        renderSellerOrder(order);
    } catch (e) {
        console.error('Lỗi khi tải chi tiết đơn hàng:', e);
        alert('Lỗi: ' + e.message);
        window.location.href = 'seller-center.html';
    }
}

function renderSellerOrder(order) {
    document.getElementById('order-loading').classList.add('hidden');
    document.getElementById('order-content').classList.remove('hidden');

    // 1. Base Info
    document.getElementById('disp-customer-name').textContent = order.customerName || order.CustomerName;
    document.getElementById('disp-phone').textContent = order.phoneNumber || order.PhoneNumber;
    document.getElementById('disp-address').textContent = order.shippingAddress || order.ShippingAddress;
    document.getElementById('disp-total-amount').textContent = formatCurrency(order.totalAmount || order.TotalAmount);
    document.getElementById('disp-payment-method').textContent = order.paymentMethod || order.PaymentMethod;
    document.getElementById('disp-order-id').textContent = (order.id || order.Id).toUpperCase();
    document.getElementById('disp-order-date').textContent = new Date(order.createdAt || order.CreatedAt).toLocaleString('vi-VN');

    const status = (order.status || order.Status).toLowerCase();
    document.getElementById('current-status-text').textContent = getStatusLabel(status);

    // 2. Stepper
    updateSellerStepper(status);

    // 3. Items
    const items = order.items || order.Items || [];
    const itemsList = document.getElementById('seller-items-list');
    itemsList.innerHTML = items.map(i => `
        <div class="order-item">
            <img src="${i.productImageUrl || 'https://placehold.co/60'}" class="item-img" alt="${i.productName}">
            <div class="item-details">
                <div class="item-name">${i.productName}</div>
                <div class="item-meta">Phân loại: ${i.variantName || 'Mặc định'} | SL: x${i.quantity}</div>
                <div style="font-weight: 700; color: #334155; margin-top: 5px;">${formatCurrency(i.unitPrice)}</div>
            </div>
        </div>
    `).join('');

    // 4. Actions
    renderSellerActions(order.id || order.Id, status);
}

function updateSellerStepper(status) {
    const steps = document.querySelectorAll('.step');
    const statusOrder = ['awaitingshipment', 'awaitingcollection', 'intransit', 'completed'];
    let currentIndex = statusOrder.indexOf(status);

    if (status === 'unpaid') currentIndex = -1;
    if (status === 'delivered') currentIndex = 2; // Map delivered to InTransit for stepper
    
    if (status === 'cancelled' || status === 'returned') {
        document.getElementById('order-stepper').innerHTML = `
            <div style="color: #ef4444; font-weight: bold; width: 100%; text-align: center;">
                <i class="fa fa-times-circle"></i> ĐƠN HÀNG ĐÃ ${status === 'cancelled' ? 'HỦY' : 'TRẢ HÀNG'}
            </div>
        `;
        return;
    }

    steps.forEach((step, index) => {
        if (index < currentIndex) {
            step.classList.add('completed');
        } else if (index === currentIndex) {
            step.classList.add('active');
        }
    });
}

function renderSellerActions(orderId, status) {
    const container = document.getElementById('seller-actions-container');
    container.innerHTML = '';

    if (status === 'awaitingshipment') {
        container.innerHTML = `
            <button class="btn-action btn-confirm" onclick="updateStatus('${orderId}', 'AwaitingCollection')">
                <i class="fa fa-check"></i> Xác nhận & Chuẩn bị hàng
            </button>
            <button class="btn-action btn-reject" onclick="rejectOrder('${orderId}')">
                <i class="fa fa-times"></i> Từ chối đơn hàng
            </button>
        `;
    } else if (status === 'awaitingcollection') {
        container.innerHTML = `
            <button class="btn-action btn-confirm" onclick="updateStatus('${orderId}', 'InTransit')">
                <i class="fa fa-truck"></i> Giao cho Đơn vị vận chuyển
            </button>
        `;
    } else if (status === 'intransit' || status === 'delivered') {
        container.innerHTML = `<p style="color: #94a3b8; font-size: 0.85rem; text-align: center;">Đơn hàng đang trong quá trình vận chuyển.</p>`;
    } else if (status === 'completed') {
        container.innerHTML = `<p style="color: #10b981; font-size: 0.85rem; text-align: center; font-weight: bold;"><i class="fa fa-check-circle"></i> Đơn hàng đã hoàn thành.</p>`;
    } else if (status === 'cancelled') {
        container.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem; text-align: center; font-weight: bold;">Đơn hàng đã bị hủy.</p>`;
    } else if (status === 'unpaid') {
        container.innerHTML = `<p style="color: #f59e0b; font-size: 0.85rem; text-align: center;">Đang chờ người mua thanh toán qua cổng online.</p>`;
    }
}

async function updateStatus(orderId, newStatus) {
    try {
        await window.api.patch(`orders/${orderId}/status`, { status: newStatus });
        window.common?.showToast('Cập nhật trạng thái thành công.', 'success');
        loadSellerOrderDetails(orderId);
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

async function rejectOrder(orderId) {
    if (!confirm('Bạn có chắc chắn muốn TỪ CHỐI đơn hàng này không? Quá trình này không thể hoàn tác.')) return;
    
    try {
        await window.api.patch(`orders/${orderId}/status`, { status: 'Cancelled' });
        window.common?.showToast('Đã từ chối đơn hàng.', 'info');
        loadSellerOrderDetails(orderId);
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

function getStatusLabel(status) {
    const labels = {
        'unpaid': 'Chờ xác nhận',
        'awaitingshipment': 'Chờ vận chuyển',
        'awaitingcollection': 'Đang chuẩn bị hàng',
        'intransit': 'Đang giao hàng',
        'delivered': 'Đã giao hàng',
        'completed': 'Hoàn thành',
        'cancelled': 'Đã hủy',
        'returned': 'Trả hàng'
    };
    return labels[status] || status;
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Global exposure
window.updateStatus = updateStatus;
window.rejectOrder = rejectOrder;
