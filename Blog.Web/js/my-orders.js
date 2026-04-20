let allOrders = [];
let activeTab = 'ALL';
let searchKeyword = '';

// ---- Review modal state ----
let _reviewOrder = null;
let _reviewRatings = {};

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    setupTabs();
    await loadOrders();
    injectReviewModal();

    document.getElementById('order-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyBuyerSearch();
    });
});

// ========= TAB SETUP =========
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

// ========= LOAD & RENDER ORDERS =========
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

    // 1. Filter by Tab (case-insensitive comparison)
    let filtered = allOrders;
    if (activeTab !== 'ALL') {
        filtered = allOrders.filter(o => o.status.toLowerCase() === activeTab.toLowerCase());
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

    list.innerHTML = filtered.map(o => renderOrderCard(o)).join('');
}

function renderOrderCard(o) {
    const s = o.status.toLowerCase();
    const statusLabel = getStatusLabel(s);

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

    // ---- Action Buttons ----
    let actionBtns = '';
    if (s === 'delivered') {
        actionBtns = `<button class="btn-confirm-recv" onclick="event.stopPropagation(); confirmOrder('${o.id}')"
            style="background:#10b981; color: white; border: none; padding: 0.6rem 1.4rem; border-radius: 0.5rem; font-weight: 700; cursor:pointer; font-size:0.9rem;">
            <i class="fa fa-check"></i> Đã nhận hàng
        </button>`;
    }
    if (s === 'completed' || s === 'cancelled') {
        const itemsData = encodeURIComponent(JSON.stringify(o.items));
        actionBtns += `<button class="btn-reorder" onclick="event.stopPropagation(); reorder('${o.id}', '${itemsData}')"
            style="background: #3b82f6; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight: 700; cursor:pointer; font-size:0.9rem; margin-left:0.5rem;">
            <i class="fa fa-redo"></i> Mua lại
        </button>`;
    }

    // ---- Review Banner (only for "delivered" status) ----
    const reviewBanner = s === 'delivered' ? `
        <div class="review-banner" onclick="event.stopPropagation(); openReviewForOrder('${o.id}')">
            <i class="fa-solid fa-star" style="color:#f59e0b; font-size:1.5rem; flex-shrink:0;"></i>
            <div style="flex:1;">
                <div style="font-weight:700; color:#92400e; font-size:0.9rem;">🎉 Đơn hàng đã được giao thành công!</div>
                <div style="font-size:0.8rem; color:#b45309; margin-top:2px;">Hãy đánh giá để giúp người mua khác lựa chọn tốt hơn</div>
            </div>
            <span style="background:#f59e0b; color:white; border:none; padding:0.45rem 1rem; border-radius:0.5rem; font-weight:700; font-size:0.82rem; cursor:pointer; flex-shrink:0;">
                Đánh giá ngay →
            </span>
        </div>
    ` : '';

    return `
        <div class="order-card" style="background: white; border-radius: 1rem; border: 1px solid #e2e8f0; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;"
            onclick="window.location.href='order-detail.html?id=${o.id}'"
            onmouseenter="this.style.boxShadow='0 8px 20px -4px rgba(0,0,0,0.12)'; this.style.transform='translateY(-2px)'"
            onmouseleave="this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.05)'; this.style.transform='none'">
            <div class="order-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-weight: 800; color: #1e293b; font-size: 0.8rem; background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">Mã ĐH: #${o.id.substring(0, 8).toUpperCase()}</span>
                    <span style="color: #94a3b8; font-size: 0.8rem;"><i class="fa fa-calendar-alt"></i> ${new Date(o.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <div class="status-badge ${s}">${statusLabel}</div>
            </div>
            ${itemsHtml}
            <div class="order-footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1rem;">
                <div style="text-align: left;">
                    <div style="color: #64748b; font-size: 0.85rem;">Tổng số tiền:</div>
                    <div class="order-total-price" style="font-size: 1.4rem; font-weight: 800; color: #ef4444;">${formatCurrency(o.totalAmount)}</div>
                </div>
                <div onclick="event.stopPropagation()">${actionBtns}</div>
            </div>
            ${reviewBanner}
            <div style="margin-top: 0.75rem; text-align: center; border-top: 1px solid #f8fafc; padding-top: 0.75rem;">
                <span style="color: #3b82f6; font-size: 0.85rem; font-weight: 700;">Xem chi tiết đơn hàng <i class="fa fa-arrow-right"></i></span>
            </div>
        </div>
    `;
}

