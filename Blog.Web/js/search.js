// js/search.js v2.0 — Tab-based search with suggestions, history, debounce & i18n
(function() {

// ====== STATE ======
const HISTORY_KEY = 'zynk_search_history';
const MAX_HISTORY = 10;
let currentTab = 'all';
let currentQuery = '';
let debounceTimer = null;
let abortController = null;

// Helper translation wrapper
function _t(key, fallback) {
    if (typeof window.t === 'function') {
        const val = window.t(key);
        if (val && val !== key) return val;
    }
    return fallback || key;
}

// ====== DOM REFS ======
let searchInput, clearBtn, suggestBox, tabBtns, defaultView, resultsView, resultsTitle;

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
    searchInput  = document.getElementById('page-search-input');
    clearBtn     = document.getElementById('search-clear-btn');
    suggestBox   = document.getElementById('search-suggestions');
    tabBtns      = document.querySelectorAll('.search-tab');
    defaultView  = document.getElementById('search-default-view');
    resultsView  = document.getElementById('search-results-view');
    resultsTitle = document.getElementById('results-title');

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';
    const tabFromUrl = urlParams.get('tab');
    if (tabFromUrl) currentTab = tabFromUrl;

    renderRecentSearches();

    if (query) {
        if (searchInput) searchInput.value = query;
        if (clearBtn) clearBtn.classList.remove('hidden');
        performSearch(query);
    }

    // Tab click handlers
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Input keyboard & focus listeners
    if (searchInput) {
        searchInput.addEventListener('input', onInput);
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                clearTimeout(debounceTimer);
                hideSuggestions();
                const q = searchInput.value.trim();
                if (q.length >= 1) performSearch(q);
            }
            if (e.key === 'Escape') {
                hideSuggestions();
            }
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) {
                showSuggestions(searchInput.value.trim());
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearBtn.classList.add('hidden');
            hideSuggestions();
            showDefaultView();
            currentQuery = '';
            if (searchInput) searchInput.focus();
        });
    }

    document.addEventListener('click', e => {
        if (!e.target.closest('.search-page-header') && !e.target.closest('.search-suggestions')) {
            hideSuggestions();
        }
    });

    document.getElementById('clear-all-history')?.addEventListener('click', () => {
        localStorage.removeItem(HISTORY_KEY);
        renderRecentSearches();
    });
});

// ====== INPUT HANDLER WITH DEBOUNCE ======
function onInput() {
    const q = searchInput.value.trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);

    if (q.length === 0) {
        hideSuggestions();
        showDefaultView();
        currentQuery = '';
        return;
    }

    if (q.length < 2) {
        hideSuggestions();
        return;
    }

    showSuggestionsSkeleton();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        showSuggestions(q);
    }, 350);
}

// ====== SUGGESTIONS ======
function showSuggestionsSkeleton() {
    if (!suggestBox) return;
    suggestBox.innerHTML = Array(3).fill(`
        <div class="suggestion-skeleton">
            <div class="skel-circle"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                <div class="skel-line" style="width:60%;"></div>
                <div class="skel-line" style="width:40%;"></div>
            </div>
        </div>
    `).join('');
    suggestBox.classList.remove('hidden');
}

async function showSuggestions(q) {
    if (!suggestBox) return;
    const items = buildSuggestions(q);

    if (items.length === 0) {
        hideSuggestions();
        return;
    }

    suggestBox.innerHTML = items.map(item => `
        <div class="suggestion-item" onclick="selectSuggestion('${escHtml(item.text)}')">
            <div class="suggestion-item-icon">${item.icon}</div>
            <div style="flex:1;min-width:0;">
                <div class="suggestion-item-text">${highlight(item.text, q)}</div>
                ${item.sub ? `<div class="suggestion-item-sub">${item.sub}</div>` : ''}
            </div>
            ${item.badge ? `<span class="suggestion-item-badge">${item.badge}</span>` : ''}
        </div>
    `).join('');

    suggestBox.classList.remove('hidden');
}

