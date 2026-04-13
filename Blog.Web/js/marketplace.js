/* js/marketplace.js */
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadProducts();
    updateCartBadge();
});

let currentProducts = [];

async function loadCategories() {
    const list = document.getElementById('category-list');
    try {
        const categories = await window.api.get('marketplace/categories');
        categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'category-item';
            li.innerHTML = `
                <a href="#" class="category-link" data-id="${cat.id}">
                    <i class="${cat.icon || 'fa fa-tag'}"></i> ${cat.name}
                </a>
            `;
            li.querySelector('a').onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
                loadProducts(cat.id);
            };
            list.appendChild(li);
        });
    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

async function loadProducts(categoryId = null) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '<div class="skeleton" style="height: 300px;"></div>'.repeat(4);
    
    try {
        const url = categoryId ? `marketplace/products?categoryId=${categoryId}` : 'marketplace/products';
        currentProducts = await window.api.get(url);
        renderProducts(currentProducts);
    } catch (e) {
        grid.innerHTML = '<div class="no-posts">Lỗi khi tải sản phẩm. Vui lòng thử lại.</div>';
    }
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<div class="no-posts"><i class="fa fa-box-open"></i><p>Chưa có sản phẩm nào trong mục này.</p></div>';
        return;
    }

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card fadeInUp';
        card.innerHTML = `
            <div class="product-image-box">
                <img src="${p.featuredImageUrl || 'https://via.placeholder.com/300'}" alt="${p.name}">
            </div>
            <div class="product-info">
                <span class="product-shop"><i class="fa fa-shop"></i> ${p.shopName}</span>
                <h3 class="product-name">${p.name}</h3>
                <div class="product-meta">
                    <span class="product-price">${formatCurrency(p.price)}</span>
                    <span class="product-stats">${p.salesCount} đã bán</span>
                </div>
            </div>
        `;
        card.onclick = () => openProductModal(p.id);
        grid.appendChild(card);
    });
}

async function openProductModal(productId) {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('product-modal-content');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    content.innerHTML = '<div style="padding: 2rem; text-align: center;"><i class="fa fa-spinner fa-spin"></i> Đang tải...</div>';

    try {
        const p = await window.api.get(`marketplace/products/${productId}`);
        content.innerHTML = `
            <div class="modal-product-layout">
                <div class="modal-product-images">
                    <img src="${p.featuredImageUrl || 'https://via.placeholder.com/400'}" id="main-product-img">
                    <div class="thumb-list">
                        ${p.imageUrls.map(url => `<img src="${url}" onclick="document.getElementById('main-product-img').src='${url}'">`).join('')}
                    </div>
                </div>
                <div class="modal-product-info">
                    <span class="close-modal" onclick="closeModal()"><i class="fa fa-times"></i></span>
                    <span class="modal-shop-name"><i class="fa fa-shop"></i> ${p.shopName}</span>
                    <h2>${p.name}</h2>
                    <div class="modal-rating">
                        <i class="fa fa-star" style="color: #fbbf24;"></i> ${p.rating} | ${p.salesCount} đã bán
                    </div>
                    <div class="modal-price">${formatCurrency(p.price)}</div>
                    <p class="modal-desc">${p.description}</p>
                    
                    <div class="modal-action-row">
                        <div class="qty-control">
                            <button onclick="changeQty(-1)">-</button>
                            <input type="number" id="buy-qty" value="1" min="1" max="${p.stock}">
                            <button onclick="changeQty(1)">+</button>
                        </div>
                        <span style="font-size: 0.8rem; color: #64748b;">Kho: ${p.stock}</span>
                    </div>

                    <div class="modal-btns">
                        <button class="btn secondary-btn" onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.featuredImageUrl}')">
                            <i class="fa fa-cart-plus"></i> Thêm vào giỏ
                        </button>
                        <button class="btn primary-btn" onclick="buyNow('${p.id}')">Mua ngay</button>
                    </div>
                </div>
            </div>
        `;

        // Style for modal internal layout (can be in CSS too)
        const style = document.createElement('style');
        style.innerHTML = `
            .modal-product-layout { display: flex; gap: 0; min-height: 500px; }
            .modal-product-images { flex: 1; background: #f1f5f9; padding: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .modal-product-images img#main-product-img { max-width: 100%; max-height: 400px; border-radius: 1rem; object-fit: contain; }
            .thumb-list { display: flex; gap: 10px; margin-top: 1rem; overflow-x: auto; width: 100%; padding-bottom: 5px; }
            .thumb-list img { width: 60px; height: 60px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; }
            .thumb-list img:hover { border-color: #3b82f6; }
            .modal-product-info { flex: 1; padding: 2.5rem; position: relative; display: flex; flex-direction: column; }
            .close-modal { position: absolute; top: 1rem; right: 1.5rem; cursor: pointer; font-size: 1.5rem; color: #64748b; }
            .modal-shop-name { color: #3b82f6; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; }
            .modal-product-info h2 { font-size: 1.8rem; margin-bottom: 1rem; }
            .modal-price { font-size: 2rem; font-weight: 800; color: #2563eb; margin: 1.5rem 0; }
            .modal-desc { color: #475569; line-height: 1.6; margin-bottom: 2rem; flex: 1; }
            .modal-action-row { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; }
            .qty-control { display: flex; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .qty-control button { border: none; background: #f8fafc; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; }
            .qty-control input { width: 50px; text-align: center; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-top: none; border-bottom: none; }
            .modal-btns { display: flex; gap: 1rem; }
            .modal-btns button { flex: 1; margin: 0; }
        `;
        document.head.appendChild(style);

    } catch (e) {
        content.innerHTML = '<div style="padding: 2rem; text-align: center;">Không thể tải chi tiết sản phẩm.</div>';
    }
}

function changeQty(amt) {
    const input = document.getElementById('buy-qty');
    let val = parseInt(input.value) + amt;
    if (val < 1) val = 1;
    if (val > parseInt(input.max)) val = input.max;
    input.value = val;
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Cart Logic
function addToCart(id, name, price, img) {
    const qty = parseInt(document.getElementById('buy-qty').value);
    let cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
    
    const existing = cart.find(i => i.id === id);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ id, name, price, img, qty });
    }
    
    localStorage.setItem('zynk_cart', JSON.stringify(cart));
    updateCartBadge();
    alert(`Đã thêm ${qty} sản phẩm vào giỏ hàng!`);
    closeModal();
}

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    document.getElementById('cart-count').textContent = count;
}

function buyNow(id) {
    // For now, redirect to cart or handle direct checkout
    alert('Tính năng mua ngay đang được chuyển hướng đến giỏ hàng.');
    location.href = 'cart.html';
}
