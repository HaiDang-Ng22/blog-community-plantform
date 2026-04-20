let allOrders = [];
let activeTab = 'ALL';
let searchKeyword = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    setupTabs();
    await loadOrders();

    // Enter key for search
    document.getElementById('order-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyBuyerSearch();
    });
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            activeTab = e.target.getAttribute('data-status');
            renderOrders();
        });
    });
}

function applyBuyerSearch() {
    searchKeyword = document.getElementById('order-search-input')?.value.trim().toLowerCase() || '';
    renderOrders();
}

async function loadOrders() {
    try {
        allOrders = await window.api.get('orders/my-orders');
        renderOrders();
    } catch (e) {
        document.getElementById('orders-list').innerHTML = `
            <div style="text-align:center; padding: 3rem; color: #ef4444;">
                <i class="fa fa-exclamation-triangle fa-2x"></i>
                <p>Không thể tải danh sách đơn hàng: ${e.message}</p>
            </div>
        `;
    }
}

function renderOrders() {
    const list = document.getElementById('orders-list');
    
    // 1. Filter by Tab
    let filtered = allOrders;
    if (activeTab !== 'ALL') {
        filtered = allOrders.filter(o => o.status === activeTab);
    }

    // 2. Filter by Keyword
    if (searchKeyword) {
        filtered = filtered.filter(o => {
            const matchId = o.id.toLowerCase().includes(searchKeyword);
            const matchProduct = o.items.some(i => i.productName.toLowerCase().includes(searchKeyword));
            return matchId || matchProduct;
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 4rem; color: #64748b; background: white; border-radius: 1rem; border: 1px solid #e2e8f0;">
                <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
                <p style="font-size: 1.1rem; font-weight: 600;">Không tìm thấy đơn hàng phù hợp</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(o => {
        const s = o.status.toLowerCase();
        let statusLabel = getStatusLabel(s);
        let statusClass = s;

        const itemsHtml = o.items.map(i => `
            <div class="order-item" style="display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px dashed #f1f5f9;">
                <img src="${i.productImageUrl || 'https://placehold.co/80'}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover;">
                <div class="order-item-info" style="flex: 1;">
                    <div class="order-item-title" style="font-weight: 700; color: #1e293b; margin-bottom: 0.25rem;">${i.productName}</div>
                    <div class="order-item-meta" style="color: #64748b; font-size: 0.85rem;">Phân loại: ${i.variantName || 'Mặc định'}</div>
                    <div style="font-size: 0.9rem; margin-top: 4px;">x${i.quantity}</div>
                </div>
                <div class="order-item-price" style="font-weight: 600; color: #334155;">${formatCurrency(i.unitPrice)}</div>
            </div>
        `).join('');

        let actionBtns = '';
        if (s === 'delivered') {
            actionBtns = `<button class="btn-confirm" style="background:#10b981; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight: 700; cursor:pointer;" onclick="confirmOrder('${o.id}')">Đã nhận hàng</button>`;
        }
        if (s === 'completed' || s === 'cancelled') {
            const itemsData = encodeURIComponent(JSON.stringify(o.items));
            actionBtns += `<button class="btn-reorder" style="background: #3b82f6; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight: 700; cursor:pointer;" onclick="reorder('${o.id}', '${itemsData}')">Mua lại</button>`;
        }

        return `
            <div class="order-card" style="background: white; border-radius: 1rem; border: 1px solid #e2e8f0; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); cursor: pointer;" onclick="window.location.href='order-detail.html?id=${o.id}'">
                <div class="order-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.8rem; background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">Mã ĐH: #${o.id.substring(0, 8).toUpperCase()}</span>
                        <span style="color: #94a3b8; font-size: 0.8rem;"><i class="fa fa-calendar-alt"></i> ${new Date(o.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div class="status-badge ${statusClass}" style="text-transform: uppercase; font-size: 0.8rem; font-weight: 800; padding: 6px 12px; border-radius: 6px;">${statusLabel}</div>
                </div>
                ${itemsHtml}
                <div class="order-footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1rem;">
                    <div style="text-align: left;">
                        <div style="color: #64748b; font-size: 0.85rem;">Tổng số tiền:</div>
                        <div class="order-total-price" style="font-size: 1.4rem; font-weight: 800; color: #ef4444;">${formatCurrency(o.totalAmount)}</div>
                    </div>
                    <div onclick="event.stopPropagation()">${actionBtns}</div>
                </div>
                <div style="margin-top: 1rem; text-align: center; border-top: 1px solid #f8fafc; padding-top: 0.75rem;">
                    <span style="color: #3b82f6; font-size: 0.85rem; font-weight: 700;">Xem chi tiết đơn hàng <i class="fa fa-arrow-right"></i></span>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusLabel(s) {
    const labels = {
        'unpaid': 'Chờ xác nhận',
        'awaitingshipment': 'Chờ vận chuyển',
        'awaitingcollection': 'Đang chuẩn bị',
        'intransit': 'Đang giao hàng',
        'delivered': 'Đã giao hàng',
        'completed': 'Hoàn thành',
        'cancelled': 'Đã hủy',
        'returned': 'Đã trả hàng'
    };
    return labels[s] || s;
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

window.applyBuyerSearch = applyBuyerSearch;
window.confirmOrder = confirmOrder;
window.reorder = reorder;
