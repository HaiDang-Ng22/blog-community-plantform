/* js/marketplace.js */
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadCategories();
    loadProducts();
    updateCartBadge();
});

let currentProducts = [];

async function loadCategories() {
    const list = document.getElementById('category-list');
    if (!list) return;

    try {
        const categories = await window.api.get('marketplace/categories');

        // Build hierarchy
        const rootCategories = categories.filter(c => !c.parentCategoryId);

        // Add "All" option
        list.innerHTML = `
            <li class="category-item">
                <a href="#" class="category-link active" data-id="all">
                    <i class="fa fa-border-all"></i> Tất cả
                </a>
            </li>
        `;

        rootCategories.forEach(cat => {
            renderCategoryItem(cat, categories, list);
        });

        // Initialize "All" click
        const allLink = list.querySelector('[data-id="all"]');
        if (allLink) {
            allLink.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));
                allLink.classList.add('active');
                loadProducts();
                document.getElementById('market-title').textContent = 'Gợi ý hôm nay';
            };
        }

    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

function renderCategoryItem(cat, allCategories, container, level = 0) {
    const subCategories = allCategories.filter(c => c.parentCategoryId === cat.id);
    const li = document.createElement('li');
    li.className = `category-item ${subCategories.length > 0 ? 'has-sub' : ''}`;

    li.innerHTML = `
        <div class="category-row">
            <a href="#" class="category-link" data-id="${cat.id}">
                <i class="${cat.icon || 'fa fa-tag'}"></i> ${cat.name}
            </a>
            ${subCategories.length > 0 ? '<i class="fa fa-chevron-down sub-toggle"></i>' : ''}
        </div>
        ${subCategories.length > 0 ? `<ul class="sub-category-list hidden" id="sub-${cat.id}"></ul>` : ''}
    `;

    const link = li.querySelector('.category-link');
    link.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        loadProducts(cat.id);
        document.getElementById('market-title').textContent = cat.name;
    };

    if (subCategories.length > 0) {
        const toggle = li.querySelector('.sub-toggle');
        const subList = li.querySelector('.sub-category-list');
        toggle.onclick = (e) => {
            e.stopPropagation();
            subList.classList.toggle('hidden');
            toggle.classList.toggle('rotated');
        };

        subCategories.forEach(sub => {
            renderCategoryItem(sub, allCategories, subList, level + 1);
        });
    }

    container.appendChild(li);
}

