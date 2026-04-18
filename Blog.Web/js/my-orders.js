let allOrders = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    setupTabs();
    await loadOrders();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const statusFilter = e.target.getAttribute('data-status');
            renderOrders(statusFilter);
        });
    });
}

async function loadOrders() {
    try {
        allOrders = await window.api.get('orders/my-orders');
        renderOrders('ALL');
    } catch (e) {
        document.getElementById('orders-list').innerHTML = `
            <div style="text-align:center; padding: 3rem; color: #ef4444;">
                <i class="fa fa-exclamation-triangle fa-2x"></i>
                <p>Không thể tải danh sách đơn hàng: ${e.message}</p>
            </div>
        `;
    }
}

function renderOrders(statusFilter) {
    const list = document.getElementById('orders-list');
    
    let filtered = allOrders;
    if (statusFilter !== 'ALL') {
        filtered = allOrders.filter(o => o.status === statusFilter);
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 4rem; color: #64748b; background: white; border-radius: 1rem; border: 1px solid #e2e8f0;">
                <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
                <p style="font-size: 1.1rem; font-weight: 600;">Chưa có đơn hàng nào</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(o => {
        let statusClass = 'order-status';
        let statusText = o.status;
        const s = o.status.toLowerCase();

        if (s === 'unpaid' || s === 'pendingpayment') {
            statusText = 'Chờ xác nhận';
        } else if (s === 'awaitingshipment' || s === 'toship') {
            statusText = 'Chờ vận chuyển';
        } else if (s === 'awaitingcollection') {
            statusText = 'Chờ lấy hàng';
        } else if (s === 'intransit' || s === 'shipped') {
            statusText = 'Đang giao';
            statusClass += ' shipped';
        } else if (s === 'delivered') {
            statusText = 'Đã giao hàng';
            statusClass += ' completed';
        } else if (s === 'completed') {
            statusText = 'Hoàn thành';
            statusClass += ' completed';
        } else if (s === 'cancelled') {
            statusText = 'Đã hủy';
            statusClass += ' cancelled';
        } else if (s === 'returned') {
            statusText = 'Trả hàng';
        }

        const itemsHtml = o.items.map(i => `
            <div class="order-item">
                <img src="${i.productImageUrl || 'https://placehold.co/80'}" alt="${i.productName}">
                <div class="order-item-info">
                    <div class="order-item-title">${i.productName}</div>
                    <div class="order-item-meta">Phân loại: ${i.variantName || 'Mặc định'} x ${i.quantity}</div>
                </div>
                <div class="order-item-price">${formatCurrency(i.unitPrice)}</div>
            </div>
        `).join('');

        let actionBtns = '';
        if (s === 'delivered') {
            actionBtns = `<button class="btn-reorder" style="background:#10b981; margin-right: 8px;" onclick="confirmOrder('${o.id}')">Đã nhận hàng</button>`;
        }
        if (s === 'completed' || s === 'cancelled') {
            const itemsData = encodeURIComponent(JSON.stringify(o.items));
            actionBtns += `<button class="btn-reorder" onclick="reorder('${o.id}', '${itemsData}')">Mua lại</button>`;
        }

        return `
            <div class="order-card" style="cursor: pointer;" onclick="window.location.href='order-detail.html?id=${o.id}'">
                <div class="order-header">
                    <div>
                        <span style="font-weight: 600; color: #64748b; font-size: 0.9rem;">Mã ĐH: #${o.id.substring(0, 8)}</span>
                        <span style="margin-left: 1rem; color: #94a3b8; font-size: 0.85rem;">${new Date(o.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div class="${statusClass}">${statusText}</div>
                </div>
                ${itemsHtml}
                <div class="order-footer">
                    <div>Thành tiền: <span class="order-total-price">${formatCurrency(o.totalAmount)}</span></div>
                    <div onclick="event.stopPropagation()">${actionBtns}</div>
                </div>
                <div style="text-align: right; margin-top: 0.5rem;">
                    <span style="color: #3b82f6; font-size: 0.85rem; font-weight: 600;">Xem chi tiết <i class="fa fa-chevron-right"></i></span>
                </div>
            </div>
        `;
    }).join('');
}

async function confirmOrder(orderId) {
    if (!confirm('Bạn xác nhận đã nhận được hàng và hài lòng với sản phẩm?')) return;
    try {
        await window.api.patch(`orders/${orderId}/status`, { status: 'Completed' });
        window.common?.showToast('Cảm ơn bạn đã mua sắm!', 'success');
        loadOrders();
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

function reorder(orderId, itemsDataStr) {
    try {
        const items = JSON.parse(decodeURIComponent(itemsDataStr));
        let cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
        
        items.forEach(i => {
            const existing = cart.find(c => c.id === i.productId && c.variantId === i.variantId);
            if (existing) {
                existing.qty += i.quantity;
            } else {
                cart.push({
                    id: i.productId,
                    name: i.productName,
                    price: i.unitPrice,
                    img: i.productImageUrl,
                    qty: i.quantity,
                    variantId: i.variantId
                });
            }
        });
        
        localStorage.setItem('zynk_cart', JSON.stringify(cart));
        if (window.common?.showToast) {
            window.common.showToast('Đã thêm lại các sản phẩm vào giỏ hàng', 'success');
        } else {
            alert('Đã thêm lại vào giỏ hàng!');
        }
        
        setTimeout(() => {
            window.location.href = 'cart.html';
        }, 800);
    } catch (e) {
        console.error('Lỗi khi mua lại: ', e);
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}