function buildSuggestions(q) {
    const lower = q.toLowerCase();
    const suggestions = [];

    const pool = [
        { text: 'Laptop gaming', badge: _t('trending_now', 'Xu hướng'), icon: '<i class="fa-solid fa-fire"></i>', sub: '6.7k tìm kiếm' },
        { text: 'Laptop văn phòng', badge: _t('tab_products', 'Sản phẩm'), icon: '<i class="fa-solid fa-store"></i>', sub: 'Sản phẩm' },
        { text: '#laptop', badge: _t('tab_hashtags', 'Hashtag'), icon: '<i class="fa-solid fa-hashtag" style="color:#6366f1;"></i>', sub: '3.4k bài viết' },
        { text: 'Shop Laptop Store', badge: _t('tab_shops', 'Cửa hàng'), icon: '<i class="fa-solid fa-store"></i>', sub: 'Cửa hàng' },
        { text: 'Laptop Review', badge: _t('tab_users', 'Người dùng'), icon: '<i class="fa-solid fa-user"></i>', sub: '@laptop_review' },
        { text: 'Đăng Hải', badge: _t('tab_users', 'Người dùng'), icon: '<i class="fa-solid fa-user"></i>', sub: '@dh813345' },
        { text: 'Duy An Đặng', badge: _t('tab_users', 'Người dùng'), icon: '<i class="fa-solid fa-user"></i>', sub: '@dangduyan96' },
        { text: 'Khaitan Bang', badge: _t('tab_users', 'Người dùng'), icon: '<i class="fa-solid fa-user"></i>', sub: '@khaitan2105' },
        { text: 'Công nghệ thông tin', badge: _t('search_btn', 'Từ khóa'), icon: '<i class="fa-solid fa-magnifying-glass"></i>', sub: '' },
        { text: '#congnghe', badge: _t('tab_hashtags', 'Hashtag'), icon: '<i class="fa-solid fa-hashtag" style="color:#6366f1;"></i>', sub: '8.2k bài viết' },
        { text: '#dulich', badge: _t('tab_hashtags', 'Hashtag'), icon: '<i class="fa-solid fa-hashtag" style="color:#6366f1;"></i>', sub: '5.1k bài viết' },
        { text: 'ASP.NET Core', badge: _t('search_btn', 'Từ khóa'), icon: '<i class="fa-solid fa-magnifying-glass"></i>', sub: '4.3k tìm kiếm' },
        { text: '#laptrinh', badge: _t('tab_hashtags', 'Hashtag'), icon: '<i class="fa-solid fa-hashtag" style="color:#6366f1;"></i>', sub: '12.5k bài viết' },
    ];

    pool.forEach(item => {
        if (item.text.toLowerCase().includes(lower)) {
            suggestions.push(item);
        }
    });

    return suggestions.slice(0, 6);
}

function hideSuggestions() {
    if (suggestBox) {
        suggestBox.classList.add('hidden');
        suggestBox.innerHTML = '';
    }
}

window.selectSuggestion = function(text) {
    if (searchInput) searchInput.value = text;
    if (clearBtn) clearBtn.classList.remove('hidden');
    hideSuggestions();
    performSearch(text);
};