// ========= STATUS LABELS =========
function getStatusLabel(s) {
    const labels = {
        'unpaid':              'Chờ xác nhận',
        'awaitingshipment':    'Chờ lấy hàng',
        'awaitingcollection':  'Đang chuẩn bị',
        'intransit':           'Đang giao hàng',
        'delivered':           '📦 Đã giao hàng',
        'completed':           '✅ Hoàn thành',
        'cancelled':           'Đã hủy',
        'returned':            'Đã trả hàng'
    };
    return labels[s] || s;
}

// ========= CONFIRM ORDER (Buyer xác nhận nhận hàng) =========
async function confirmOrder(orderId) {
    if (!confirm('Bạn xác nhận đã nhận được hàng?\nSau khi xác nhận, bạn có thể đánh giá sản phẩm!')) return;

    // Capture order data before reload
    const order = allOrders.find(o => o.id === orderId);

    try {
        await window.api.patch(`orders/${orderId}/status`, { status: 'Completed' });
        window.common?.showToast('🎉 Đơn hàng hoàn thành! Hãy để lại đánh giá nhé.', 'success');
        loadOrders(); // reload in background

        // Show review modal after short delay
        if (order?.items?.length > 0) {
            setTimeout(() => showReviewModal(order), 600);
        }
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

// Open review modal from the banner (for delivered orders not yet confirmed)
function openReviewForOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (order) showReviewModal(order);
}

// ========= REVIEW MODAL =========
function injectReviewModal() {
    if (document.getElementById('review-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'review-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;align-items:center;justify-content:center;backdrop-filter:blur(5px);';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:1.5rem;width:95%;max-width:580px;max-height:88vh;overflow-y:auto;box-shadow:0 25px 60px -10px rgba(0,0,0,0.35);animation:slideUp 0.3s ease;">
            <div style="padding:1.5rem 1.75rem 1rem;border-bottom:1px solid #f1f5f9;position:sticky;top:0;background:#fff;z-index:1;border-radius:1.5rem 1.5rem 0 0;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                    <div>
                        <h3 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin:0;">⭐ Đánh giá sản phẩm</h3>
                        <p style="color:#64748b;font-size:0.85rem;margin:0.3rem 0 0;">Chia sẻ trải nghiệm để giúp người mua khác lựa chọn tốt hơn</p>
                    </div>
                    <button onclick="closeReviewModal()" style="background:#f1f5f9;border:none;width:36px;height:36px;border-radius:50%;font-size:1.2rem;color:#64748b;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:1rem;">✕</button>
                </div>
            </div>
            <div id="review-items-container" style="padding:1.25rem 1.75rem 1.75rem;"></div>
        </div>
        <style>
            @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:none; } }
            .star-btn { font-size:2.2rem; cursor:pointer; color:#d1d5db; transition:color 0.15s, transform 0.15s; display:inline-block; line-height:1; }
            .star-btn:hover { color:#f59e0b; transform:scale(1.2); }
        </style>
    `;
    document.body.appendChild(modal);
}

function showReviewModal(order) {
    _reviewOrder = order;
    _reviewRatings = {};

    const container = document.getElementById('review-items-container');
    container.innerHTML = order.items.map(item => `
        <div style="border:1px solid #e2e8f0;border-radius:1rem;padding:1.25rem;margin-bottom:1rem;background:#fafafa;">
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                <img src="${item.productImageUrl || 'https://placehold.co/64'}"
                     style="width:64px;height:64px;border-radius:0.65rem;object-fit:cover;border:1px solid #e2e8f0;">
                <div>
                    <div style="font-weight:700;font-size:0.95rem;color:#1e293b;">${item.productName}</div>
                    <div style="font-size:0.8rem;color:#94a3b8;margin-top:2px;">Phân loại: ${item.variantName || 'Mặc định'} · x${item.quantity}</div>
                </div>
            </div>
            <div style="margin-bottom:0.85rem;">
                <div style="font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.5rem;">Chất lượng sản phẩm</div>
                <div style="display:flex;align-items:center;gap:0.35rem;">
                    ${[1,2,3,4,5].map(s => `
                        <span class="star-btn"
                            data-product="${item.productId}"
                            data-val="${s}"
                            onclick="setRating('${item.productId}', ${s})">★</span>
                    `).join('')}
                    <span id="rating-label-${item.productId}" style="margin-left:0.5rem;font-size:0.85rem;color:#94a3b8;font-weight:600;"></span>
                </div>
            </div>
            <textarea id="comment-${item.productId}"
                placeholder="Nhận xét về sản phẩm... (tuỳ chọn)"
                style="width:100%;padding:0.75rem;border:1px solid #e2e8f0;border-radius:0.6rem;font-family:inherit;font-size:0.9rem;resize:vertical;min-height:75px;outline:none;box-sizing:border-box;background:#fff;transition:border 0.2s;"
                onfocus="this.style.borderColor='#3b82f6'"
                onblur="this.style.borderColor='#e2e8f0'"></textarea>
        </div>
    `).join('') + `
        <div style="display:flex;gap:0.75rem;margin-top:0.25rem;">
            <button onclick="submitAllReviews()"
                style="flex:1;padding:0.9rem;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#fff;border:none;border-radius:0.75rem;font-weight:800;font-size:1rem;cursor:pointer;transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;gap:0.5rem;"
                onmouseenter="this.style.opacity='0.9'" onmouseleave="this.style.opacity='1'">
                <i class="fa-solid fa-star"></i> Gửi đánh giá
            </button>
            <button onclick="closeReviewModal()"
                style="padding:0.9rem 1.5rem;background:#f1f5f9;color:#64748b;border:none;border-radius:0.75rem;font-weight:600;cursor:pointer;font-size:0.95rem;">
                Bỏ qua
            </button>
        </div>
        <p style="text-align:center;font-size:0.8rem;color:#94a3b8;margin-top:0.75rem;">Bạn vẫn có thể đánh giá sau từ trang sản phẩm. Bắt buộc chọn số sao để gửi.</p>
    `;

    const modal = document.getElementById('review-modal');
    modal.style.display = 'flex';
}

const RATING_LABELS = { 1: 'Rất tệ', 2: 'Không hài lòng', 3: 'Bình thường', 4: 'Hài lòng', 5: 'Tuyệt vời!' };

function setRating(productId, val) {
    _reviewRatings[productId] = val;

    // Update stars visual
    document.querySelectorAll(`.star-btn[data-product="${productId}"]`).forEach(star => {
        const sv = parseInt(star.getAttribute('data-val'));
        star.style.color = sv <= val ? '#f59e0b' : '#d1d5db';
        star.style.transform = sv <= val ? 'scale(1.1)' : 'scale(1)';
    });

    // Update label
    const label = document.getElementById(`rating-label-${productId}`);
    if (label) {
        label.textContent = RATING_LABELS[val] || '';
        label.style.color = '#f59e0b';
    }
}

async function submitAllReviews() {
    if (!_reviewOrder) return;

    const items = _reviewOrder.items;
    const unrated = items.filter(i => !_reviewRatings[i.productId]);

    if (unrated.length === items.length) {
        window.common?.showToast('Vui lòng chọn ít nhất 1 sao cho 1 sản phẩm để gửi đánh giá.', 'error');
        return;
    }

    let submitted = 0;
    for (const item of items) {
        const rating = _reviewRatings[item.productId];
        if (!rating) continue;
        const comment = document.getElementById(`comment-${item.productId}`)?.value.trim() || '';
        try {
            await window.api.post(`marketplace/products/${item.productId}/reviews`, {
                rating,
                comment,
                imageUrls: []
            });
            submitted++;
        } catch (e) {
            // Already reviewed or other error — skip silently
            console.warn('Review submit skipped:', e.message);
        }
    }

    closeReviewModal();
    if (submitted > 0) {
        window.common?.showToast(`✅ Đã gửi ${submitted} đánh giá. Cảm ơn bạn!`, 'success');
    } else {
        window.common?.showToast('Sản phẩm đã được đánh giá trước đó.', 'warning');
    }
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'none';
}

// ========= REORDER =========
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
        window.common?.showToast('Đã thêm lại các sản phẩm vào giỏ hàng', 'success');
        setTimeout(() => { window.location.href = 'cart.html'; }, 800);
    } catch (e) {
        console.error('Lỗi khi mua lại: ', e);
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// ========= GLOBAL EXPORTS =========
window.applyBuyerSearch = applyBuyerSearch;
window.confirmOrder = confirmOrder;
window.reorder = reorder;
window.openReviewForOrder = openReviewForOrder;
window.setRating = setRating;
window.submitAllReviews = submitAllReviews;
window.closeReviewModal = closeReviewModal;
