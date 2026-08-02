/* js/marketplace.js */
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadCategories();
    loadProducts();
    updateCartBadge();
    initPremiumFeatures();
    initBannerSlider();
    // Promo zone
    loadPromoVouchers();
    loadFlashSaleInline();
    startFlashSaleCountdown2();
    loadUpcomingAuctions();

    const sharedProductId = new URLSearchParams(window.location.search).get('product');
    if (sharedProductId && /^[0-9a-f-]{36}$/i.test(sharedProductId)) {
        setTimeout(() => openProductModal(sharedProductId), 150);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !document.getElementById('product-modal')?.classList.contains('hidden')) {
            closeModal();
        }
    });
});

let _bannerIndex = 0;
let _bannerTimer = null;

async function initBannerSlider() {
    const slider = document.getElementById('banner-slider');
    const sideContainer = document.getElementById('side-banners-container');
    if (!slider) return;

    try {
        // Fetch banners from API
        const banners = await window.api.get('marketplace/banners').catch(() => []);
        
        if (banners.length === 0) {
            // Default banners if none from API
            const defaults = [
                { imageUrl: 'https://img.freepik.com/free-vector/horizontal-sale-banner-template_23-2148897328.jpg', isMain: true },
                { imageUrl: 'https://img.freepik.com/free-vector/flat-sale-banner-with-photo_23-2149026968.jpg', isMain: false },
                { imageUrl: 'https://img.freepik.com/free-vector/flat-sale-banner-with-photo_23-2149026969.jpg', isMain: false }
            ];
            renderBanners(defaults);
        } else {
            renderBanners(banners);
        }
    } catch (e) {
        console.error('Banner error', e);
    }
}

function renderBanners(banners) {
    const slider = document.getElementById('banner-slider');
    const sideContainer = document.getElementById('side-banners-container');
    
    const mains = banners.filter(b => b.isMain !== false);
    const sides = banners.filter(b => b.isMain === false);

    // Main slider
    slider.innerHTML = mains.map((b, idx) => {
        const isClickable = b.linkUrl && b.linkUrl.trim().length > 0;
        const clickAttr = isClickable ? `onclick="window.location.href='${b.linkUrl.trim()}'" style="cursor: pointer;"` : 'style="cursor: default;"';
        return `
            <div class="slide ${idx === 0 ? 'active' : ''}" ${clickAttr}>
                <img src="${b.imageUrl}" class="banner-img">
            </div>
        `;
    }).join('') + `
        <div class="banner-dots">
            ${mains.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})"></span>`).join('')}
        </div>
    `;

    // Dynamic layout adjustment
    const container = document.querySelector('.premium-banners');
    if (container) {
        if (sides.length === 0) {
            container.classList.add('full-width');
        } else {
            container.classList.remove('full-width');
        }
    }

    // Side banners
    if (sideContainer) {
        if (sides.length === 0) {
            sideContainer.style.display = 'none';
        } else {
            sideContainer.style.display = 'flex';
            sideContainer.innerHTML = sides.slice(0, 2).map(b => {
                const isClickable = b.linkUrl && b.linkUrl.trim().length > 0;
                const clickAttr = isClickable ? `onclick="window.location.href='${b.linkUrl.trim()}'" style="cursor: pointer;"` : 'style="cursor: default;"';
                return `
                    <div class="side-banner" ${clickAttr}>
                        <img src="${b.imageUrl}" class="banner-img">
                    </div>
                `;
            }).join('');
        }
    }

    startAutoSlide();
}

function startAutoSlide() {
    stopAutoSlide();
    const interval = (parseInt(localStorage.getItem('zynk_banner_interval')) || 5) * 1000;
    _bannerTimer = setInterval(nextSlide, interval);
}

function stopAutoSlide() {
    if (_bannerTimer) clearInterval(_bannerTimer);
}

function nextSlide() {
    const slides = document.querySelectorAll('.slide');
    if (slides.length <= 1) return;
    _bannerIndex = (_bannerIndex + 1) % slides.length;
    showSlide(_bannerIndex);
}

function goToSlide(idx) {
    _bannerIndex = idx;
    showSlide(idx);
    startAutoSlide();
}

function showSlide(idx) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    
    if (slides[idx]) slides[idx].classList.add('active');
    if (dots[idx]) dots[idx].classList.add('active');
}


function initPremiumFeatures() {
    startFlashSaleCountdown();
    loadFlashSaleProducts();
}

function startFlashSaleCountdown() {
    const hoursEl = document.getElementById('fs-hours');
    const minsEl = document.getElementById('fs-minutes');
    const secsEl = document.getElementById('fs-seconds');
    if (!hoursEl || !minsEl || !secsEl) return;

    // Set countdown to end in 2 hours 58 mins from now for demo
    let timeLeft = (2 * 3600) + (58 * 60) + 59;

    const timer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timer);
            return;
        }
        timeLeft--;

        const h = Math.floor(timeLeft / 3600);
        const m = Math.floor((timeLeft % 3600) / 60);
        const s = timeLeft % 60;

        hoursEl.textContent = h.toString().padStart(2, '0');
        minsEl.textContent = m.toString().padStart(2, '0');
        secsEl.textContent = s.toString().padStart(2, '0');
    }, 1000);
}

async function loadFlashSaleProducts() {
    const grid = document.getElementById('flash-sale-grid');
    if (!grid) return;

    try {
        // Fetch real products but treat them as flash sale for demo
        const products = await window.api.get('marketplace/products?sortBy=sales_desc');
        const flashSaleProds = products.slice(0, 6); // Take top 6

        grid.innerHTML = flashSaleProds.map(p => `
            <div class="product-card flash-sale-card" onclick="openProductModal('${p.id}')">
                <div class="discount-tag"><span>${Math.floor(Math.random() * 30) + 10}%</span><span>GIẢM</span></div>
                <div class="product-image-box">
                    <img src="${p.featuredImageUrl || 'https://via.placeholder.com/200'}" alt="${p.name}">
                </div>
                <div class="product-info">
                    <div class="product-price">${formatCurrency(p.price * 0.7)}</div>
                    <div class="price-original" style="font-size: 0.7rem; color: #94a3b8; text-decoration: line-through;">${formatCurrency(p.price)}</div>
                    <div class="sales-progress">
                        <div class="sales-progress-fill" style="width: ${Math.floor(Math.random() * 60) + 30}%"></div>
                        <div class="sales-progress-text">ĐANG BÁN CHẠY</div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load flash sale', e);
    }
}


let currentProducts = [];
let filterState = {
    categoryId: null,
    keyword: null,
    minPrice: null,
    maxPrice: null,
    sortBy: 'newest'
};

function safeCategoryIcon(icon) {
    const value = String(icon || '').trim();
    if (!value) return 'fa-solid fa-tag';
    if (value.startsWith('fa-') && !value.includes(' ')) return 'fa-solid ' + value;
    return value;
}

function escapeCategoryHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadCategories() {
    const grid = document.getElementById('category-circle-grid');
    if (!grid) return;

    try {
        const categories = await window.api.get('marketplace/categories');
        window._allCategories = categories; // Cache globally
        
        const roots = categories.filter(c => !c.parentCategoryId);
        
        grid.innerHTML = roots.map(cat => `
            <div class="category-circle-item" onclick="showSubCategories('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')">
                <div class="category-icon-wrapper"><i class="${safeCategoryIcon(cat.icon)}"></i></div>
                <span>${escapeCategoryHtml(cat.name)}</span>
            </div>
        `).join('');

    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

let _categoryStack = [];

function showSubCategories(parentId, parentName) {
    const panel = document.getElementById('sub-category-panel');
    const subGrid = document.getElementById('sub-cat-grid');
    const nameEl = document.getElementById('current-cat-name');
    
    if (!panel || !subGrid || !window._allCategories) return;

    // Load products for this category immediately
    filterByCategory(parentId, parentName, false);

    const subs = window._allCategories.filter(c => c.parentCategoryId && c.parentCategoryId.toLowerCase() === parentId.toLowerCase());
    
    nameEl.textContent = parentName;
    
    // Add to stack for "Back" button
    if (_categoryStack.length === 0 || _categoryStack[_categoryStack.length - 1].id !== parentId) {
        // Find current category to get its parent for the back button
        const currentCat = window._allCategories.find(c => c.id === parentId);
        _categoryStack.push({ id: parentId, name: parentName, parentId: currentCat?.parentCategoryId });
    }

    subGrid.innerHTML = `
        <div class="sub-cat-item all-item" onclick="filterByCategory('${parentId}', '${parentName.replace(/'/g, "\\'")}', true)">
            <div class="sub-cat-icon"><i class="fa-solid fa-layer-group"></i></div>
            <span class="sub-cat-name">Xem tất cả ${escapeCategoryHtml(parentName)}</span>
        </div>
    ` + subs.map(sub => {
        const iconClass = safeCategoryIcon(sub.icon);
        return `
        <div class="sub-cat-item" onclick="showSubCategories('${sub.id}', '${sub.name.replace(/'/g, "\\'")}')">
            <div class="sub-cat-icon"><i class="${iconClass}"></i></div>
            <span class="sub-cat-name">${escapeCategoryHtml(sub.name)}</span>
        </div>`;
    }).join('');

    panel.classList.remove('hidden');
}

function goBackCategory() {
    if (_categoryStack.length <= 1) {
        closeSubPanel();
        _categoryStack = [];
        return;
    }
    
    _categoryStack.pop(); // Remove current
    const prev = _categoryStack[_categoryStack.length - 1];
    
    // We need to re-render the parent's level
    // Actually, it's easier to just call showSubCategories again
    const target = prev;
    _categoryStack.pop(); // Remove it again so showSubCategories can re-add it correctly
    showSubCategories(target.id, target.name);
}

function closeSubPanel() {
    const panel = document.getElementById('sub-category-panel');
    if (panel) panel.classList.add('hidden');
    _categoryStack = [];
}

function filterByCategory(id, name, closePanel = true) {
    document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));
    filterState.categoryId = id;
    filterState.keyword = null;
    
    const titleEl = document.getElementById('market-title');
    if (titleEl) {
        titleEl.textContent = name;
        titleEl.removeAttribute('data-i18n');
    }
    
    if (closePanel) closeSubPanel();
    loadProducts();
    const targetEl = document.getElementById('market-title');
    if (targetEl) window.scrollTo({ top: targetEl.offsetTop - 100, behavior: 'smooth' });
}

// Sidebar render functions removed as sidebar is gone

async function loadProducts() {
    let grid;
    try {
        grid = document.getElementById('product-grid');
        if (!grid) return;

        grid.innerHTML = '<div class="skeleton" style="height: 300px; grid-column: span 1 / -1;"></div>'.repeat(4);
    } catch (err) {
        return;
    }

    try {
        let params = new URLSearchParams();
        if (filterState.categoryId) params.append('categoryId', filterState.categoryId);
        if (filterState.keyword) params.append('keyword', filterState.keyword);
        if (filterState.minPrice) params.append('minPrice', filterState.minPrice);
        if (filterState.maxPrice) params.append('maxPrice', filterState.maxPrice);
        if (filterState.sortBy) params.append('sortBy', filterState.sortBy);

        const url = `marketplace/products?${params.toString()}`;
        currentProducts = await window.api.get(url);
        renderProducts(currentProducts);
    } catch (e) {
        console.error('Failed to load products', e);
        const countEl = document.getElementById('market-result-count');
        if (countEl) countEl.textContent = 'Chưa thể cập nhật';
        if (grid) grid.innerHTML = `
            <div class="no-posts" style="grid-column:1/-1">
                <i class="fa-solid fa-cloud-arrow-down"></i>
                <strong>Chưa thể tải sản phẩm</strong>
                <p>Vui lòng kiểm tra kết nối và thử lại.</p>
                <button type="button" class="market-retry-btn" onclick="loadProducts()"><i class="fa-solid fa-rotate-right"></i> Thử lại</button>
            </div>`;
    }
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const countEl = document.getElementById('market-result-count');
    if (countEl) countEl.textContent = `${products?.length || 0} sản phẩm`;

    if (!products || products.length === 0) {
        grid.innerHTML = '<div class="no-posts" style="grid-column: 1/-1;"><i class="fa fa-box-open"></i><p>Chưa có sản phẩm nào trong mục này.</p></div>';
        return;
    }

    products.forEach((p, index) => {
        const isMall = index % 3 === 0; // Demo Mall badge
        const hasDiscount = index % 2 === 0; // Demo Discount tag
        const discountPct = Math.floor(Math.random() * 20) + 10;
        
        const card = document.createElement('div');
        card.className = 'product-card fadeInUp';
        card.innerHTML = `
            ${isMall ? '<div class="badge-mall">Mall</div>' : ''}
            ${hasDiscount ? `<div class="discount-tag"><span>${discountPct}%</span><span>GIẢM</span></div>` : ''}
            <div class="product-image-box">
                <img src="${p.featuredImageUrl || 'https://via.placeholder.com/300'}" alt="${p.name}">
            </div>
            <div class="product-info">
                <span class="product-shop"><i class="fa fa-shop"></i> ${p.shopName}</span>
                <h3 class="product-name">${p.name}</h3>
                <div class="product-meta">
                    <div>
                        <span class="product-price">${formatCurrency(p.price)}</span>
                        ${hasDiscount ? `<div class="price-original">${formatCurrency(p.price * 1.2)}</div>` : ''}
                    </div>
                    <span class="product-stats">${p.salesCount} đã bán</span>
                </div>
            </div>
        `;
        card.onclick = () => openProductModal(p.id);
        grid.appendChild(card);
    });
}

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function escapeProductText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeProductImageUrl(value) {
    const fallback = 'https://placehold.co/800x800/f4f5ff/6d5dfc?text=Zynk';
    if (!value) return fallback;
    try {
        const parsed = new URL(value, window.location.href);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : fallback;
    } catch {
        return fallback;
    }
}

function getProductAvailableStock(product = window._currentProduct) {
    if (!product) return 0;
    if (Array.isArray(product.variants) && product.variants.length > 0) {
        return product.variants.reduce((total, variant) => total + Math.max(0, Number(variant.stock) || 0), 0);
    }
    return Math.max(0, Number(product.stock) || 0);
}