// ====== SEARCH EXECUTION ======
async function performSearch(query) {
    if (!query || query.trim().length === 0) return;

    query = query.trim();
    currentQuery = query;
    saveToHistory(query);

    const url = new URL(window.location);
    url.searchParams.set('q', query);
    window.history.replaceState({}, '', url);

    showResultsView();
    if (resultsTitle) {
        resultsTitle.textContent = _t('search_results_title', 'Kết quả tìm kiếm cho "{query}"').replace('{query}', query);
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();

    // Set skeleton loading inside the active tab ONLY
    const activeTabEl = document.getElementById('tab-' + currentTab);
    if (activeTabEl) {
        activeTabEl.innerHTML = renderLoadingSkeletons();
    }

    try {
        const results = await window.api.get(`search?q=${encodeURIComponent(query)}`);
        renderAllResults(results || {}, query);
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Search error:', error);
        const activeEl = document.getElementById('tab-' + currentTab);
        if (activeEl) {
            activeEl.innerHTML = renderNoResults(query);
        }
    }
}

// ====== RENDER ALL RESULTS ======
function renderAllResults(results, query) {
    const users    = results.users    || [];
    const posts    = results.posts    || [];
    const reels    = results.reels    || [];
    const hashtags = results.hashtags || [];
    const groups   = results.groups   || [];
    const products = results.products || [];
    const shops    = results.shops    || [];

    // 1. Render single category tabs
    const usersEl = document.getElementById('users-results-list');
    if (usersEl) usersEl.innerHTML = users.length ? users.map(renderUserCard).join('') : renderNoResults(query);

    const reelsEl = document.getElementById('reels-results-list');
    if (reelsEl) reelsEl.innerHTML = reels.length ? reels.map(renderReelThumb).join('') : renderNoResults(query);

    const hashEl = document.getElementById('hashtags-results-list');
    if (hashEl) hashEl.innerHTML = hashtags.length ? hashtags.map(renderHashtagCard).join('') : renderNoResults(query);

    const groupsEl = document.getElementById('groups-results-list');
    if (groupsEl) groupsEl.innerHTML = groups.length ? groups.map(renderGroupCard).join('') : renderNoResults(query);

    const prodEl = document.getElementById('products-results-list');
    if (prodEl) prodEl.innerHTML = products.length ? products.map(renderProductCard).join('') : renderNoResults(query);

    const shopsEl = document.getElementById('shops-results-list');
    if (shopsEl) shopsEl.innerHTML = shops.length ? shops.map(renderShopCard).join('') : renderNoResults(query);

    const postsContainer = document.getElementById('posts-results-list');
    if (postsContainer) {
        if (posts.length > 0 && window.common?.createPostCard) {
            postsContainer.innerHTML = '';
            posts.forEach(p => postsContainer.appendChild(window.common.createPostCard(p)));
        } else {
            postsContainer.innerHTML = renderNoResults(query);
        }
    }

    // 2. Render "Tất cả" (All) tab
    const allContainer = document.getElementById('all-results-container');
    if (allContainer) {
        allContainer.innerHTML = '';

        const totalItems = users.length + posts.length + reels.length + hashtags.length + groups.length + products.length + shops.length;

        if (totalItems === 0) {
            // EXACTLY ONE empty banner for the entire "Tất cả" tab!
            allContainer.innerHTML = renderNoResults(query);
        } else {
            // ONLY append sections that actually have > 0 items!
            if (users.length)    appendSection(allContainer, _t('tab_users', 'Người dùng'), users.slice(0, 3).map(renderUserCard).join(''), 'users');
            if (posts.length) {
                const sec = createSectionEl(_t('tab_posts', 'Bài viết'), 'posts');
                const list = document.createElement('div');
                list.className = 'results-list';
                posts.slice(0, 3).forEach(p => { if (window.common?.createPostCard) list.appendChild(window.common.createPostCard(p)); });
                sec.appendChild(list);
                allContainer.appendChild(sec);
            }
            if (reels.length)    appendSection(allContainer, _t('tab_reels', 'Reels'), reels.slice(0, 3).map(renderReelThumb).join(''), 'reels');
            if (hashtags.length) appendSection(allContainer, _t('tab_hashtags', 'Hashtag'), hashtags.slice(0, 3).map(renderHashtagCard).join(''), 'hashtags');
            if (groups.length)   appendSection(allContainer, _t('tab_groups', 'Cộng đồng'), groups.slice(0, 3).map(renderGroupCard).join(''), 'groups');
            if (products.length) {
                const sec = createSectionEl(_t('tab_products', 'Sản phẩm'), 'products');
                const grid = document.createElement('div');
                grid.className = 'results-grid products-grid';
                grid.innerHTML = products.slice(0, 4).map(renderProductCard).join('');
                sec.appendChild(grid);
                allContainer.appendChild(sec);
            }
            if (shops.length)    appendSection(allContainer, _t('tab_shops', 'Cửa hàng'), shops.slice(0, 3).map(renderShopCard).join(''), 'shops');
        }
    }

    // Switch to active tab so ONLY ONE TAB is displayed
    switchTab(currentTab);
}

function createSectionEl(title, tabName) {
    const sec = document.createElement('div');
    sec.style.marginBottom = '20px';
    sec.innerHTML = `
        <div class="results-section-header">
            <h3>${title}</h3>
            <button class="results-section-see-all" onclick="switchToTab('${tabName}')">${_t('see_all', 'Xem tất cả')} →</button>
        </div>
    `;
    return sec;
}

function appendSection(container, title, html, tabName) {
    const sec = createSectionEl(title, tabName);
    const list = document.createElement('div');
    list.className = 'results-list';
    list.innerHTML = html;
    sec.appendChild(list);
    container.appendChild(sec);
}

window.switchToTab = function(tabName) {
    switchTab(tabName);
};

// ====== TAB SWITCHING ======
function switchTab(tab) {
    currentTab = tab;

    // Update active state on tab buttons
    if (tabBtns) {
        tabBtns.forEach(b => {
            if (b.dataset.tab === tab) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    // Hide ALL tab-content elements first!
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // Show ONLY the target active tab-content container!
    const target = document.getElementById('tab-' + tab);
    if (target) target.classList.remove('hidden');
}

// ====== CARD RENDERERS ======
function renderUserCard(user) {
    const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=random`;
    return `
        <div class="user-result-card" onclick="window.location.href='profile.html?id=${user.id}'">
            <img src="${avatar}" alt="Avatar">
            <div class="user-result-info">
                <h4>${escHtml(user.fullName || user.username)}</h4>
                <p>@${escHtml(user.username)}</p>
                ${user.bio ? `<p class="bio-preview">${escHtml(user.bio.substring(0, 60))}</p>` : ''}
            </div>
            <button class="user-result-follow-btn" onclick="event.stopPropagation()">${_t('follow', 'Theo dõi')}</button>
        </div>
    `;
}

function renderHashtagCard(ht) {
    const name = ht.name || ht.tag || ht;
    const count = ht.postCount || 0;
    return `
        <div class="hashtag-result-card" onclick="window.location.href='search.html?q=%23${encodeURIComponent(name)}&tab=hashtags'">
            <div class="hashtag-icon-circle">#</div>
            <div class="hashtag-info">
                <div class="hashtag-name">#${escHtml(name)}</div>
                <div class="hashtag-stats">${count > 0 ? count.toLocaleString('vi-VN') + ' bài viết' : 'Hashtag'}</div>
            </div>
        </div>
    `;
}

function renderGroupCard(group) {
    const img = group.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=random`;
    return `
        <div class="group-result-card" onclick="window.location.href='group-detail.html?id=${group.id}'">
            <img src="${img}" alt="Group">
            <div class="group-info">
                <div class="group-name">${escHtml(group.name)}</div>
                <div class="group-meta">
                    <span><i class="fa-solid fa-users"></i> ${(group.memberCount || 0).toLocaleString('vi-VN')} thành viên</span>
                    <span>${group.isPublic ? 'Công khai' : 'Riêng tư'}</span>
                </div>
            </div>
            <button class="group-join-btn" onclick="event.stopPropagation()">Tham gia</button>
        </div>
    `;
}

function renderProductCard(product) {
    const img = product.featuredImageUrl || product.imageUrl || `https://ui-avatars.com/api/?name=Product&background=random`;
    const price = window.common?.formatCurrency ? window.common.formatCurrency(product.price) : (product.price || 0).toLocaleString('vi-VN') + ' đ';
    return `
        <div class="product-result-card" onclick="window.location.href='marketplace.html?id=${product.id}'">
            <img src="${img}" alt="${escHtml(product.name)}" class="product-result-img">
            <div class="product-result-info">
                <div class="product-result-title">${escHtml(product.name)}</div>
                <div class="product-result-price">${price}</div>
                <div class="product-result-shop"><i class="fa-solid fa-store"></i> ${escHtml(product.shopName || 'Cửa hàng')}</div>
            </div>
        </div>
    `;
}

function renderShopCard(shop) {
    const img = shop.avatarUrl || shop.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop.name)}&background=random`;
    return `
        <div class="shop-result-card">
            <img src="${img}" alt="${escHtml(shop.name)}">
            <div class="shop-info">
                <div class="shop-name">
                    ${escHtml(shop.name)}
                    ${shop.isVerified ? '<i class="fa-solid fa-circle-check verified"></i>' : ''}
                </div>
                <div class="shop-meta">
                    <span><i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${shop.rating || '5.0'}</span>
                    <span>${(shop.followerCount || 0).toLocaleString('vi-VN')} theo dõi</span>
                    <span>${(shop.productCount || 0).toLocaleString('vi-VN')} sp</span>
                </div>
            </div>
            <button class="shop-follow-btn">${_t('follow', 'Theo dõi')}</button>
        </div>
    `;
}

function renderReelThumb(reel) {
    const src = reel.videoUrl || (reel.imageUrls && reel.imageUrls[0]) || '';
    return `
        <div class="reel-thumb" onclick="window.location.href='reels.html'">
            ${src ? `<video src="${src}" muted preload="none"></video>` : '<div style="background:#333;width:100%;height:100%;"></div>'}
            <div class="reel-thumb-play"><i class="fa-solid fa-play"></i></div>
        </div>
    `;
}

function renderNoResults(query) {
    const titleText = _t('no_results_found', 'Không tìm thấy kết quả phù hợp cho "{query}"').replace('{query}', escHtml(query || ''));
    const tipText = _t('no_results_tip', 'Kiểm tra lại chính tả, thử từ khóa ngắn hơn hoặc tìm theo hashtag.');

    return `
        <div class="no-results">
            <i class="fa-solid fa-magnifying-glass"></i>
            <strong>${titleText}</strong>
            <p>${tipText}</p>
        </div>
    `;
}

function renderLoadingSkeletons() {
    return Array(3).fill(`
        <div class="suggestion-skeleton" style="background:var(--glass-bg);border-radius:14px;margin-bottom:8px;padding:14px 16px;">
            <div class="skel-circle" style="width:52px;height:52px;border-radius:50%;"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
                <div class="skel-line" style="width:65%;"></div>
                <div class="skel-line" style="width:40%;"></div>
            </div>
        </div>
    `).join('');
}

// ====== VIEW HELPERS ======
function showResultsView() {
    if (defaultView) defaultView.classList.add('hidden');
    if (resultsView) resultsView.classList.remove('hidden');
    // DO NOT remove hidden class from all .tab-content! switchTab will control visibility.
}

function showDefaultView() {
    if (defaultView) defaultView.classList.remove('hidden');
    if (resultsView) resultsView.classList.add('hidden');
    renderRecentSearches();
}

// ====== SEARCH HISTORY ======
function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveToHistory(query) {
    let history = getHistory().filter(h => h !== query);
    history.unshift(query);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderRecentSearches();
}

function renderRecentSearches() {
    const history = getHistory();
    const section = document.getElementById('recent-searches-section');
    const list = document.getElementById('recent-list');

    if (!section || !list) return;

    if (history.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = history.map(q => `
        <div class="recent-item">
            <span class="recent-item-icon"><i class="fa-solid fa-clock-rotate-left"></i></span>
            <span class="recent-keyword" onclick="selectSuggestion('${escHtml(q)}')">${escHtml(q)}</span>
            <button class="recent-delete-btn" onclick="deleteHistoryItem('${escHtml(q)}')" title="${_t('delete', 'Xóa')}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

window.deleteHistoryItem = function(query) {
    const history = getHistory().filter(h => h !== query);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderRecentSearches();
};

// ====== UTILITIES ======
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlight(text, query) {
    if (!query) return escHtml(text);
    const escaped = escHtml(text);
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(re, '<strong>$1</strong>');
}

})();
