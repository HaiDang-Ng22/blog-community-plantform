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

    // Show "Confirm Receipt" if in transit
    if (s === 'intransit') {
        document.getElementById('btn-received-order').classList.remove('hidden');
    }

    // 3. Items List
    const itemsList = document.getElementById('items-list');
    const orderItems = order.items || order.Items || [];
    
    if (orderItems.length === 0) {
        itemsList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #94a3b8;">Không có thông tin sản phẩm.</div>';
    } else {
        itemsList.innerHTML = orderItems.map(i => `
            <div class="order-item" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1rem;">
                <img src="${i.productImageUrl || 'https://placehold.co/80'}" class="item-img" alt="${i.productName}">
                <div class="item-details" style="flex: 1;">
                    <div class="item-name" style="font-weight: 600; color: #1e293b;">${i.productName}</div>
                    <div class="item-meta" style="font-size: 0.85rem; color: #64748b;">Phân loại: ${i.variantName || 'Mặc định'}</div>
                    <div class="item-price-qty" style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                        <span style="color: #94a3b8;">${formatCurrency(i.unitPrice)} x ${i.quantity}</span>
                        <span style="font-weight: 600; color: #334155;">${formatCurrency(i.unitPrice * i.quantity)}</span>
                    </div>
                    ${(s === 'completed' || s === 'delivered') ? `
                        <button class="btn-review-item" onclick="openReviewModal('${i.productId}', '${i.productName}', '${i.productImageUrl || ''}')">
                            <i class="fa fa-star"></i> Đánh giá
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // 4. Summary & Info
    const subtotal = order.totalAmount - (order.shippingFee || 0);
    document.getElementById('sum-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('sum-shipping').textContent = formatCurrency(order.shippingFee || 0);
    document.getElementById('sum-total').textContent = formatCurrency(order.totalAmount);
    document.getElementById('order-id-full').textContent = order.id.toUpperCase();
    document.getElementById('order-time').textContent = new Date(order.createdAt).toLocaleString('vi-VN');
    document.getElementById('order-payment-method').textContent = order.paymentMethod;

    // 5. Handle Payment QR
    const qrCard = document.getElementById('payment-qr-card');
    if (order.paymentMethod === 'BANK' && order.status === 'Unpaid' && order.bankAccountNumber) {
        qrCard.classList.remove('hidden');
        const bankId = order.bankName || 'MB'; // Default to MB if not set
        const accountNo = order.bankAccountNumber;
        const accountName = encodeURIComponent(order.bankAccountName || '');
        const amount = order.totalAmount;
        const info = encodeURIComponent(`ZYNK ORDER ${order.id.substring(0, 8)}`);
        
        // Use VietQR Quick Link API
        const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${info}&accountName=${accountName}`;
        document.getElementById('vietqr-img').src = qrUrl;
        document.getElementById('bank-info-text').innerHTML = `
            <strong>Ngân hàng:</strong> ${bankId}<br>
            <strong>STK:</strong> ${accountNo}<br>
            <strong>Chủ TK:</strong> ${order.bankAccountName || '-'}
        `;
    } else {
        qrCard.classList.add('hidden');
    }

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

async function confirmReceipt() {
    const orderId = window._currentOrder.id;
    if (!confirm('Bạn xác nhận đã nhận được đầy đủ hàng và hài lòng với sản phẩm?')) return;

    try {
        await window.api.patch(`orders/${orderId}/status`, { status: 'Completed' });
        window.common?.showToast('Xác nhận đã nhận hàng thành công!', 'success');
        loadOrderDetails(orderId);
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

// --- REVIEW LOGIC ---
let selectedReviewImages = [];

function openReviewModal(productId, productName, productImg) {
    document.getElementById('review-product-id').value = productId;
    document.getElementById('review-target-product').innerHTML = `
        <img src="${productImg || 'https://placehold.co/50'}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
        <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b;">${productName}</div>
    `;
    
    // Reset form
    document.getElementById('form-review-product').reset();
    document.getElementById('star5').checked = true;
    document.getElementById('review-img-preview').innerHTML = '';
    selectedReviewImages = [];
    
    document.getElementById('review-modal').classList.remove('hidden');
}

function closeReviewModal() {
    document.getElementById('review-modal').classList.add('hidden');
}

async function handleReviewImageSelect(input) {
    const files = Array.from(input.files);
    if (files.length + selectedReviewImages.length > 3) {
        alert('Chỉ được tải lên tối đa 3 ảnh.');
        return;
    }

    const previewContainer = document.getElementById('review-img-preview');

    for (const file of files) {
        try {
            // Upload immediately to get URL
            const result = await window.api.uploadImage(file);
            selectedReviewImages.push(result.url);

            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'review-img-item-wrapper';
            imgWrapper.style.position = 'relative';
            imgWrapper.innerHTML = `
                <img src="${result.url}" class="review-img-item">
                <i class="fa fa-times-circle" style="position: absolute; top: -5px; right: -5px; color: #ef4444; cursor: pointer; background: #fff; border-radius: 50%;" 
                    onclick="this.parentElement.remove(); selectedReviewImages = selectedReviewImages.filter(url => url !== '${result.url}')"></i>
            `;
            previewContainer.appendChild(imgWrapper);
        } catch (err) {
            alert('Lỗi khi tải ảnh: ' + err.message);
        }
    }
}

document.getElementById('form-review-product').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-review');
    const productId = document.getElementById('review-product-id').value;
    const rating = document.querySelector('input[name="rating"]:checked').value;
    const comment = document.getElementById('review-comment').value.trim();

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang gửi...';

        await window.api.post(`marketplace/products/${productId}/reviews`, {
            rating: parseInt(rating),
            comment: comment,
            imageUrls: selectedReviewImages
        });

        window.common?.showToast('Cảm ơn bạn đã đánh giá sản phẩm!', 'success');
        closeReviewModal();
        // Có thể load lại chi tiết đơn hàng để cập nhật trạng thái nút "Đánh giá" nếu cần
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Gửi đánh giá';
    }
};

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Export for global access
window.cancelOrder = cancelOrder;
window.confirmReceipt = confirmReceipt;
window.openAddressModal = openAddressModal;
window.closeAddressModal = closeAddressModal;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.handleReviewImageSelect = handleReviewImageSelect;