async function openProductModal(productId) {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('product-modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #64748b;"><i class="fa fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem;">Đang tải sản phẩm...</p></div>';

    try {
        const p = await window.api.get(`marketplace/products/${productId}`);
        window._currentProduct = p; // Store globally for logic
        selAttr1 = null;
        selAttr2 = null;
        selectedVariantId = null;
        
        p.variants = Array.isArray(p.variants) ? p.variants : [];
        p.imageUrls = Array.isArray(p.imageUrls) ? p.imageUrls : [];
        p.stock = Math.max(0, Number(p.stock) || 0);
        p.rating = Math.max(0, Math.min(5, Number(p.rating) || 0));
        p.salesCount = Math.max(0, Number(p.salesCount) || 0);

        const hasVariants = p.variants.length > 0;
        
        // Define variant groups
        const group1 = p.variantGroupName1;
        const group2 = p.variantGroupName2;
        
        // Extract unique options for each group
        const options1 = [...new Set(p.variants.map(v => v.color).filter(v => !!v))];
        const options2 = [...new Set(p.variants.map(v => v.size).filter(v => !!v))];
        const galleryImages = [p.featuredImageUrl, ...p.imageUrls, ...p.variants.map(v => v.imageUrl)]
            .filter(Boolean)
            .filter((url, index, list) => list.indexOf(url) === index)
            .map(safeProductImageUrl);
        if (galleryImages.length === 0) galleryImages.push(safeProductImageUrl(null));

        const safeName = escapeProductText(p.name || 'Sản phẩm Zynk');
        const safeShopName = escapeProductText(p.shopName || 'Zynk Shop');
        const safeCategory = escapeProductText(p.categoryName || 'Sản phẩm');
        const totalStock = getProductAvailableStock(p);
        const stockLabel = totalStock <= 0 ? 'Tạm hết hàng' : (totalStock <= 5 ? `Chỉ còn ${totalStock}` : `Còn ${totalStock} sản phẩm`);
        const stockClass = totalStock <= 0 ? 'out' : (totalStock <= 5 ? 'low' : 'ready');
        const description = p.description
            ? window.common.autoLink(escapeProductText(p.description))
            : 'Shop chưa bổ sung mô tả chi tiết cho sản phẩm này.';

        content.innerHTML = `
            <div class="modal-product-layout">
                <div class="modal-product-images">
                    <div class="product-gallery-topline">
                        <span class="product-category-pill"><i class="fa-solid fa-layer-group"></i> ${safeCategory}</span>
                        <button class="product-icon-btn" type="button" onclick="shareCurrentProduct()" title="Chia sẻ sản phẩm" aria-label="Chia sẻ sản phẩm">
                            <i class="fa-solid fa-arrow-up-from-bracket"></i>
                        </button>
                    </div>
                    <div class="product-main-view" onclick="toggleProductImageZoom(this)" title="Nhấn để phóng to">
                        <img src="${galleryImages[0]}" id="main-product-img" alt="${safeName}">
                        <span class="product-zoom-hint"><i class="fa-solid fa-magnifying-glass-plus"></i> Phóng to</span>
                        <span class="product-gallery-count"><i class="fa-regular fa-images"></i> ${galleryImages.length}</span>
                    </div>
                    <div class="thumb-list">
                        ${galleryImages.map((url, index) => `
                            <button class="product-thumb ${index === 0 ? 'active' : ''}" type="button" onclick="selectThumb(this)" aria-label="Xem ảnh ${index + 1}">
                                <img src="${url}" alt="Ảnh ${index + 1} của ${safeName}">
                            </button>
                        `).join('')}
                    </div>
                    <div class="product-gallery-note">
                        <i class="fa-solid fa-shield-heart"></i>
                        <div><strong>Mua sắm an tâm</strong><span>Thanh toán bảo mật và theo dõi đơn hàng trên Zynk.</span></div>
                    </div>
                </div>
                <div class="modal-product-info">
                    <button class="close-modal" type="button" onclick="closeModal()" aria-label="Đóng chi tiết sản phẩm"><i class="fa fa-times"></i></button>
                    <div class="product-breadcrumb"><span>Marketplace</span><i class="fa-solid fa-chevron-right"></i><span>${safeCategory}</span></div>
                    <div class="product-shop-row">
                        <a href="profile.html?id=${p.shopOwnerId}" class="modal-shop-name"><span class="shop-avatar-mark"><i class="fa fa-shop"></i></span><span><small>Được bán bởi</small>${safeShopName}</span></a>
                        <button id="shop-follow-btn" class="btn-shop-follow" onclick="toggleShopFollow('${p.shopOwnerId}')">
                            <i class="fa fa-plus"></i> Theo dõi
                        </button>
                    </div>
                    <h2 class="modal-title">${safeName}</h2>
                    <div class="modal-rating" onclick="scrollToProductReviews()" role="button" tabindex="0">
                        <span class="rating-value">${p.rating.toFixed(1)}</span>
                        <div class="avg-stars">${renderStars(p.rating)}</div>
                        <span class="rating-divider"></span>
                        <span><strong>${p.salesCount}</strong> đã bán</span>
                        <span class="rating-review-link">Xem đánh giá <i class="fa-solid fa-chevron-down"></i></span>
                    </div>
                    <div class="product-price-panel">
                        <div><span class="price-eyebrow">Giá sản phẩm</span><div class="modal-price" id="display-price">${window.common.formatCurrency(p.price)}</div></div>
                        <span class="stock-status ${stockClass}" id="display-stock"><i class="fa-solid ${totalStock > 0 ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${stockLabel}</span>
                    </div>
                    
                    <div class="modal-scroll-area">
                        <div class="product-benefit-grid">
                            <div><i class="fa-solid fa-truck-fast"></i><span><strong>Giao hàng toàn quốc</strong><small>Theo dõi trạng thái trực tuyến</small></span></div>
                            <div><i class="fa-solid fa-rotate-left"></i><span><strong>Đổi trả theo chính sách</strong><small>Hỗ trợ ngay trong đơn hàng</small></span></div>
                            <div><i class="fa-solid fa-lock"></i><span><strong>Thanh toán an toàn</strong><small>Chỉ xác nhận khi giao dịch hợp lệ</small></span></div>
                        </div>

                        <div class="product-description-card">
                            <div class="section-heading"><span><i class="fa-regular fa-file-lines"></i> Mô tả sản phẩm</span></div>
                            <p class="modal-desc">${description}</p>
                        </div>
                        
                        ${group1 && options1.length > 0 ? `
                            <div class="variant-section">
                                <label>${escapeProductText(group1)} <span id="variant-selection-1"></span></label>
                                <div class="variant-options" id="variant-group-1">
                                    ${options1.map(val => `
                                        <button class="variant-btn" data-value="${escapeProductText(val)}" onclick="selectAttr(1, this.dataset.value, this)">${escapeProductText(val)}</button>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${group2 && options2.length > 0 ? `
                            <div class="variant-section">
                                <label>${escapeProductText(group2)} <span id="variant-selection-2"></span></label>
                                <div class="variant-options" id="variant-group-2">
                                    ${options2.map(val => `
                                        <button class="variant-btn" data-value="${escapeProductText(val)}" onclick="selectAttr(2, this.dataset.value, this)">${escapeProductText(val)}</button>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <div class="modal-action-row">
                            <div><label>Số lượng</label><span class="selection-help" id="purchase-selection-help">${hasVariants ? 'Chọn phân loại để tiếp tục' : 'Sẵn sàng đặt hàng'}</span></div>
                            <div class="qty-control">
                                <button type="button" onclick="changeQty(-1)" aria-label="Giảm số lượng"><i class="fa-solid fa-minus"></i></button>
                                <input type="number" id="buy-qty" value="1" min="1" max="${totalStock}" inputmode="numeric" onchange="normalizePurchaseQuantity()" oninput="updateProductSubtotal()">
                                <button type="button" onclick="changeQty(1)" aria-label="Tăng số lượng"><i class="fa-solid fa-plus"></i></button>
                            </div>
                        </div>
                    </div>

                    <!-- Shop Vouchers -->
                    <div id="shop-vouchers-container" class="product-voucher-zone"></div>

                    <div class="modal-purchase-footer">
                        <div class="purchase-total"><span>Tạm tính</span><strong id="display-subtotal">${window.common.formatCurrency(p.price)}</strong></div>
                        <div class="modal-btns">
                            <button class="btn secondary-btn" id="btn-add-cart" onclick="addCurrentProductToCart()" ${hasVariants || totalStock <= 0 ? 'disabled' : ''}>
                                <i class="fa fa-cart-plus"></i> <span>Thêm vào giỏ</span>
                            </button>
                            <button class="btn primary-btn" id="btn-buy-now" onclick="buyNow('${p.id}')" ${hasVariants || totalStock <= 0 ? 'disabled' : ''}><span>Mua ngay</span><i class="fa-solid fa-arrow-right"></i></button>
                        </div>
                    </div>

                    <button class="product-chat-btn" type="button" onclick="openCurrentShopChat()"><i class="fa-regular fa-comment-dots"></i><span><strong>Nhắn tin cho Shop</strong><small>Hỏi thêm về sản phẩm hoặc phân loại</small></span><i class="fa-solid fa-chevron-right"></i></button>

                    <section class="related-products-section" aria-labelledby="related-products-title">
                        <div class="section-heading">
                            <span id="related-products-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Có thể bạn cũng thích</span>
                            <small>Cùng danh mục, ưu tiên sản phẩm nổi bật</small>
                        </div>
                        <div id="related-products-list" class="related-product-track" aria-live="polite">
                            ${[1, 2, 3].map(() => '<div class="related-product-card related-skeleton"></div>').join('')}
                        </div>
                    </section>

                    <!-- Reviews Section -->
                    <div class="reviews-section" id="product-reviews-section">
                        <div class="section-heading"><span><i class="fa-solid fa-star"></i> Đánh giá từ người mua</span><small>Chỉ người đã nhận hàng mới được đánh giá</small></div>
                        <div id="review-stats-container"></div>
                        <div id="review-form-container"></div>
                        <div id="review-list"></div>
                    </div>
                </div>
            </div>
        `;

        // Pre-select if only one option
        if (options1.length === 1) {
            const btn = document.querySelector('#variant-group-1 .variant-btn');
            if (btn) selectAttr(1, options1[0], btn);
        }
        if (options2.length === 1) {
            const btn = document.querySelector('#variant-group-2 .variant-btn');
            if (btn) selectAttr(2, options2[0], btn);
        }

        refreshVariantOptionAvailability();
        if (!hasVariants) updateProductPurchaseState(totalStock, p.price);
        else updateVariantSelection();

        // Load extra data
        loadReviewStats(productId);
        loadReviews(productId);
        checkReviewEligibility(productId);
        checkShopFollowStatus(p.shopOwnerId);
        loadShopVouchers(p.shopOwnerId);
        loadRelatedProducts(productId);

    } catch (e) {
        console.error('Failed to load product details', e);
        content.innerHTML = '<div style="padding: 2rem; text-align: center;">Không thể tải chi tiết sản phẩm.</div>';
    }
}

let selAttr1 = null;
let selAttr2 = null;
let selectedVariantId = null;

function closeModal() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    selAttr1 = null;
    selAttr2 = null;
    selectedVariantId = null;
}

function handleModalOverlayClick(e) {
    if (e.target === document.getElementById('product-modal')) {
        closeModal();
    }
}

function changeQty(n) {
    const input = document.getElementById('buy-qty');
    if (!input) return;
    let val = (parseInt(input.value, 10) || 1) + n;
    if (val < 1) val = 1;
    const max = Math.max(0, parseInt(input.max, 10) || 0);
    if (max === 0) val = 1;
    else if (val > max) val = max;
    input.value = val;
    updateProductSubtotal();
}

function normalizePurchaseQuantity() {
    const input = document.getElementById('buy-qty');
    if (!input) return 1;
    const max = Math.max(0, parseInt(input.max, 10) || 0);
    let value = Math.max(1, parseInt(input.value, 10) || 1);
    if (max > 0) value = Math.min(max, value);
    input.value = value;
    updateProductSubtotal();
    return value;
}

function selectThumb(button) {
    const main = document.getElementById('main-product-img');
    const image = button?.querySelector('img') || button;
    if (main && image?.src) main.src = image.src;
    document.querySelectorAll('.product-thumb').forEach(item => item.classList.remove('active'));
    button?.classList.add('active');
    document.querySelector('.product-main-view')?.classList.remove('zoomed');
}

function toggleProductImageZoom(container) {
    container?.classList.toggle('zoomed');
}

async function shareCurrentProduct() {
    const product = window._currentProduct;
    if (!product) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    try {
        if (navigator.share) {
            await navigator.share({ title: product.name, text: `Xem ${product.name} trên Zynk Marketplace`, url: shareUrl });
        } else {
            await navigator.clipboard.writeText(shareUrl);
            window.common.showToast('Đã sao chép liên kết sản phẩm.', 'success');
        }
    } catch (error) {
        if (error?.name !== 'AbortError') window.common.showToast('Không thể chia sẻ sản phẩm lúc này.', 'error');
    }
}

function scrollToProductReviews() {
    document.getElementById('product-reviews-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openCurrentShopChat() {
    const product = window._currentProduct;
    if (product) openShopChat(product.shopId, product.shopName);
}

async function loadRelatedProducts(productId) {
    const container = document.getElementById('related-products-list');
    if (!container) return;

    try {
        const products = await window.api.get(`marketplace/products/${productId}/related?limit=8`);
        renderRelatedProducts(products, container);
    } catch (error) {
        console.warn('Related endpoint unavailable, using marketplace fallback', error);
        try {
            const current = window._currentProduct;
            const allProducts = await window.api.get('marketplace/products');
            const products = (Array.isArray(allProducts) ? allProducts : [])
                .filter(product => product.id !== productId)
                .sort((left, right) => {
                    const leftMatch = left.categoryName === current?.categoryName || left.shopId === current?.shopId ? 1 : 0;
                    const rightMatch = right.categoryName === current?.categoryName || right.shopId === current?.shopId ? 1 : 0;
                    return rightMatch - leftMatch || Number(right.rating || 0) - Number(left.rating || 0) || Number(right.salesCount || 0) - Number(left.salesCount || 0);
                })
                .slice(0, 8);
            renderRelatedProducts(products, container);
        } catch (fallbackError) {
            console.error('Failed to load related products', fallbackError);
            container.innerHTML = '<div class="related-products-empty"><span>Không thể tải gợi ý lúc này.</span></div>';
        }
    }
}

function renderRelatedProducts(products, container) {
    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = `
            <div class="related-products-empty">
                <i class="fa-regular fa-compass"></i>
                <span>Chưa có sản phẩm tương tự phù hợp.</span>
            </div>`;
        return;
    }

    container.innerHTML = products.map(product => {
            const safeName = escapeProductText(product.name || 'Sản phẩm Zynk');
            const safeShop = escapeProductText(product.shopName || 'Zynk Shop');
            const hasStockInfo = product.stock !== undefined && product.stock !== null;
            const stock = Math.max(0, Number(product.stock) || 0);
            const rating = Math.max(0, Math.min(5, Number(product.rating) || 0));
            return `
                <button class="related-product-card" type="button" onclick="openProductModal('${product.id}')" aria-label="Xem ${safeName}">
                    <span class="related-product-image">
                        <img src="${safeProductImageUrl(product.featuredImageUrl)}" alt="${safeName}" loading="lazy">
                        ${hasStockInfo && stock <= 0 ? '<span class="related-stock-badge">Hết hàng</span>' : ''}
                    </span>
                    <span class="related-product-content">
                        <small><i class="fa-solid fa-shop"></i> ${safeShop}</small>
                        <strong>${safeName}</strong>
                        <span class="related-product-meta"><span><i class="fa-solid fa-star"></i> ${rating.toFixed(1)}</span><span>${Math.max(0, Number(product.salesCount) || 0)} đã bán</span></span>
                        <b>${window.common.formatCurrency(product.price)}</b>
                    </span>
                </button>`;
    }).join('');
}

function selectAttr(group, val, btn) {
    if (btn.disabled) return;
    const parent = btn.parentElement;
    parent.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (group === 1) selAttr1 = val;
    else selAttr2 = val;

    const selection = document.getElementById(`variant-selection-${group}`);
    if (selection) selection.textContent = `· ${val}`;

    updateVariantSelection();
}

function refreshVariantOptionAvailability() {
    const product = window._currentProduct;
    if (!product?.variants?.length) return;

    document.querySelectorAll('#variant-group-1 .variant-btn').forEach(button => {
        const value = button.dataset.value;
        const available = product.variants.some(variant =>
            variant.color === value && (!selAttr2 || variant.size === selAttr2) && Number(variant.stock) > 0
        );
        button.disabled = !available;
        button.title = available ? '' : 'Phân loại này hiện đã hết hàng';
    });

    document.querySelectorAll('#variant-group-2 .variant-btn').forEach(button => {
        const value = button.dataset.value;
        const available = product.variants.some(variant =>
            variant.size === value && (!selAttr1 || variant.color === selAttr1) && Number(variant.stock) > 0
        );
        button.disabled = !available;
        button.title = available ? '' : 'Phân loại này hiện đã hết hàng';
    });
}

function updateProductPurchaseState(stock, unitPrice, message = '') {
    const safeStock = Math.max(0, Number(stock) || 0);
    const input = document.getElementById('buy-qty');
    const stockEl = document.getElementById('display-stock');
    const helpEl = document.getElementById('purchase-selection-help');
    const addButton = document.getElementById('btn-add-cart');
    const buyButton = document.getElementById('btn-buy-now');

    if (input) {
        input.max = safeStock;
        input.disabled = safeStock <= 0;
        if (safeStock > 0 && Number(input.value) > safeStock) input.value = safeStock;
    }

    if (stockEl) {
        const lowStock = safeStock > 0 && safeStock <= 5;
        stockEl.className = `stock-status ${safeStock <= 0 ? 'out' : (lowStock ? 'low' : 'ready')}`;
        stockEl.innerHTML = `<i class="fa-solid ${safeStock > 0 ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${safeStock <= 0 ? 'Tạm hết hàng' : (lowStock ? `Chỉ còn ${safeStock}` : `Còn ${safeStock} sản phẩm`)}`;
    }

    if (helpEl) helpEl.textContent = message || (safeStock > 0 ? 'Sẵn sàng đặt hàng' : 'Sản phẩm hiện đã hết hàng');
    if (addButton) addButton.disabled = safeStock <= 0 || Boolean(message);
    if (buyButton) buyButton.disabled = safeStock <= 0 || Boolean(message);

    window._currentUnitPrice = Math.max(0, Number(unitPrice) || 0);
    updateProductSubtotal();
}

function updateProductSubtotal() {
    const target = document.getElementById('display-subtotal');
    const quantity = Math.max(1, parseInt(document.getElementById('buy-qty')?.value, 10) || 1);
    if (target) target.textContent = window.common.formatCurrency((window._currentUnitPrice || 0) * quantity);
}

function updateVariantSelection() {
    const p = window._currentProduct;
    if (!p) return;

    refreshVariantOptionAvailability();

    const missingSelections = [];
    if (document.getElementById('variant-group-1') && !selAttr1) missingSelections.push(p.variantGroupName1);
    if (document.getElementById('variant-group-2') && !selAttr2) missingSelections.push(p.variantGroupName2);

    if (missingSelections.length > 0) {
        selectedVariantId = null;
        const totalStock = getProductAvailableStock(p);
        document.getElementById('display-price').textContent = window.common.formatCurrency(p.price);
        updateProductPurchaseState(totalStock, p.price, `Vui lòng chọn ${missingSelections.join(' và ')}`);
        return;
    }

    // Find the matching variant
    const variant = p.variants.find(v => {
        const match1 = !p.variantGroupName1 || v.color === selAttr1;
        const match2 = !p.variantGroupName2 || v.size === selAttr2;
        return match1 && match2;
    });

    if (variant) {
        selectedVariantId = variant.id;
        
        // Update Pricing
        const price = variant.priceOverride > 0 ? variant.priceOverride : p.price;
        document.getElementById('display-price').textContent = window.common.formatCurrency(price);
        
        // Update Stock
        updateProductPurchaseState(variant.stock, price);
        
        // Update Image if variant has one
        if (variant.imageUrl) {
            document.getElementById('main-product-img').src = safeProductImageUrl(variant.imageUrl);
        }
    } else {
        selectedVariantId = null;
        updateProductPurchaseState(0, p.price, 'Phân loại này hiện không khả dụng');
    }
}

async function loadReviewStats(id) {
    const container = document.getElementById('review-stats-container');
    if (!container) return;
    try {
        const stats = await window.api.get(`marketplace/products/${id}/review-stats`);
        const avg = stats.averageRating.toFixed(1);
        const total = stats.totalReviews;

        container.innerHTML = `
            <div class="review-summary-card">
                <div class="avg-rating-box">
                    <div class="avg-val">${avg}</div>
                    <div class="avg-stars">${renderStars(stats.averageRating)}</div>
                    <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 5px;">${total} đánh giá</div>
                </div>
                <div class="rating-bars">
                    ${[5, 4, 3, 2, 1].map(star => {
                        const count = stats.starCounts[star] || 0;
                        const pct = total > 0 ? (count / total * 100) : 0;
                        return `
                            <div class="rating-bar-row">
                                <span style="width: 40px;">${star} sao</span>
                                <div class="bar-track">
                                    <div class="bar-fill" style="width: ${pct}%"></div>
                                </div>
                                <span style="width: 30px; text-align: right;">${count}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Failed to load review stats', e);
        container.innerHTML = '';
    }
}

async function loadReviews(id) {
    const list = document.getElementById('review-list');
    if (!list) return;
    try {
        const reviews = await window.api.get(`marketplace/products/${id}/reviews`);
        if (reviews.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 2rem;">Chưa có đánh giá nào cho sản phẩm này.</div>';
            return;
        }
        list.innerHTML = reviews.map(r => `
            <div class="review-card">
                <div class="review-user">
                    <img src="${r.userAvatar || 'https://ui-avatars.com/api/?name=' + r.userName}" class="review-avatar">
                    <div class="review-info">
                        <div class="review-name">${r.userName}</div>
                        <div class="review-stars" style="color: #fbbf24; font-size: 0.8rem; margin: 3px 0;">${renderStars(r.rating)}</div>
                        <div class="review-date">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>
                </div>
                <div class="review-text">${r.comment || 'Khách hàng không để lại bình luận.'}</div>
                ${r.imageUrls && r.imageUrls.length > 0 ? `
                    <div class="review-images">
                        ${r.imageUrls.map(url => `<img src="${url}" onclick="window.open('${url}')">`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '';
    }
}

async function checkReviewEligibility(id) {
    const container = document.getElementById('review-form-container');
    if (!container) return;

    if (!localStorage.getItem('auth_token')) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: #94a3b8; font-size: 0.9rem; border: 1px dashed #e2e8f0; border-radius: 12px; margin-top: 1rem;">Đăng nhập để đánh giá sản phẩm.</div>';
        return;
    }

    try {
        const res = await window.api.get(`marketplace/products/${id}/check-review-eligibility`);
        if (res.eligible) {
            container.innerHTML = `
                <div class="review-form-trigger" id="review-trigger" style="text-align: center; background: #eff6ff; padding: 1.5rem; border-radius: 12px; border: 1px solid #dbeafe; margin-top: 1rem;">
                    <p style="font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">Bạn đã mua sản phẩm này?</p>
                    <button class="btn" onclick="showReviewForm('${id}')" style="background: #3b82f6; color: white; width: auto; padding: 0.5rem 1.5rem; border-radius: 8px; font-weight: 700;">
                        Viết đánh giá ngay
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = ''; // Not eligible or already reviewed
        }
    } catch (e) {
        container.innerHTML = '';
    }
}

function showReviewForm(id) {
    const trigger = document.getElementById('review-trigger');
    if (!trigger) return;

    trigger.innerHTML = `
        <div style="text-align: left; background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 1rem;">
            <h4 style="margin-bottom: 1rem; font-weight: 700;">Đánh giá của bạn</h4>
            <div style="margin-bottom: 1rem;">
                <label style="display:block; font-size: 0.85rem; font-weight: 700; margin-bottom: 5px;">Chọn số sao:</label>
                <div id="star-selector" style="font-size: 1.5rem; color: #fbbf24; cursor: pointer;">
                    ${[1, 2, 3, 4, 5].map(i => `<i class="fa-regular fa-star" data-val="${i}" onclick="setRating(${i})"></i>`).join('')}
                </div>
            </div>
            <textarea id="review-comment-input" placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..." style="width:100%; height:80px; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit; margin-bottom: 1rem;"></textarea>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.85rem; font-weight: 700; margin-bottom: 5px;">Hình ảnh (Dán link ảnh):</label>
                <input type="text" id="review-img-input" placeholder="https://..." style="width:100%; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
            </div>

            <button class="btn primary-btn" onclick="submitReview('${id}')">Gửi đánh giá</button>
            <button class="btn secondary-btn" onclick="checkReviewEligibility('${id}')">Hủy</button>
        </div>
    `;
}

let _currentRating = 0;
function setRating(val) {
    _currentRating = val;
    const stars = document.getElementById('star-selector').querySelectorAll('i');
    stars.forEach((s, idx) => {
        if (idx < val) {
            s.classList.remove('fa-regular');
            s.classList.add('fa-solid');
        } else {
            s.classList.remove('fa-solid');
            s.classList.add('fa-regular');
        }
    });
}

async function submitReview(productId) {
    if (_currentRating === 0) {
        alert('Vui lòng chọn số sao!');
        return;
    }
    const comment = document.getElementById('review-comment-input').value;
    const imgUrl = document.getElementById('review-img-input').value;

    try {
        const body = {
            rating: _currentRating,
            comment: comment,
            imageUrls: imgUrl ? [imgUrl] : []
        };
        await window.api.post(`marketplace/products/${productId}/reviews`, body);
        alert('Đã gửi đánh giá thành công!');
        openProductModal(productId); // Refresh
    } catch (e) {
        alert(e.message || 'Lỗi khi gửi đánh giá. Bạn cần nhận hàng thành công để đánh giá.');
    }
}

function renderStars(rating) {
    let html = '';
    const r = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
        html += i <= r ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    }
    return html;
}

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = count;
}

function addCurrentProductToCart(options = {}) {
    const product = window._currentProduct;
    if (!product) return false;
    return addToCart(product.id, product.name, options);
}

function addToCart(id, name, options = {}) {
    const product = window._currentProduct;
    const hasVariants = Boolean(product?.variants?.length);
    if (hasVariants && !selectedVariantId) {
        window.common.showToast('Vui lòng chọn đầy đủ phân loại sản phẩm.', 'info');
        document.querySelector('.variant-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    const qty = normalizePurchaseQuantity();
    const maxStock = Math.max(0, parseInt(document.getElementById('buy-qty')?.max, 10) || 0);
    if (maxStock <= 0) {
        window.common.showToast('Sản phẩm hoặc phân loại này đã hết hàng.', 'error');
        return false;
    }

    const price = Math.max(0, Number(window._currentUnitPrice) || 0);
    const img = document.getElementById('main-product-img').src;

    let cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
    const cartItemId = selectedVariantId ? `${id}-${selectedVariantId}` : id;
    const variantName = selectedVariantId
        ? [...document.querySelectorAll('.variant-btn.active')].map(button => button.textContent.trim()).join(' · ')
        : null;
    const shopName = product ? product.shopName : 'Shop Zynk';

    const existing = cart.find(i => i.cartItemId === cartItemId);
    if (existing) {
        const nextQuantity = existing.qty + qty;
        if (nextQuantity > maxStock) {
            existing.qty = maxStock;
            window.common.showToast(`Giỏ hàng đã được điều chỉnh theo tồn kho còn lại (${maxStock}).`, 'info');
        } else {
            existing.qty = nextQuantity;
        }
        existing.maxStock = maxStock;
        existing.price = price;
        existing.img = img;
        existing.image = img;
    } else {
        cart.push({ 
            id, 
            cartItemId, 
            variantId: selectedVariantId,
            variantName,
            shopName,
            name, 
            price: typeof price === 'number' ? price : parseInt(String(price).replace(/[^0-9]/g, '')) || 0,
            img, 
            image: img,  // alias for compatibility with AI chat and other modules
            qty,
            maxStock
        });
    }

    localStorage.setItem('zynk_cart', JSON.stringify(cart));
    updateCartBadge();
    document.getElementById('cart-float')?.classList.add('cart-bump');
    setTimeout(() => document.getElementById('cart-float')?.classList.remove('cart-bump'), 500);
    window.common.showToast(`Đã thêm ${qty} ${escapeProductText(name)} vào giỏ hàng.`, 'success');
    if (options.closeModal) closeModal();
    return true;
}

function buyNow(id) {
    const product = window._currentProduct;
    if (addToCart(id, product?.name || 'Sản phẩm')) {
        location.href = 'cart.html';
    }
}

// --- Search & Sort Logic ---
function setupSearch() {
    const searchInput = document.getElementById('market-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const suggestions = document.getElementById('search-suggestions');
    let searchTimeout = null;

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
            suggestions.classList.remove('active');
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (val.length >= 2) {
                showSuggestions(val);
            } else {
                suggestions.classList.remove('active');
            }
        }, 300);
    });

    // Hide suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#market-search-wrap')) {
            suggestions.classList.remove('active');
        }
    });

    // Handle enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            executeSearch();
        }
    });
}

function clearSearch() {
    const searchInput = document.getElementById('market-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const suggestions = document.getElementById('search-suggestions');
    
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    suggestions.classList.remove('active');
    
    filterState.keyword = null;
    document.getElementById('market-title').textContent = 'Gợi ý hôm nay';
    loadProducts(); 
}

async function showSuggestions(keyword) {
    const suggestions = document.getElementById('search-suggestions');
    try {
        const allProds = await window.api.get('marketplace/products');
        
        const kw = keyword.toLowerCase();
        const filtered = allProds.filter(p => 
            p.name.toLowerCase().includes(kw) || 
            (p.shopName && p.shopName.toLowerCase().includes(kw))
        );

        if (filtered.length === 0) {
            suggestions.innerHTML = '<div style="padding: 15px; color: #64748b; text-align: center;">Không tìm thấy kết quả</div>';
        } else {
            const top5 = filtered.slice(0, 5);
            suggestions.innerHTML = top5.map(p => `
                <div class="suggestion-item" onclick="selectSuggestion('${p.id}')">
                    <img src="${p.featuredImageUrl || 'https://via.placeholder.com/40'}" alt="${p.name}">
                    <div class="suggestion-info">
                        <span class="suggestion-title">${p.name.length > 60 ? p.name.substring(0,60)+'...' : p.name}</span>
                        <span class="suggestion-price">${window.common.formatCurrency ? window.common.formatCurrency(p.price) : formatCurrency(p.price)}</span>
                    </div>
                </div>
            `).join('');
            
            if (filtered.length > 5) {
                suggestions.innerHTML += `
                    <div class="suggestion-item" style="justify-content: center; color: #3b82f6; font-weight: 600;" onclick="executeSearch('${keyword}')">
                        Xem tất cả ${filtered.length} kết quả
                    </div>
                `;
            }
        }
        suggestions.classList.add('active');
    } catch (e) {
        console.error('Failed to load suggestions:', e);
    }
}

function selectSuggestion(productId) {
    document.getElementById('search-suggestions').classList.remove('active');
    openProductModal(productId);
}

function executeSearch(kw = null) {
    const searchInput = document.getElementById('market-search-input');
    const keyword = kw || searchInput.value.trim();
    if (!keyword) return;

    searchInput.value = keyword;
    document.getElementById('search-clear-btn').classList.remove('hidden');
    document.getElementById('search-suggestions').classList.remove('active');
    
    // Save to search history in localStorage for AI recommendations
    try {
        let history = JSON.parse(localStorage.getItem('zynk_search_history') || '[]');
        history = history.filter(h => h.toLowerCase() !== keyword.toLowerCase());
        history.unshift(keyword);
        localStorage.setItem('zynk_search_history', JSON.stringify(history.slice(0, 10)));
    } catch(e) {
        console.error(e);
    }

    // De-activate categories
    document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));

    filterState.keyword = keyword;
    filterState.categoryId = null; // Clear category when searching globally
    loadProducts();
    document.getElementById('market-title').textContent = `Kết quả tìm kiếm cho "${keyword}"`;
}

// Function removed, logic moved to loadProducts


function searchByTag(tag) {
    executeSearch(tag);
}

function handleSort() {
    const val = document.getElementById('sort-filter').value;
    filterState.sortBy = val;
    loadProducts();
}

function applyFilters() {
    const min = document.getElementById('min-price').value;
    const max = document.getElementById('max-price').value;
    filterState.minPrice = min ? parseFloat(min) : null;
    filterState.maxPrice = max ? parseFloat(max) : null;
    loadProducts();
}

async function toggleShopFollow(userId) {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }
    const btn = document.getElementById('shop-follow-btn');
    if (!btn) return;

    try {
        btn.disabled = true;
        const res = await window.api.post(`users/${userId}/follow`);
        updateShopFollowButton(res.isFollowing);
        if (window.common?.showToast) {
            window.common.showToast(res.isFollowing ? 'Đã theo dõi shop!' : 'Đã bỏ theo dõi shop.', 'success');
        } else {
            alert(res.isFollowing ? 'Đã theo dõi shop!' : 'Đã bỏ theo dõi shop.');
        }
    } catch (e) {
        console.error('Follow failed', e);
    } finally {
        btn.disabled = false;
    }
}

function updateShopFollowButton(isFollowing) {
    const btn = document.getElementById('shop-follow-btn');
    if (!btn) return;
    if (isFollowing) {
        btn.innerHTML = '<i class="fa fa-check"></i> Đang theo dõi';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '<i class="fa fa-plus"></i> Theo dõi';
        btn.classList.remove('active');
    }
}

async function checkShopFollowStatus(userId) {
    if (!localStorage.getItem('auth_token')) return;
    try {
        const profile = await window.api.get(`users/${userId}/profile`);
        updateShopFollowButton(profile.isFollowing);
    } catch (e) {
        console.error('Failed to check follow status', e);
    }
}

async function loadShopVouchers(shopOwnerId) {
    const container = document.getElementById('shop-vouchers-container');
    if (!container) return;
    try {
        const vouchers = await window.api.get(`marketplace/shops/${shopOwnerId}/vouchers`);
        if (vouchers.length === 0) return;
        
        container.innerHTML = `
            <label style="font-weight: 700; color: #64748b; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px; display: block;">Ưu đãi của Shop</label>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;">
                ${vouchers.map(v => `
                    <div style="background: #fff5f5; border: 1px dashed #feb2b2; padding: 4px 10px; border-radius: 6px; white-space: nowrap;">
                        <span style="color: #e53e3e; font-weight: 800; font-size: 0.85rem;">${v.code}</span>
                        <div style="font-size: 0.7rem; color: #718096;">Giảm ${v.discountType === 'Percentage' ? v.discountValue + '%' : formatCurrency(v.discountValue)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {}
}

async function openShopChat(shopId, shopName) {
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }
    // Redirect to separate shop messages page
    window.location.href = `shop-messages.html?shopId=${shopId}&shopName=${encodeURIComponent(shopName)}`;
}

window.openShopChat = openShopChat;

// ═══════════════════════════════════════════
// PROMOTIONS & EVENTS ZONE
// ═══════════════════════════════════════════

function switchPromoTab(tabName) {
    // Tabs
    document.querySelectorAll('.promo-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.promo-tab[data-tab="${tabName}"]`)?.classList.add('active');
    // Content
    document.querySelectorAll('.promo-tab-content').forEach(c => c.classList.remove('active'));
    const content = document.getElementById(`tab-${tabName}`);
    if (content) {
        content.classList.remove('active');
        // Force reflow for animation
        void content.offsetWidth;
        content.classList.add('active');
    }
}
window.switchPromoTab = switchPromoTab;

// ── Voucher Loading (max 3 preview) ──
async function loadPromoVouchers() {
    const carousel = document.getElementById('voucher-carousel');
    if (!carousel) return;

    try {
        const response = await window.api.get('marketplace/vouchers');
        const { vouchers, claimedIds } = response;

        if (!vouchers || vouchers.length === 0) {
            carousel.innerHTML = `
                <div class="voucher-empty-state">
                    <i class="fa-solid fa-ticket-simple"></i>
                    <h4>Hiện chưa có mã giảm giá nào</h4>
                    <p>Quay lại sau để săn voucher hot nhé!</p>
                </div>
            `;
            return;
        }

        const gradients = ['gradient-orange', 'gradient-blue', 'gradient-purple', 'gradient-green'];
        const previewVouchers = vouchers.slice(0, 3); // Only show 3 in marketplace

        let html = previewVouchers.map((v, idx) => {
            const isClaimed = claimedIds && claimedIds.includes(v.id);
            const usagePercent = v.usageLimit > 0 ? Math.min((v.usedCount / v.usageLimit) * 100, 100) : 0;
            const gradient = gradients[idx % gradients.length];
            const discountDisplay = v.discountType === 'Percentage' 
                ? `<span class="voucher-discount-val">${v.discountValue}%</span><span class="voucher-discount-label">Giảm</span>`
                : `<span class="voucher-discount-val">${formatShortCurrency(v.discountValue)}</span><span class="voucher-discount-label">Giảm</span>`;
            const desc = v.description || `Giảm ${v.discountValue}${v.discountType === 'Percentage' ? '%' : 'đ'} cho đơn từ ${formatShortCurrency(v.minOrderValue || 0)}`;

            return `
                <div class="voucher-ticket">
                    <div class="voucher-ticket-left ${gradient}">
                        ${discountDisplay}
                    </div>
                    <div class="voucher-ticket-right">
                        <div>
                            <div class="voucher-ticket-code">${v.code}</div>
                            <div class="voucher-ticket-desc">${desc}</div>
                        </div>
                        <div>
                            <div class="voucher-progress-mini">
                                <div class="voucher-progress-bar">
                                    <div class="voucher-progress-fill" style="width: ${usagePercent}%"></div>
                                </div>
                                <span class="voucher-usage-text">Đã dùng ${Math.round(usagePercent)}%</span>
                            </div>
                            <div class="voucher-ticket-footer">
                                <span class="voucher-expiry">HSD: ${new Date(v.endDate).toLocaleDateString('vi-VN')}</span>
                                <button class="btn-claim-mini ${isClaimed ? 'claimed' : 'claim'}" 
                                        id="promo-btn-${v.id}"
                                        onclick="${isClaimed ? '' : `claimPromoVoucher('${v.id}')`}">
                                    ${isClaimed ? '<i class="fa-solid fa-check"></i> Đã lưu' : '<i class="fa-solid fa-plus"></i> Lưu mã'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add "Xem thêm" button if there are more vouchers
        if (vouchers.length > 3) {
            html += `
                <a href="vouchers.html" class="voucher-see-more-card">
                    <div class="see-more-inner">
                        <i class="fa-solid fa-ticket"></i>
                        <span>Xem thêm ${vouchers.length - 3} mã</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </div>
                </a>
            `;
        } else if (vouchers.length > 0) {
            html += `
                <a href="vouchers.html" class="voucher-see-more-card">
                    <div class="see-more-inner">
                        <i class="fa-solid fa-ticket"></i>
                        <span>Xem tất cả voucher</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </div>
                </a>
            `;
        }

        carousel.innerHTML = html;

    } catch (e) {
        console.error('Failed to load promo vouchers', e);
        carousel.innerHTML = `
            <div class="voucher-empty-state">
                <i class="fa-solid fa-circle-exclamation"></i>
                <h4>Không thể tải voucher</h4>
                <p>Vui lòng thử lại sau.</p>
            </div>
        `;
    }
}

async function claimPromoVoucher(id) {
    const btn = document.getElementById(`promo-btn-${id}`);
    if (!btn || btn.classList.contains('claimed')) return;

    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'auth.html';
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        await window.api.post(`marketplace/vouchers/${id}/claim`);
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
        btn.classList.remove('claim');
        btn.classList.add('claimed');
        btn.onclick = null;
        
        // Show success notification
        if (window.showNotification) {
            showNotification('Thành công', 'Đã lưu mã giảm giá vào kho của bạn!');
        }
    } catch (err) {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Lưu mã';
        btn.disabled = false;
        alert(err.message || 'Không thể lưu mã giảm giá.');
    }
}
window.claimPromoVoucher = claimPromoVoucher;

function formatShortCurrency(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v + 'đ';
}

// ── Flash Sale Inline ──
async function loadFlashSaleInline() {
    const container = document.getElementById('flash-products-scroll');
    if (!container) return;

    try {
        const products = await window.api.get('marketplace/products?sortBy=sales_desc');
        const flashProds = products.slice(0, 8);

        container.innerHTML = flashProds.map(p => {
            const discountPct = Math.floor(Math.random() * 30) + 15;
            const salePrice = Math.round(p.price * (1 - discountPct / 100));
            const soldPct = Math.floor(Math.random() * 60) + 30;

            return `
                <div class="flash-mini-card" onclick="openProductModal('${p.id}')">
                    <img src="${p.featuredImageUrl || 'https://via.placeholder.com/160'}" alt="${p.name}">
                    <div class="flash-mini-info">
                        <div class="flash-mini-price">${formatCurrency(salePrice)}</div>
                        <div class="flash-mini-original">${formatCurrency(p.price)}</div>
                        <div class="flash-mini-sold">
                            <div class="flash-mini-sold-fill" style="width: ${soldPct}%"></div>
                            <div class="flash-mini-sold-text">Đã bán ${soldPct}%</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Failed to load flash sale inline', e);
    }
}

function startFlashSaleCountdown2() {
    const hoursEl = document.getElementById('fs2-hours');
    const minsEl = document.getElementById('fs2-minutes');
    const secsEl = document.getElementById('fs2-seconds');
    if (!hoursEl || !minsEl || !secsEl) return;

    let timeLeft = (2 * 3600) + (58 * 60) + 59;

    setInterval(() => {
        if (timeLeft <= 0) return;
        timeLeft--;
        const h = Math.floor(timeLeft / 3600);
        const m = Math.floor((timeLeft % 3600) / 60);
        const s = timeLeft % 60;
        hoursEl.textContent = h.toString().padStart(2, '0');
        minsEl.textContent = m.toString().padStart(2, '0');
        secsEl.textContent = s.toString().padStart(2, '0');
    }, 1000);
}

// ── Upcoming Auctions (Marketplace Banner) ──
async function loadUpcomingAuctions() {
    const container = document.getElementById('auction-grid');
    if (!container) return;

    try {
        const auctions = await window.api.get('auctions/upcoming');
        if (!auctions || auctions.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; color: #64748b; font-style: italic;">
                    Hiện chưa có phiên đấu giá nào sắp diễn ra.
                </div>
            `;
            return;
        }

        container.innerHTML = auctions.map(a => `
            <div class="product-card" style="min-width:280px;" onclick="window.location.href='auctions.html'">
                <div class="product-img-wrapper">
                    <img src="${a.imageUrls && a.imageUrls.length > 0 ? a.imageUrls[0] : 'https://via.placeholder.com/300'}" class="product-img" style="object-fit:cover; height: 220px;">
                    <div class="discount-badge">LIVE</div>
                </div>
                <div class="product-info">
                    <h3 class="product-name" style="height: 40px; overflow: hidden; text-overflow: ellipsis;">${a.name}</h3>
                    <div class="price-container">
                        <span style="font-size: 0.9rem; color: #666;">Giá khởi điểm:</span>
                        <span class="product-price" style="color: #ff3b30; font-size: 1.1rem;">${new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'}).format(a.startingPrice)}</span>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.85rem; color: #64748b;">
                        <i class="fa-regular fa-clock"></i> Bắt đầu: ${new Date(a.startTime).toLocaleString('vi-VN')}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load upcoming auctions:', e);
        container.innerHTML = `
            <div style="padding: 20px; color: #ef4444;">
                Không thể kết nối đến máy chủ. Vui lòng thử lại.
            </div>
        `;
    }
}

