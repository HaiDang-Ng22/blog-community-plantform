// js/order-detail.js

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    if (!orderId) {
        window.location.href = 'my-orders.html';
        return;
    }

    await loadOrderDetails(orderId);
});

async function loadOrderDetails(orderId) {
    try {
        const order = await window.api.get(`orders/${orderId}`);
        renderOrderDetails(order);
    } catch (e) {
        console.error('Lỗi khi tải chi tiết đơn hàng:', e);
        alert('Không thể tải thông tin đơn hàng: ' + e.message);
        window.location.href = 'my-orders.html';
    }
}

function renderOrderDetails(order) {
    document.getElementById('order-loading').classList.add('hidden');
    document.getElementById('order-content').classList.remove('hidden');

    // 1. Update Stepper
    updateStepper(order.status);

    // 2. Address Display
    const addressDisplay = document.getElementById('address-display');
    addressDisplay.innerHTML = `
        <div class="name-phone">${order.customerName} | ${order.phoneNumber}</div>
        <div class="address-text">
            ${order.specificAddress}<br>
            ${order.districtWard}, ${order.province}
        </div>
    `;

    // TikTok Shop logic: allow editing address if Unpaid or AwaitingShipment
    const s = order.status.toLowerCase();
    const canEdit = (s === 'unpaid' || s === 'awaitingshipment');
    if (canEdit) {
        document.getElementById('btn-show-edit-address').classList.remove('hidden');
        document.getElementById('btn-cancel-order').classList.remove('hidden');
    }

    // 3. Items List
    const itemsList = document.getElementById('items-list');
    const orderItems = order.items || order.Items || [];
    
    if (orderItems.length === 0) {
        itemsList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #94a3b8;">Không có thông tin sản phẩm.</div>';
    } else {
        itemsList.innerHTML = orderItems.map(i => `
            <div class="order-item">
                <img src="${i.productImageUrl || 'https://placehold.co/80'}" class="item-img" alt="${i.productName}">
                <div class="item-details">
                    <div class="item-name">${i.productName}</div>
                    <div class="item-meta">Phân loại: ${i.variantName || 'Mặc định'}</div>
                    <div class="item-price-qty">
                        <span>${formatCurrency(i.unitPrice)} x ${i.quantity}</span>
                        <span style="color: #334155;">${formatCurrency(i.unitPrice * i.quantity)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 4. Summary & Info
    document.getElementById('sum-subtotal').textContent = formatCurrency(order.totalAmount);
    document.getElementById('sum-total').textContent = formatCurrency(order.totalAmount);
    document.getElementById('order-id-full').textContent = order.id.toUpperCase();
    document.getElementById('order-time').textContent = new Date(order.createdAt).toLocaleString('vi-VN');
    document.getElementById('order-payment-method').textContent = order.paymentMethod;

    // Cache order data for modal
    window._currentOrder = order;
}

function updateStepper(status) {
    const s = status.toLowerCase();
    const steps = document.querySelectorAll('.step');
    
    // Status mapping to indices
    const statusOrder = ['unpaid', 'awaitingshipment', 'awaitingcollection', 'intransit', 'completed'];
    let currentIndex = statusOrder.indexOf(s);
    
    // If status is Delivered, we map it to Completed for the stepper as both show "Đã giao hàng"
    if (s === 'delivered') currentIndex = 4;
    if (s === 'cancelled' || s === 'returned') {
        // Handle cancelled/returned visually if needed
        document.getElementById('order-stepper').innerHTML = `
            <div style="color: #ef4444; font-weight: bold; width: 100%; text-align: center;">
                <i class="fa fa-times-circle"></i> ĐƠN HÀNG ĐÃ ${s === 'cancelled' ? 'HỦY' : 'TRẢ HÀNG'}
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

    // Handle special case: if Unpaid, and payment is COD, it should probably show as stage 2
    // But we handled this in backend by setting status to AwaitingShipment for COD.
}

function openAddressModal() {
    const order = window._currentOrder;
    if (!order) return;
    
    document.getElementById('edit-name').value = order.customerName;
    document.getElementById('edit-phone').value = order.phoneNumber;
    document.getElementById('edit-province').value = order.province;
    document.getElementById('edit-dist-ward').value = order.districtWard;
    document.getElementById('edit-specific').value = order.specificAddress;
    
    document.getElementById('address-modal').classList.remove('hidden');
}

function closeAddressModal() {
    document.getElementById('address-modal').classList.add('hidden');
}

document.getElementById('form-edit-address').onsubmit = async (e) => {
    e.preventDefault();
    const orderId = window._currentOrder.id;
    
    const data = {
        customerName: document.getElementById('edit-name').value,
        phoneNumber: document.getElementById('edit-phone').value,
        province: document.getElementById('edit-province').value,
        districtWard: document.getElementById('edit-dist-ward').value,
        specificAddress: document.getElementById('edit-specific').value,
        shippingAddress: `${document.getElementById('edit-specific').value}, ${document.getElementById('edit-dist-ward').value}, ${document.getElementById('edit-province').value}`
    };

    try {
        await window.api.put(`orders/${orderId}/address`, data);
        window.common?.showToast('Đã cập nhật địa chỉ giao hàng.', 'success');
        closeAddressModal();
        loadOrderDetails(orderId);
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
};

async function cancelOrder() {
    const orderId = window._currentOrder.id;
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) return;

    try {
        await window.api.patch(`orders/${orderId}/status`, { status: 'Cancelled' });
        window.common?.showToast('Đã hủy đơn hàng thành công.', 'success');
        loadOrderDetails(orderId);
    } catch (err) {
        alert('Lỗi khi hủy đơn: ' + err.message);
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Export for global access
window.cancelOrder = cancelOrder;
window.openAddressModal = openAddressModal;
window.closeAddressModal = closeAddressModal;