async function loadProducts(categoryId = null) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="skeleton" style="height: 300px; grid-column: span 1 / -1;"></div>'.repeat(4);

    try {
        const url = categoryId ? `marketplace/products?categoryId=${categoryId}` : 'marketplace/products';
        currentProducts = await window.api.get(url);
        renderProducts(currentProducts);
    } catch (e) {
        console.error('Failed to load products', e);
        grid.innerHTML = '<div class="no-posts">Lỗi khi tải sản phẩm. Vui lòng thử lại.</div>';
    }
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!products || products.length === 0) {
        grid.innerHTML = '<div class="no-posts" style="grid-column: 1/-1;"><i class="fa fa-box-open"></i><p>Chưa có sản phẩm nào trong mục này.</p></div>';
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

function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

async function openProductModal(productId) {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('product-modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<div style="padding: 2rem; text-align: center;"><i class="fa fa-spinner fa-spin"></i> Đang tải chi tiết sản phẩm...</div>';

    try {
        const p = await window.api.get(`marketplace/products/${productId}`);
        window._currentProduct = p; // Store globally for logic
        
        const hasVariants = p.variants && p.variants.length > 0;
        
        // Define variant groups
        const group1 = p.variantGroupName1;
        const group2 = p.variantGroupName2;
        
        // Extract unique options for each group
        const options1 = [...new Set(p.variants.map(v => v.color).filter(v => !!v))];
        const options2 = [...new Set(p.variants.map(v => v.size).filter(v => !!v))];

        content.innerHTML = `
            <div class="modal-product-layout">
                <div class="modal-product-images">
                    <div class="product-main-view">
                        <img src="${p.featuredImageUrl || 'https://via.placeholder.com/400'}" id="main-product-img">
                    </div>
                    <div class="thumb-list">
                        <img src="${p.featuredImageUrl}" class="active" onclick="selectThumb(this)">
                        ${p.imageUrls.filter(u => u !== p.featuredImageUrl).map(url => `
                            <img src="${url}" onclick="selectThumb(this)">
                        `).join('')}
                    </div>
                </div>
                <div class="modal-product-info">
                    <span class="close-modal" onclick="closeModal()"><i class="fa fa-times"></i></span>
                    <a href="#" class="modal-shop-name"><i class="fa fa-shop"></i> ${p.shopName}</a>
                    <h2 class="modal-title">${p.name}</h2>
                    <div class="modal-rating">
                        <span style="color: #fbbf24; font-weight: 700;">${p.rating.toFixed(1)}</span>
                        <div class="avg-stars" style="display: inline-block; font-size: 0.85rem;">${renderStars(p.rating)}</div>
                        <span style="color: #94a3b8; margin-left: 10px;">| ${p.salesCount} đã bán</span>
                    </div>
                    <div class="modal-price" id="display-price">${window.common.formatCurrency(p.price)}</div>
                    
                    <div class="modal-scroll-area">
                        <p class="modal-desc" style="white-space: pre-wrap; margin-bottom: 2rem;">${p.description}</p>
                        
                        ${group1 && options1.length > 0 ? `
                            <div class="variant-section">
                                <label>${group1}</label>
                                <div class="variant-options" id="variant-group-1">
                                    ${options1.map(val => `
                                        <button class="variant-btn" onclick="selectAttr(1, '${val}', this)">${val}</button>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${group2 && options2.length > 0 ? `
                            <div class="variant-section">
                                <label>${group2}</label>
                                <div class="variant-options" id="variant-group-2">
                                    ${options2.map(val => `
                                        <button class="variant-btn" onclick="selectAttr(2, '${val}', this)">${val}</button>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <div class="modal-action-row">
                            <label style="font-weight: 700; color: #64748b; font-size: 0.85rem; text-transform: uppercase;">Số lượng</label>
                            <div class="qty-control">
                                <button onclick="changeQty(-1)">-</button>
                                <input type="number" id="buy-qty" value="1" min="1" max="${p.stock}">
                                <button onclick="changeQty(1)">+</button>
                            </div>
                            <span class="stock-info" id="display-stock" style="color: #94a3b8; font-size: 0.9rem;">Còn ${p.stock} sản phẩm</span>
                        </div>
                    </div>

                    <div class="modal-btns">
                        <button class="btn secondary-btn" id="btn-add-cart" onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
                            <i class="fa fa-cart-plus"></i> Thêm vào giỏ
                        </button>
                        <button class="btn primary-btn" id="btn-buy-now" onclick="buyNow('${p.id}')">Mua ngay</button>
                    </div>

                    <!-- Reviews Section -->
                    <div class="reviews-section">
                        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem;">ĐÁNH GIÁ SẢN PHẨM</h3>
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

        // Load reviews
        loadReviewStats(productId);
        loadReviews(productId);
        checkReviewEligibility(productId);

    } catch (e) {
        console.error('Failed to load product details', e);
        content.innerHTML = '<div style="padding: 2rem; text-align: center;">Không thể tải chi tiết sản phẩm.</div>';
    }
}

let selAttr1 = null;
let selAttr2 = null;
let selectedVariantId = null;

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
    selAttr1 = null;
    selAttr2 = null;
    selectedVariantId = null;
}

function changeQty(n) {
    const input = document.getElementById('buy-qty');
    let val = parseInt(input.value) + n;
    if (val < 1) val = 1;
    if (val > parseInt(input.max)) val = parseInt(input.max);
    input.value = val;
}

function selectThumb(img) {
    const main = document.getElementById('main-product-img');
    if (main) main.src = img.src;
    document.querySelectorAll('.thumb-list img').forEach(i => i.classList.remove('active'));
    img.classList.add('active');
}

function selectAttr(group, val, btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (group === 1) selAttr1 = val;
    else selAttr2 = val;

    updateVariantSelection();
}

function updateVariantSelection() {
    const p = window._currentProduct;
    if (!p) return;

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
        document.getElementById('display-stock').textContent = `Còn ${variant.stock} sản phẩm`;
        document.getElementById('buy-qty').max = variant.stock;
        
        // Disable buttons if out of stock
        const noStock = variant.stock <= 0;
        document.getElementById('btn-add-cart').disabled = noStock;
        document.getElementById('btn-buy-now').disabled = noStock;
        
        // Update Image if variant has one
        if (variant.imageUrl) {
            document.getElementById('main-product-img').src = variant.imageUrl;
        }
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

function addToCart(id, name) {
    const qty = parseInt(document.getElementById('buy-qty').value);
    const priceText = document.getElementById('display-price').textContent;
    // Extract number from currency text (simple way)
    const price = parseInt(priceText.replace(/[^0-9]/g, ''));
    const img = document.getElementById('main-product-img').src;

    let cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
    const cartItemId = selectedVariantId ? `${id}-${selectedVariantId}` : id;
    const variantName = selectedVariantId ? document.querySelector('.variant-btn.active').textContent.trim() : null;
    const shopName = window._currentProduct ? window._currentProduct.shopName : 'Shop Zynk';

    const existing = cart.find(i => i.cartItemId === cartItemId);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ 
            id, 
            cartItemId, 
            variantId: selectedVariantId,
            variantName,
            shopName,
            name, 
            price, 
            img, 
            qty 
        });
    }

    localStorage.setItem('zynk_cart', JSON.stringify(cart));
    updateCartBadge();
    alert(`Đã thêm ${qty} sản phẩm vào giỏ hàng!`);
    closeModal();
}

function buyNow(id) {
    // Add to cart and redirect
    addToCart(id, document.querySelector('.modal-title').textContent);
    location.href = 'cart.html';
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
    
    // De-activate categories
    document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));

    searchProducts(keyword);
}

async function searchProducts(keyword) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="skeleton" style="height: 300px; grid-column: span 1 / -1;"></div>'.repeat(4);
    document.getElementById('market-title').textContent = `Kết quả tìm kiếm cho "${keyword}"`;

    try {
        const url = `marketplace/products?search=${encodeURIComponent(keyword)}`;
        let results = await window.api.get(url).catch(() => null);
        
        if (!results || results.length > 0 && Array.isArray(results) === false) {
             // fallback to local filter if API doesn't support search param properly
             const allProds = await window.api.get('marketplace/products');
             const kw = keyword.toLowerCase();
             results = allProds.filter(p => 
                 p.name.toLowerCase().includes(kw) || 
                 (p.shopName && p.shopName.toLowerCase().includes(kw))
             );
        }
        
        // If API returns all elements because it ignores "search", filter locally
        const kw = keyword.toLowerCase();
        currentProducts = results.filter(p => 
            p.name.toLowerCase().includes(kw) || 
            (p.shopName && p.shopName.toLowerCase().includes(kw))
        );

        renderProducts(currentProducts);
    } catch (e) {
        console.error('Failed to search products:', e);
        grid.innerHTML = '<div class="no-posts">Lỗi khi tìm kiếm.</div>';
    }
}

function searchByTag(tag) {
    executeSearch(tag);
}

function handleSort() {
    const val = document.getElementById('sort-filter').value;
    if (!currentProducts || currentProducts.length === 0) return;
    
    let sorted = [...currentProducts];
    if (val === 'price-asc') sorted.sort((a,b) => a.price - b.price);
    else if (val === 'price-desc') sorted.sort((a,b) => b.price - a.price);
    else if (val === 'popular') sorted.sort((a,b) => (b.salesCount || 0) - (a.salesCount || 0));
    else if (val === 'newest') sorted.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    renderProducts(sorted);
}
