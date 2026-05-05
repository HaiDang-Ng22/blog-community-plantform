// js/common.js

// Cache seller status in memory for the page session
window._userHasShop = false;

function requireAuth(options = {}) {
    const {
        redirectTo = 'auth.html',
        returnTo = window.location.pathname.split('/').pop() + window.location.search + window.location.hash,
        storageKey = 'zynk_return_to',
    } = options;

    const token = localStorage.getItem('auth_token');
    const userInfoRaw = localStorage.getItem('user_info');
    const hasUser = !!(userInfoRaw && userInfoRaw !== 'null');

    if (token && hasUser) return true;

    try {
        if (returnTo) sessionStorage.setItem(storageKey, returnTo);
    } catch { /* ignore */ }

    window.location.href = redirectTo;
    return false;
}

async function checkSellerStatus() {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    // Use sessionStorage cache to avoid repeated API calls within same page session
    const cached = sessionStorage.getItem('zynk_has_shop');
    if (cached !== null) {
        window._userHasShop = cached === 'true';
        return window._userHasShop;
    }
    try {
        const resp = await fetch(API_BASE_URL + '/seller/my-shop', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        window._userHasShop = resp.ok;
        sessionStorage.setItem('zynk_has_shop', String(window._userHasShop));
    } catch {
        window._userHasShop = false;
    }
    return window._userHasShop;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.error('Service Worker registration failed', err));
        });
    }

    // Capture PWA Installation Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        window.deferredPrompt = e;
        
        // Custom event to notify settings page or other components
        window.dispatchEvent(new CustomEvent('pwaPromptAvailable'));
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        window.deferredPrompt = null;
        window.dispatchEvent(new CustomEvent('pwaInstalled'));
    });

    // Global theme initialization
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // --- Admin Redirection Logic ---
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const isLoginPage = window.location.pathname.includes('auth.html');
    const isAdminPage = window.location.pathname.includes('/admin/');

    if (userInfo && userInfo.role === 'Admin' && !isAdminPage && !isLoginPage) {
        window.location.href = 'admin/index.html';
        return;
    }
    
    try {
        await checkSellerStatus();
    } catch (e) {
        console.error("Seller status check failed", e);
    }
    
    renderSidebar();
    updateNav();
    
    // Load badges
    try { 
        await Promise.all([
            loadChatUnreadBadge(),
            loadNotificationBadge()
        ]); 
    } catch(e) {}

    // Init Push Notifications
    if (localStorage.getItem('auth_token')) {
        initPushNotifications();
    }
});

async function loadNotificationBadge() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
        const notis = await window.api.get('notifications');
        if (!Array.isArray(notis)) return;
        
        const unreadCount = notis.filter(n => !n.isRead).length;
        const badge = document.getElementById('sidebar-noti-badge');
        const mobileBadge = document.getElementById('mth-noti-badge');
        
        const update = (el) => {
            if (!el) return;
            el.textContent = unreadCount > 99 ? '99+' : unreadCount;
            el.classList.toggle('hidden', unreadCount === 0);
        };
        update(badge);
        update(mobileBadge);
    } catch { /* silent fail */ }
}
window.loadNotificationBadge = loadNotificationBadge;



function renderSidebar() {
    if (window._sidebarRendered) return;
    
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    window._sidebarRendered = true;
    
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const userName = userInfo.fullName || userInfo.username || 'User';
    const userAvatar = (userInfo.avatarUrl && userInfo.avatarUrl !== 'null')
            ? userInfo.avatarUrl
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&color=fff`;

    // Aggressively remove any existing sidebar or legacy header that might be lingering
    document.querySelectorAll('.sidebar-nav, .mobile-top-header, .mobile-bottom-nav, .main-header, header, .nav-container').forEach(el => el.remove());

    // ─── Mobile Premium UI Redesign ───────────────────────────
    if (window.innerWidth <= 768) {
        // 1. Top Header
        const topHeader = document.createElement('div');
        topHeader.className = 'mobile-top-header';
        topHeader.innerHTML = `
            <div class="mth-logo" onclick="window.location.href='index.html'">
                <img src="assets/logo.png" onerror="this.src='https://via.placeholder.com/100x30?text=ZYNK'">
                <span class="zynk-logo-text">Zynk</span>
            </div>
            <div class="mth-actions">
                ${window.location.pathname.includes('profile.html') ? `
                <a href="settings.html" class="mth-icon-link" title="Cài đặt">
                    <i class="fa-solid fa-gear"></i>
                </a>
                <a href="#" class="mth-icon-link" onclick="logout(event)" title="Đăng xuất">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </a>` : ''}
                <a href="notifications.html" class="mth-icon-link" id="mth-noti-link" style="position:relative;">
                    <i class="fa-regular fa-heart"></i>
                    <span id="mth-noti-badge" class="noti-badge hidden">0</span>
                </a>
                <a href="messages.html" class="mth-icon-link" id="mth-msg-link" style="position:relative;">
                    <i class="fa-regular fa-paper-plane"></i>
                    <span id="mth-msg-badge" class="noti-badge hidden">0</span>
                </a>
            </div>
        `;
        document.body.appendChild(topHeader);

        // 2. Bottom Navigation Bar
        const bottomNav = document.createElement('div');
        bottomNav.className = 'mobile-bottom-nav';
        bottomNav.innerHTML = `
            <a href="index.html" class="mbn-link">
                <i class="fa-solid fa-house"></i>
            </a>
            <a href="search.html" class="mbn-link">
                <i class="fa-solid fa-magnifying-glass"></i>
            </a>
            <a href="create-post.html" class="mbn-link mbn-create">
                <i class="fa-solid fa-plus"></i>
            </a>
            <a href="marketplace.html" class="mbn-link">
                <i class="fa-solid fa-compass"></i>
            </a>
            <a href="profile.html" class="mbn-link">
                <img src="${userAvatar}" class="mbn-avatar" onerror="this.src='https://ui-avatars.com/api/?name=U'">
            </a>
        `;
        document.body.appendChild(bottomNav);

        // On mobile, we DON'T render the standard sidebar
        return;
    }

    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar-nav';
    sidebar.id = 'zynk-main-sidebar';
    
    sidebar.innerHTML = `
        <div class="sidebar-logo" onclick="window.location.href='index.html'">
            <img src="assets/logo.png" onerror="this.src='https://via.placeholder.com/100x30?text=ZYNK'">
            <span class="zynk-logo-text">Zynk</span>
        </div>
        <div class="sidebar-links">
            <a href="index.html" class="sidebar-link">
                <i class="fa-solid fa-house"></i>
                <span>Trang chủ</span>
            </a>
            <a href="search.html" class="sidebar-link" id="sidebar-search-trigger">
                <i class="fa-solid fa-magnifying-glass"></i>
                <span>Tìm kiếm</span>
            </a>
            <a href="marketplace.html" class="sidebar-link">
                <i class="fa-solid fa-compass"></i>
                <span>Khám phá</span>
            </a>
            <div class="sidebar-link mobile-hide" id="sidebar-noti-trigger" style="position:relative;">
                <i class="fa-regular fa-heart"></i>
                <span>Thông báo</span>
                <span id="sidebar-noti-badge" class="noti-badge hidden">0</span>
            </div>
            <a href="messages.html" class="sidebar-link" id="sidebar-messages-link" style="position:relative;">
                <i class="fa-regular fa-paper-plane"></i>
                <span>Tin nhắn</span>
                <span id="sidebar-msg-badge" class="noti-badge hidden">0</span>
            </a>
            <a href="create-post.html" class="sidebar-link">
                <i class="fa-regular fa-square-plus"></i>
                <span>Tạo</span>
            </a>
            <a href="profile.html" class="sidebar-link">
                <img src="${userAvatar}" class="mini-avatar" style="width:24px; height:24px; margin:0; border: 1px solid #dbdbdb;">
                <span>Trang cá nhân</span>
            </a>
            <div class="sidebar-link" id="sidebar-more-trigger">
                <i class="fa-solid fa-bars"></i>
                <span>Xem thêm</span>
            </div>
            
            <!-- More Menu Popup -->
            <div id="sidebar-more-menu" class="sidebar-more-menu hidden">
                <a href="settings.html"><i class="fa-solid fa-gear"></i> Cài đặt</a>
                ${(userInfo.role === 'Admin' || userInfo.Role === 'Admin') ? `<a href="admin.html" style="color: #6366f1;"><i class="fa-solid fa-user-shield"></i> Quản trị</a>` : ''}
                <div class="menu-divider"></div>
                <a href="#" onclick="logout(event)"><i class="fa-solid fa-sign-out-alt"></i> Đăng xuất</a>
            </div>
        </div>
    `;
    
    document.body.appendChild(sidebar);
    
    // Create search sub-panel separately to avoid overflow issues
    const searchPanel = document.createElement('div');
    searchPanel.className = 'sidebar-sub-panel';
    searchPanel.id = 'sidebar-search-panel';
    searchPanel.innerHTML = `
        <div class="sub-panel-content">
            <h2 class="sub-panel-title">Tìm kiếm</h2>
            <div class="search-input-container">
                <input type="text" id="sidebar-search-input" placeholder="Tìm kiếm">
            </div>
            <div id="search-results-mini" class="search-results-mini">
                <p>Chưa có nội dung tìm kiếm gần đây.</p>
            </div>
        </div>
    `;

    document.body.prepend(searchPanel);
    document.body.prepend(sidebar);
    
    // Select elements after prepending
    const searchTrigger = document.getElementById('sidebar-search-trigger');
    const notiTrigger = document.getElementById('sidebar-noti-trigger');
    const searchInput = document.getElementById('sidebar-search-input');
    
    if (notiTrigger) {
        notiTrigger.onclick = () => {
            window.location.href = 'notifications.html';
        };
    }
    const moreTrigger = document.getElementById('sidebar-more-trigger');
    const moreMenu = document.getElementById('sidebar-more-menu');
    let panelBackdrop = document.getElementById('sidebar-panel-backdrop');
    if (!panelBackdrop) {
        panelBackdrop = document.createElement('div');
        panelBackdrop.id = 'sidebar-panel-backdrop';
        panelBackdrop.className = 'sidebar-panel-backdrop hidden';
        document.body.appendChild(panelBackdrop);
    }

    const closeSidebarPanels = () => {
        if (searchPanel) searchPanel.classList.remove('active');
        sidebar.classList.remove('sub-panel-open');
        document.body.classList.remove('mobile-search-open');
        if (panelBackdrop) panelBackdrop.classList.add('hidden');
        if (moreMenu) moreMenu.classList.add('hidden');
    };

    const useDedicatedSearchPage = true;
    const isMobileSidebar = window.innerWidth <= 768;

    // Use dedicated search page across all devices to avoid panel/menu conflicts.
    if (useDedicatedSearchPage) {
        closeSidebarPanels();
        if (searchPanel) searchPanel.remove();
        if (panelBackdrop) panelBackdrop.remove();
    }

    // On mobile: keep "More" menu working.
    if (isMobileSidebar) {
        closeSidebarPanels();
    }

    if (!useDedicatedSearchPage && !isMobileSidebar && searchTrigger && searchPanel) {
        searchTrigger.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isActive = searchPanel.classList.contains('active');
            
            // Close other panels if any
            searchPanel.classList.toggle('active');
            
            if (searchPanel.classList.contains('active')) {
                sidebar.classList.add('sub-panel-open');
                searchInput.value = '';
                searchInput.focus();
                if (window.innerWidth <= 768) {
                    document.body.classList.add('mobile-search-open');
                    if (panelBackdrop) panelBackdrop.classList.remove('hidden');
                }
            } else {
                closeSidebarPanels();
            }
        };
        searchPanel.onclick = (e) => e.stopPropagation();

        if (searchInput) {
            let searchTimeout;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                if (query.length > 1) {
                    searchTimeout = setTimeout(() => handleMiniSearch(query), 300);
                } else if (query.length === 0) {
                    const resultsContainer = document.getElementById('search-results-mini');
                    if (resultsContainer) {
                        resultsContainer.innerHTML = '<p style="color: #8e8e8e; font-size: 0.9rem; text-align:center;">Chưa có nội dung tìm kiếm gần đây.</p>';
                    }
                }
            };
            
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    const q = searchInput.value.trim();
                    if (q) handleMiniSearch(q);
                }
            };
        }
    }

    if (moreTrigger && moreMenu) {
        moreTrigger.onclick = (e) => {
            e.stopPropagation();
            moreMenu.classList.toggle('hidden');
        };
        document.addEventListener('click', () => moreMenu.classList.add('hidden'));
    }

    // Global click handler to close panels
    if (!useDedicatedSearchPage) {
        document.addEventListener('click', (e) => {
            if (searchPanel && !searchPanel.contains(e.target) && e.target !== searchTrigger) {
                closeSidebarPanels();
            }
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            closeSidebarPanels();
        }
    });

    if (!useDedicatedSearchPage && panelBackdrop) {
        panelBackdrop.onclick = () => closeSidebarPanels();
    }

    // Ensure any sidebar navigation action closes overlay on mobile
    sidebar.querySelectorAll('.sidebar-link').forEach(link => {
        if (link.id !== 'sidebar-search-trigger' && link.id !== 'sidebar-more-trigger') {
            link.addEventListener('click', () => closeSidebarPanels());
        }
    });

    // Adjust main content on all pages
    const mainEl = document.querySelector('main');
    if (mainEl) {
        mainEl.classList.add('main-with-sidebar');
    } else {
        document.body.classList.add('main-with-sidebar');
    }
}

// Global Instagram-style Split Modal
window.openPostModal = async function(postOrId) {
    if (!postOrId) return;
    
    let initialPost = typeof postOrId === 'string' ? { id: postOrId } : postOrId;
    let postId = initialPost.id || initialPost.Id;
    if (!postId) return;

    let modal = document.getElementById('zynk-split-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'zynk-split-modal';
        modal.className = 'zynk-modal-overlay hidden';
        document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    // Clear old content immediately to prevent "stale" view
    modal.innerHTML = `
        <div class="zynk-modal-close" onclick="this.parentElement.classList.add('hidden')">&times;</div>
        <div style="height:100%; display:flex; align-items:center; justify-content:center; color:white;">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
        </div>
    `;

    // Clear old content immediately to prevent "stale" view
    modal.innerHTML = `
        <div class="zynk-modal-close" onclick="this.parentElement.classList.add('hidden')">&times;</div>
        <div style="height:100%; display:flex; align-items:center; justify-content:center; color:white;">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
        </div>
    `;

    
    try {
        // 1. Try to get data from global cache first (feed data is often more complete)
        window._postCache = window._postCache || {};
        const cachedPost = window._postCache[postId];
        
        // 2. Fetch fresh data (for images/comments)
        const fetched = await window.api.get(`posts/${postId}`);
        const apiData = Array.isArray(fetched) ? fetched[0] : fetched;
        
        // 3. Unified merge: Cache > Initial > API Data (API is still preferred, but we preserve good older values)
        const post = { 
            ...(cachedPost || {}), 
            ...initialPost, 
            ...(apiData || {}) 
        };
        
        // Keep the best values for metadata/media when API returns empty placeholders
        // Priority for fallback source: cachedPost -> initialPost
        if (apiData) {
            for (let k in apiData) {
                const apiValue = apiData[k];
                const cachedValue = cachedPost ? cachedPost[k] : undefined;
                const initialValue = initialPost ? initialPost[k] : undefined;
                const fallbackValue = (cachedValue !== undefined && cachedValue !== null) ? cachedValue : initialValue;
                const hasFallback = fallbackValue !== undefined && fallbackValue !== null;

                const isEmptyArray = Array.isArray(apiValue) && apiValue.length === 0;
                const isEmptyString = typeof apiValue === 'string' && apiValue.trim() === '';
                const isNullish = apiValue === null || apiValue === undefined;

                if ((isNullish || isEmptyArray || isEmptyString) && hasFallback) {
                    post[k] = fallbackValue;
                }
            }
        }
        
        console.log("Opening Modal for Post:", postId, post);

        // DATA NORMALIZATION (Ultra-Aggressive)
        const author = post.author || post.Author || post.user || post.User || post.creator || post.Creator || {};
        const profileNameFromPage = document.getElementById('profile-name')?.textContent?.trim();
        const profileIdFromUrl = new URLSearchParams(window.location.search).get('id');
        const isProfilePage = window.location.pathname.toLowerCase().includes('profile.html');
        const authorName =
            post.authorName ||
            post.AuthorName ||
            post.fullName ||
            post.FullName ||
            author.fullName ||
            author.FullName ||
            author.userName ||
            author.UserName ||
            author.username ||
            author.Username ||
            author.name ||
            author.Name ||
            author.displayName ||
            author.DisplayName ||
            (isProfilePage ? profileNameFromPage : null) ||
            "Người dùng Zynk";
        const authorAvatar =
            post.authorAvatarUrl ||
            post.AuthorAvatarUrl ||
            post.avatarUrl ||
            post.AvatarUrl ||
            author.avatarUrl ||
            author.AvatarUrl ||
            author.profileImageUrl ||
            author.ProfileImageUrl ||
            author.image ||
            author.Image ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`;
        const authorId =
            post.authorId ||
            post.AuthorId ||
            post.userId ||
            post.UserId ||
            author.id ||
            author.Id ||
            (isProfilePage ? profileIdFromUrl : null) ||
            "";
        
        const postContent = post.content || post.caption || post.text || "";
        const postTime = formatDate(post.createdAt || new Date());
        const likeCount = post.likeCount || 0;

        // IMAGE NORMALIZATION
        let images = [];
        if (post.imageUrls && Array.isArray(post.imageUrls) && post.imageUrls.length > 0) {
            images = post.imageUrls;
        } else if (post.images && Array.isArray(post.images)) {
            images = post.images.map(img => typeof img === 'string' ? img : (img.url || img.path));
        } else if (post.featuredImageUrl) {
            images = [post.featuredImageUrl];
        } else if (post.imagePath) {
            images = [post.imagePath];
        } else {
            images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        const myAvatar = userInfo.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.fullName || 'User')}`;

        let carouselHtml = '';
        if (images.length > 1) {
            carouselHtml = `
                <div class="modal-carousel-container" style="width:100%; height:100%; position:relative; overflow:hidden; background:#000;">
                    <div class="modal-carousel-track" style="display:flex; height:100%; transition: transform 0.4s cubic-bezier(0.2, 0, 0.2, 1);">
                        ${images.map(img => `<div style="flex:0 0 100%; display:flex; align-items:center; justify-content:center;"><img src="${img}" style="max-width:100%; max-height:100%; object-fit:contain;"></div>`).join('')}
                    </div>
                    <button class="carousel-nav prev" style="left:15px; display:none;"><i class="fa fa-chevron-left"></i></button>
                    <button class="carousel-nav next" style="right:15px;"><i class="fa fa-chevron-right"></i></button>
                </div>
            `;
        } else {
            carouselHtml = `<img src="${images[0]}" alt="Post media" style="max-width:100%; max-height:100%; object-fit:contain; width:100%; height:100%;">`;
        }

        modal.innerHTML = `
            <div class="zynk-modal-close" onclick="this.parentElement.classList.add('hidden')">&times;</div>
            <div class="zynk-modal-container">
                <div class="zynk-modal-media">
                    ${carouselHtml}
                </div>
                <div class="zynk-modal-side">
                    <div class="zynk-modal-header" style="border-bottom: 1px solid #efefef; padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
                        <img src="${authorAvatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" alt="Avatar">
                        <a href="profile.html?id=${authorId}" style="font-weight:700; text-decoration:none; color:#262626; font-size:0.9rem;">${authorName}</a>
                    </div>
                    <div class="zynk-modal-comments" style="flex:1; overflow-y:auto; padding:16px;">
                        <div class="zynk-modal-caption" style="margin-bottom: 24px; display:flex; gap:12px;">
                             <img src="${authorAvatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" alt="Avatar">
                             <div style="flex:1;">
                                <span style="font-weight:700; margin-right:8px; color:#262626;">${authorName}</span>
                                <span style="font-size:0.9rem; line-height:1.5;">${autoLink(postContent)}</span>
                                <div style="font-size:0.75rem; color:#8e8e8e; margin-top:8px;">${postTime}</div>
                             </div>
                        </div>
                        <div id="modal-comments-list">
                            <div style="text-align:center; padding:30px; color:#8e8e8e;">
                                <i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải bình luận...
                            </div>
                        </div>
                    </div>
                    <div class="zynk-modal-actions" style="padding:12px 16px; border-top:1px solid #efefef;">
                        <div style="display:flex; gap:16px; margin-bottom:8px; font-size:1.5rem;">
                            <i id="modal-like-icon" class="${post.isLikedByMe ? 'fa-solid' : 'fa-regular'} fa-heart" style="cursor:pointer; ${post.isLikedByMe ? 'color:#EF4444;' : ''}" onclick="window.postActions.toggleLike('${postId}', this)"></i>
                            <i class="fa-regular fa-comment" style="cursor:pointer;" onclick="document.getElementById('modal-comment-input').focus()"></i>
                        </div>
                        <div id="modal-like-count" style="font-weight:700; font-size:0.9rem; margin-bottom:12px;">${likeCount} lượt thích</div>
                        
                        <div class="modal-comment-input-wrap" style="display:flex; align-items:center; gap:12px; border-top:1px solid #efefef; padding-top:12px;">
                            <img src="${myAvatar}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" alt="Me">
                            <input type="text" id="modal-comment-input" placeholder="Thêm bình luận..." style="flex:1; border:none; outline:none; font-size:0.9rem;">
                            <button onclick="submitModalComment('${postId}')" style="background:none; border:none; color:#0095f6; font-weight:600; cursor:pointer;">Đăng</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Carousel Logic
        if (images.length > 1) {
            const track = modal.querySelector('.modal-carousel-track');
            const prev = modal.querySelector('.carousel-nav.prev');
            const next = modal.querySelector('.carousel-nav.next');
            let idx = 0;
            const update = () => {
                track.style.transform = `translateX(-${idx * 100}%)`;
                if (prev) prev.style.display = idx === 0 ? 'none' : 'flex';
                if (next) next.style.display = idx === images.length - 1 ? 'none' : 'flex';
            };
            if (prev) prev.onclick = (e) => { e.stopPropagation(); if (idx > 0) { idx--; update(); } };
            if (next) next.onclick = (e) => { e.stopPropagation(); if (idx < images.length - 1) { idx++; update(); } };
            update();
        }

// Global shortcut for submitting comment in modal
window.submitModalComment = async function(postId) {
    const input = document.getElementById('modal-comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const comment = await window.api.post(`posts/${postId}/comments`, { content });
        input.value = '';
        
        // Reload comments list
        const container = document.getElementById('modal-comments-list');
        if (window.postActions && window.postActions.loadCommentsForModal) {
            await window.postActions.loadCommentsForModal(postId, container);
        }
        
        // Update cache
        if (window._postCache && window._postCache[postId]) {
            window._postCache[postId].comments = window._postCache[postId].comments || [];
            window._postCache[postId].comments.push(comment);
        }
    } catch (err) {
        alert("Lỗi khi đăng bình luận: " + err.message);
    }
};

        // Delegate loading to unified comment loader in post-actions.js
        const modalCommentsContainer = document.getElementById('modal-comments-list');
        if (window.postActions && window.postActions.loadCommentsForModal && modalCommentsContainer) {
            window.postActions.loadCommentsForModal(postId, modalCommentsContainer);
        }

    } catch (err) {
        console.error("Critical Modal Error:", err);
        modal.innerHTML = `
            <div class="zynk-modal-close" onclick="this.parentElement.classList.add('hidden')">&times;</div>
            <div style="color:white; text-align:center; padding: 50px;">
                <p>Không thể tải dữ liệu bài viết này.</p>
                <button onclick="location.reload()" style="margin-top:20px; padding:8px 20px;">Thử lại</button>
            </div>
        `;
    }
}


window.submitModalComment = async function(postId) {
    const input = document.getElementById('modal-comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const comment = await window.api.post(`posts/${postId}/comments`, { content });
        input.value = '';
        // Reload comments list in modal
        if (window.postActions && window.postActions.loadCommentsForModal) {
            window.postActions.loadCommentsForModal(postId, document.getElementById('modal-comments-list'));
        }
        // Also update comment count in actions area if we wanted to (omitted for brevity)
    } catch (e) {
        alert('Lỗi khi gửi bình luận');
    }
}


async function handleMiniSearch(query) {
    const resultsContainer = document.getElementById('search-results-mini');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</div>';

    try {
        const results = await window.api.get(`search?q=${encodeURIComponent(query)}`);
        resultsContainer.innerHTML = '';

        if (results.users.length === 0 && results.posts.length === 0) {
            resultsContainer.innerHTML = '<p style="color: #8e8e8e; font-size: 0.9rem; text-align:center;">Không tìm thấy kết quả nào.</p>';
            return;
        }

        // Render Users
        if (results.users.length > 0) {
            const userTitle = document.createElement('h4');
            userTitle.textContent = 'Người dùng';
            userTitle.style.cssText = 'font-size: 0.85rem; margin-bottom: 12px; color: #8e8e8e; text-transform: uppercase; letter-spacing: 0.5px;';
            resultsContainer.appendChild(userTitle);

            results.users.slice(0, 5).forEach(user => {
                const item = document.createElement('div');
                item.className = 'mini-result-item';
                const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;
                item.innerHTML = `
                    <img src="${avatar}" class="mini-result-avatar">
                    <div class="mini-result-info">
                        <span class="mini-result-name">${user.fullName}</span>
                        <span class="mini-result-username">@${user.username}</span>
                    </div>
                `;
                item.onclick = () => window.location.href = `profile.html?id=${user.id}`;
                resultsContainer.appendChild(item);
            });
        }

        // Render Posts
        if (results.posts.length > 0) {
            const postTitle = document.createElement('h4');
            postTitle.textContent = 'Bài viết';
            postTitle.style.cssText = 'font-size: 0.85rem; margin: 20px 0 12px; color: #8e8e8e; text-transform: uppercase; letter-spacing: 0.5px;';
            resultsContainer.appendChild(postTitle);

            results.posts.slice(0, 5).forEach(post => {
                const item = document.createElement('div');
                item.className = 'mini-result-item';
                const thumb = (post.imageUrls && post.imageUrls[0]) || post.featuredImageUrl || 'assets/no-image.png';
                item.innerHTML = `
                    <img src="${thumb}" class="mini-result-thumb">
                    <div class="mini-result-info">
                        <span class="mini-result-name">${post.authorName}</span>
                        <span class="mini-result-username">${post.content ? post.content.substring(0, 30) + '...' : 'Bài viết'}</span>
                    </div>
                `;
                item.onclick = () => window.location.href = `index.html#post-${post.id}`;
                resultsContainer.appendChild(item);
            });
        }
    } catch (err) {
        resultsContainer.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem; text-align:center;">Lỗi khi tìm kiếm.</p>';
    }
}


async function updateNav() {
    const navActions = document.getElementById('nav-actions');
    if (!navActions) return;

    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('auth_token');
    const currentLang = localStorage.getItem('zynk_lang') || 'vi';

    if (token && userInfo && userInfo !== 'null') {
        const userName = userInfo.fullName || userInfo.username || window.t('user');
        const userAvatar = (userInfo.avatarUrl && userInfo.avatarUrl !== 'null')
            ? userInfo.avatarUrl
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&color=fff`;

        // --- Admin Minimal Header ---
        if (userInfo.role === 'Admin') {
            navActions.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; padding: 5px 15px; background: rgba(99, 102, 241, 0.05); border-radius: 20px;">
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">Chào Admin, ${userName}</span>
                        <img src="${userAvatar}" class="mini-avatar" style="width:30px; height:30px; border: 2px solid #6366f1;">
                    </div>
                    <button onclick="logout(event)" class="btn secondary-btn" style="width:auto; margin:0; padding: 6px 15px; font-size: 0.85rem; border-radius: 10px;">
                        <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
                    </button>
                </div>
            `;
            return;
        }

        // --- Regular User Header ---
        // Update home page avatar if present
        const homeAvatar = document.getElementById('current-user-avatar');
        if (homeAvatar) homeAvatar.src = userAvatar;

        const langFlags = { 'vi': '🇻🇳', 'en': '🇺🇸', 'ja': '🇯🇵' };
        const currentFlag = langFlags[currentLang] || '🇻🇳';

        navActions.innerHTML = `
            <div class="header-search-container">
                <div class="search-bar">
                    <input type="text" id="header-search-input" data-i18n="search_placeholder" placeholder="${window.t('search_placeholder')}">
                    <button id="header-search-btn"><i class="fa fa-search"></i></button>
                </div>
            </div>
            
            <div class="header-tools">
                <div class="lang-switcher-wrapper" id="lang-trigger">
                    <span class="current-lang-flag">${currentFlag}</span>
                    <div class="lang-mini-dropdown hidden" id="lang-mini-dropdown">
                        <div onclick="window.changeLanguage('vi')">🇻🇳 Tiếng Việt</div>
                        <div onclick="window.changeLanguage('en')">🇺🇸 English</div>
                        <div onclick="window.changeLanguage('ja')">🇯🇵 日本語</div>
                    </div>
                </div>

                <div class="notification-wrapper" id="noti-trigger">
                    <i class="fa-solid fa-bell"></i>
                    <span class="noti-badge hidden" id="noti-count">0</span>
                    <div class="noti-dropdown hidden" id="noti-dropdown">
                        <div class="noti-header" data-i18n="notifications">${window.t('notifications')}</div>
                        <div id="noti-list"></div>
                        <div class="noti-footer"><a href="#" id="mark-all-read" data-i18n="mark_all_read">${window.t('mark_all_read')}</a></div>
                    </div>
                </div>
            </div>

            <div class="nav-direct-links">
                <a href="marketplace.html" class="nav-marketplace-link">
                    <i class="fa-solid fa-bag-shopping"></i> <span data-i18n="shopping">${window.t('shopping')}</span>
                </a>
                ${window._userHasShop ? `
                <a href="seller-center.html" class="nav-marketplace-link" style="color: #059669; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05);">
                    <i class="fa-solid fa-store"></i> <span data-i18n="seller_center">${window.t('seller_center')}</span>
                </a>` : ''}
            </div>

            <div class="user-menu" id="user-menu-trigger">
                <span class="user-name">${userName}</span>
                <img src="${userAvatar}" alt="Avatar" class="mini-avatar header-avatar" onerror="this.src='https://via.placeholder.com/40'">
                <div class="user-dropdown hidden" id="user-dropdown">
                    <a href="profile.html"><i class="fa fa-user"></i> <span data-i18n="profile">${window.t('profile')}</span></a>
                    <a href="marketplace.html" style="color: #2563eb; font-weight: 600;"><i class="fa fa-shopping-bag"></i> <span data-i18n="marketplace">${window.t('marketplace')}</span></a>
                    <a href="my-orders.html" style="color: #f59e0b; font-weight: 600;"><i class="fa-solid fa-box-open"></i> <span data-i18n="my_orders">${window.t('my_orders')}</span></a>
                    ${window._userHasShop ? `<a href="seller-center.html" style="color: #059669; font-weight: 600;"><i class="fa fa-store"></i> <span data-i18n="seller_center">${window.t('seller_center')}</span></a>` : ''}
                  
                    <hr>
                    ${(userInfo.role !== 'Admin' && userInfo.Role !== 'Admin') ? `<a href="create-post.html"><i class="fa fa-plus-circle"></i> <span data-i18n="post_new">${window.t('post_new')}</span></a>` : ''}
                    <a href="settings.html"><i class="fa fa-cog"></i> <span data-i18n="settings">${window.t('settings')}</span></a>
                    ${(userInfo.role === 'Admin' || userInfo.Role === 'Admin') ? `<a href="admin.html" style="color: #6366f1; font-weight: 600;"><i class="fa fa-user-shield"></i> <span data-i18n="admin_panel">${window.t('admin_panel')}</span></a>` : ''}
                    <hr>
                    <a href="#" onclick="logout(event)"><i class="fa fa-sign-out-alt"></i> <span data-i18n="logout">${window.t('logout')}</span></a>
                </div>
            </div>
        `;

        // Toggle dropdown
        const trigger = document.getElementById('user-menu-trigger');
        const dropdown = document.getElementById('user-dropdown');
        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', () => {
                dropdown.classList.add('hidden');
            });
        }

        // Language mini dropdown toggle
        const langTrigger = document.getElementById('lang-trigger');
        const langDropdown = document.getElementById('lang-mini-dropdown');
        if (langTrigger && langDropdown) {
            langTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                langDropdown.classList.toggle('hidden');
                if (dropdown) dropdown.classList.add('hidden');
            });
            document.addEventListener('click', () => {
                langDropdown.classList.add('hidden');
            });
        }

        // Dispatch update event for i18n
        window.dispatchEvent(new CustomEvent('navUpdated'));

        // Auto-fix missing ID in user_info
        if (!userInfo.id && !userInfo.Id && token) {
            window.api.get('auth/profile').then(profile => {
                userInfo.id = profile.id;
                localStorage.setItem('user_info', JSON.stringify(userInfo));
                console.log('User info normalized with ID');
            }).catch(err => console.error('Failed to normalize user info', err));
        }
    }
}

function logout(e) {
    if (e) e.preventDefault();
    if (e) e.stopPropagation();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    try {
        sessionStorage.removeItem('zynk_return_to');
        sessionStorage.removeItem('zynk_has_shop');
    } catch { /* ignore */ }
    window.location.href = 'auth.html';
}

// Utility to format dates based on language
function formatDate(dateString) {
    const lang = localStorage.getItem('zynk_lang') || 'vi';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    // Simple relative time
    if (diffInSeconds < 60) return lang === 'vi' ? 'Vừa xong' : 'Just now';
    if (diffInSeconds < 3600) {
        const mins = Math.floor(diffInSeconds / 60);
        return lang === 'vi' ? `${mins} phút trước` : `${mins}m ago`;
    }
    if (diffInSeconds < 86400) {
        const hrs = Math.floor(diffInSeconds / 3600);
        return lang === 'vi' ? `${hrs} giờ trước` : `${hrs}h ago`;
    }

    const locales = { 'vi': 'vi-VN', 'en': 'en-US', 'ja': 'ja-JP' };
    return date.toLocaleDateString(locales[lang] || 'vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Toast Notification System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 12px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 20002;
        box-shadow: 10px 0 30px rgba(0,0,0,0.05);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Utility to format currency (VND)
function formatCurrency(val) {
    const lang = localStorage.getItem('zynk_lang') || 'vi';
    const locales = { 'vi': 'vi-VN', 'en': 'en-US', 'ja': 'ja-JP' };
    return new Intl.NumberFormat(locales[lang] || 'vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Listen for language changes to update nav
window.addEventListener('languageChanged', () => {
    updateNav();
});

// Utility to auto-link URLs in text
function autoLink(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #0095f6; text-decoration: none;">${url}</a>`);
}

// Truncate text with Read More
function truncateText(text, limit = 120) {
    if (!text || text.length <= limit) return autoLink(text);
    
    const truncated = text.substring(0, limit);
    return `
        <span class="text-collapsed">${autoLink(truncated)}...</span>
        <span class="text-expanded hidden">${autoLink(text)}</span>
        <button class="read-more-btn" onclick="window.common.toggleReadMore(this)">Xem thêm</button>
    `;
}

function toggleReadMore(btn) {
    const parent = btn.parentElement;
    const collapsed = parent.querySelector('.text-collapsed');
    const expanded = parent.querySelector('.text-expanded');
    
    if (expanded.classList.contains('hidden')) {
        expanded.classList.remove('hidden');
        collapsed.classList.add('hidden');
        btn.textContent = 'Ẩn bớt';
    } else {
        expanded.classList.add('hidden');
        collapsed.classList.remove('hidden');
        btn.textContent = 'Xem thêm';
    }
}

async function openPostModalByPostId(postId) {
    try {
        const post = await window.api.get(`posts/${postId}`);
        if (window.openPostModal) window.openPostModal(post);
    } catch (e) {
        console.error("Failed to load post for modal", e);
    }
}

// Unified Post Card Creation (used in home.js, profile.js, search.js)
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'zynk-post-card animate-up';
    const postId = post.id || post.Id;
    const authorId = post.authorId || post.AuthorId;
    const authorName = post.authorName || post.AuthorName || 'Người dùng';
    const authorAvatarUrl = post.authorAvatarUrl || post.AuthorAvatarUrl;

    card.dataset.id = postId;
    card.id = `post-${postId}`;
    
    // Cache the post data for the modal
    window._postCache = window._postCache || {};
    window._postCache[postId] = post;


    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
    const currentId = (currentUser.id || currentUser.Id || '').toString();
    const isOwner = currentId && currentId === (authorId || '').toString();

    const images = [];
    if (post.imageUrls && post.imageUrls.length > 0) {
        images.push(...post.imageUrls);
    } else if (post.featuredImageUrl) {
        images.push(post.featuredImageUrl);
    }

    const hasImages = images.length > 0;
    const hasMultiple = images.length > 1;

    const avatarUrl = authorAvatarUrl
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'U')}&background=random&color=fff`;

    const menuItems = isOwner
        ? `<button onclick="location.href='edit-post.html?id=${postId}'"><i class="fa-solid fa-pen" style="margin-right:8px;"></i>Chỉnh sửa</button>
           <button class="delete" onclick="window.postActions.deletePost('${postId}')"><i class="fa-solid fa-trash" style="margin-right:8px;"></i>Xóa bài</button>`
        : `<button onclick="window.postActions.reportPost('${postId}', '${authorId}')"><i class="fa-solid fa-flag" style="margin-right:8px;"></i>Báo cáo</button>`;

    const postTime = formatDate(post.createdAt);
    const likeCount = post.likeCount || 0;
    const isLiked = post.isLikedByMe;

    if (!hasImages) {
        // ---- THREADS STYLE (Text-only post) ----
        card.classList.add('style-threads');
        card.innerHTML = `
            <div class="zynk-threads-layout">
                <div class="zynk-left">
                    <img src="${avatarUrl}" class="zynk-avatar" alt="${authorName}">
                    <div class="zynk-line"></div>
                </div>
                <div class="zynk-right">
                    <div class="zynk-header">
                        <div class="zynk-author-meta">
                            <a href="profile.html?id=${authorId}" class="zynk-author-name">${authorName}</a>
                            <span class="zynk-time">${postTime}</span>
                        </div>
                        <div class="zynk-options" onclick="window.common.toggleMenu(this)">
                            <i class="fa-solid fa-ellipsis"></i>
                            <div class="zynk-menu hidden">${menuItems}</div>
                        </div>
                    </div>
                    <div class="zynk-content">${truncateText(post.content || '')}</div>
                    <div class="zynk-actions">
                        <button class="${isLiked ? 'liked' : ''}" onclick="window.postActions.toggleLike('${postId}', this)">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        </button>
                        <button onclick="window.postActions.toggleComments('${postId}', this.closest('.zynk-post-card'))">
                            <i class="fa-regular fa-comment"></i>
                        </button>
                        <button onclick="window.common.openShareModal('${postId}')" style="margin-left:auto;">
                            <i class="fa-regular fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="zynk-stats">${likeCount > 0 ? likeCount + ' lượt thích' : ''}</div>
                </div>
            </div>
            <div class="comments-container" id="comments-${postId}"></div>
        `;
    } else {
        // ---- INSTAGRAM STYLE (Image post) ----
        card.classList.add('style-instagram');
        const carouselItems = images.map(url =>
            `<div class="zynk-carousel-item"><img src="${url}" alt="Ảnh bài viết" loading="lazy"></div>`
        ).join('');
        const dots = hasMultiple
            ? `<div class="zynk-dots">${images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>` : '';
        const navBtns = hasMultiple
            ? `<button class="carousel-nav left" onclick="event.stopPropagation(); window.common.scrollCarousel(this,-1)"><i class="fa-solid fa-chevron-left"></i></button>
               <button class="carousel-nav right" onclick="event.stopPropagation(); window.common.scrollCarousel(this,1)"><i class="fa-solid fa-chevron-right"></i></button>` : '';

        card.innerHTML = `
            <div class="zynk-header">
                <img src="${avatarUrl}" class="zynk-avatar-mini" alt="${authorName}">
                <a href="profile.html?id=${authorId}" class="zynk-author-name">${authorName}</a>
                <div class="zynk-options" onclick="window.common.toggleMenu(this)" style="margin-left:auto;">
                    <i class="fa-solid fa-ellipsis"></i>
                    <div class="zynk-menu hidden">${menuItems}</div>
                </div>
            </div>
            <div class="zynk-media-container" onclick="window.common.openPostModalByPostId('${postId}')" style="cursor:pointer;">
                ${navBtns}
                <div class="zynk-carousel" onscroll="window.common.handleCarouselScroll(this)">
                    ${carouselItems}
                </div>
                ${dots}
            </div>
            <div class="zynk-actions">
                <button class="${isLiked ? 'liked' : ''}" onclick="window.postActions.toggleLike('${postId}', this)">
                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
                <button onclick="window.postActions.toggleComments('${postId}', this.closest('.zynk-post-card'))">
                    <i class="fa-regular fa-comment"></i>
                </button>
                <button onclick="window.common.openShareModal('${postId}')" style="margin-left:auto;">
                    <i class="fa-regular fa-paper-plane"></i>
                </button>
            </div>
            <div class="zynk-body">
                <div class="zynk-stats">${likeCount > 0 ? likeCount + ' lượt thích' : ''}</div>
                <div class="zynk-caption">
                    <a href="profile.html?id=${authorId}" class="zynk-author-name">${authorName}</a>
                    ${truncateText(post.content || '')}
                </div>
                <span class="zynk-time">${postTime}</span>
            </div>
            <div class="comments-container" id="comments-${postId}"></div>
        `;
    }
    return card;
}



function toggleMenu(btn) {
    const menu = btn.querySelector('.zynk-menu');
    if (!menu) return;
    menu.classList.toggle('hidden');
    const close = (e) => {
        if (!btn.contains(e.target)) {
            menu.classList.add('hidden');
            document.removeEventListener('click', close);
        }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
}

window.openShareModal = async function(postId) {
    let modal = document.getElementById('share-post-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'share-post-modal';
        modal.className = 'share-modal-overlay hidden';
        modal.innerHTML = `
            <style>
            .share-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; align-items: center; justify-content: center; }
            .share-modal-overlay.hidden { display: none !important; }
            .share-modal-box { background: var(--bg-primary, #fff); border-radius: 16px; width: 400px; max-width: 90%; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
            .share-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #efefef); }
            .share-modal-header h3 { font-size: 1rem; font-weight: 700; margin: 0; color: var(--text-primary, #262626); }
            .share-modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary, #8e8e8e); line-height: 1; }
            .share-modal-body { overflow-y: auto; padding: 8px 0; }
            .share-user-item { display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.15s; }
            .share-user-item:hover { background: var(--bg-secondary, #f5f5f5); }
            .share-user-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
            .share-user-info { flex: 1; min-width: 0; }
            .share-user-name { font-size: 0.95rem; font-weight: 600; color: var(--text-primary, #262626); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .share-user-username { font-size: 0.8rem; color: var(--text-secondary, #8e8e8e); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .share-send-btn { background: #0095f6; color: #fff; border: none; padding: 6px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
            .share-send-btn:hover { background: #0081d6; }
            .dark-mode .share-modal-box { background: #1a1a2e; }
            .dark-mode .share-modal-header { border-bottom-color: #333; }
            .dark-mode .share-user-item:hover { background: #16213e; }
            .dark-mode .share-user-name { color: #fff; }
            </style>
            <div class="share-modal-box">
                <div class="share-modal-header">
                    <h3>Gửi bài viết đến...</h3>
                    <button class="share-modal-close" onclick="document.getElementById('share-post-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="share-modal-body" id="share-friends-list">
                    <div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.dataset.postId = postId;

    const list = document.getElementById('share-friends-list');
    list.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    try {
        const token = localStorage.getItem('auth_token');
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        const myId = userInfo.id || userInfo.Id;

        // Lấy danh sách đang theo dõi
        let res = await fetch(`${API_BASE_URL}/users/${myId}/following`, { headers: { 'Authorization': 'Bearer ' + token } });
        let usersToShare = [];
        if (res.ok) {
            usersToShare = await res.json();
        }

        // Nếu chưa theo dõi ai, lấy gợi ý
        if (usersToShare.length === 0) {
            let resSug = await fetch(`${API_BASE_URL}/users/suggested`, { headers: { 'Authorization': 'Bearer ' + token } });
            if (resSug.ok) {
                usersToShare = await resSug.json();
            }
        }

        if (usersToShare.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);"><p>Không tìm thấy người dùng nào để gửi.</p></div>';
            return;
        }

        // Lọc trùng lặp
        const uniqueUsers = Array.from(new Map(usersToShare.map(item => [item.id || item.Id, item])).values());

        list.innerHTML = uniqueUsers.map(u => `
            <div class="share-user-item" onclick="window.common.sendSharedPost('${u.id || u.Id}')">
                <img class="share-user-avatar" src="${u.avatarUrl || u.AvatarUrl || 'https://ui-avatars.com/api/?name=U'}" alt="Avatar">
                <div class="share-user-info">
                    <div class="share-user-name">${u.fullName || u.FullName || 'Người dùng'}</div>
                    <div class="share-user-username">@${u.username || u.Username || 'user'}</div>
                </div>
                <button class="share-send-btn">Gửi</button>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;"><p>Lỗi tải danh sách</p></div>';
    }
}

window.sendSharedPost = async function(userId) {
    const modal = document.getElementById('share-post-modal');
    const postId = modal.dataset.postId;
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE_URL}/messages/send`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipientId: userId,
                sharedPostId: postId
            })
        });
        if (res.ok) {
            alert('Đã chia sẻ bài viết!');
            modal.classList.add('hidden');
        } else {
            alert('Lỗi: Có thể bạn đã bị chặn hoặc không thể gửi tin nhắn.');
        }
    } catch(e) {
        alert('Lỗi gửi tin nhắn');
    }
}

function scrollCarousel(btn, dir) {
    const carousel = btn.parentElement.querySelector('.zynk-carousel');
    if (carousel) {
        const width = carousel.offsetWidth;
        carousel.scrollBy({ left: dir * width, behavior: 'smooth' });
    }
}

function handleCarouselScroll(carousel) {
    const idx = Math.round(carousel.scrollLeft / carousel.offsetWidth);
    const dots = carousel.parentElement.querySelectorAll('.zynk-dots .dot');
    dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
}

// Export to global scope
window.common = {
    formatDate,
    showToast,
    formatCurrency,
    createPostCard,
    toggleMenu,
    scrollCarousel,
    handleCarouselScroll,
    checkSellerStatus,
    requireAuth,
    autoLink,
    toggleReadMore,
    openPostModalByPostId,
    openShareModal: window.openShareModal,
    sendSharedPost: window.sendSharedPost
};

// Global shortcuts
window.formatDate = formatDate;
window.autoLink = autoLink;

// ─── Chat Unread Badge ────────────────────────────────────────────────────────
async function loadChatUnreadBadge() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
        const res = await fetch(window.API_BASE_URL + '/messages/unread-count', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return;
        const data = await res.json();
        const total = (data.count || 0) + (data.pendingCount || 0); // Count all unread for main badge
        const badge = document.getElementById('sidebar-msg-badge');
        const mobileBadge = document.getElementById('mth-msg-badge');
        
        const updateBadge = (el) => {
            if (!el) return;
            el.textContent = total > 99 ? '99+' : total;
            el.classList.toggle('hidden', total === 0);
        };

        updateBadge(badge);
        updateBadge(mobileBadge);
    } catch { /* silent fail */ }
}
window.loadChatUnreadBadge = loadChatUnreadBadge;

// ─── Global Chat Notifications (Realtime) ───────────────────────────────────
(function() {
    const token = localStorage.getItem('auth_token');
    if (!token || window.location.pathname.includes('messages.html')) return;

    // Load SignalR dynamically if not present
    if (typeof signalR === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js';
        script.onload = () => initGlobalChatSignalR();
        document.head.appendChild(script);
    } else {
        initGlobalChatSignalR();
    }

    async function initGlobalChatSignalR() {
        const hubUrl = window.API_BASE_URL.replace('/api', '') + '/hubs/chat';
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, { accessTokenFactory: () => token })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Error)
            .build();

        connection.on('ReceiveMessage', () => window.loadChatUnreadBadge());
        connection.on('MessageRequest', () => window.loadChatUnreadBadge());

        try {
            await connection.start();
            console.log('[GlobalChat] Realtime notifications active');
        } catch (err) {
            console.warn('[GlobalChat] Connection failed', err);
        }
    }
})();
// ─── Realtime Notifications Hub (Realtime) ──────────────────────────────────
(function() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Wait for SignalR to be loaded by the chat logic or load it if missing
    const checkSignalR = setInterval(() => {
        if (typeof signalR !== 'undefined') {
            clearInterval(checkSignalR);
            initNotificationHub();
        }
    }, 500);

    async function initNotificationHub() {
        const hubUrl = window.API_BASE_URL.replace('/api', '') + '/hubs/notification';
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, { accessTokenFactory: () => token })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Error)
            .build();

        connection.on("ReceiveNotification", (noti) => {
            console.log("[Notification] Received:", noti);
            updateNotificationBadges(noti.unreadCount);
            showNotificationToast(noti);
        });

        try {
            await connection.start();
            console.log('[NotificationHub] Connected');
            loadNotiUnreadBadge();
        } catch (err) {
            console.warn('[NotificationHub] Connection failed', err);
        }
    }
})();

function updateNotificationBadges(count) {
    const badges = document.querySelectorAll('#sidebar-noti-badge, #mth-noti-badge');
    badges.forEach(badge => {
        if (!badge) return;
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.toggle('hidden', count === 0);
    });
}

function showNotificationToast(noti) {
    // Create toast container if not exists
    let container = document.getElementById('noti-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'noti-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'noti-toast';
    toast.innerHTML = `
        <img src="${noti.actorAvatarUrl || 'https://ui-avatars.com/api/?name=U'}" class="noti-toast-avatar">
        <div class="noti-toast-content">
            <span class="noti-toast-user">${noti.actorName}</span>
            <span class="noti-toast-msg">${noti.message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Click to view
    toast.addEventListener('click', (e) => {
        console.log("[Notification] Toast clicked");
        clearTimeout(timer);
        window.location.href = 'notifications.html';
    });

    // Auto remove
    const timer = setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }
    }, 5000);
}

async function loadNotiUnreadBadge() {
    try {
        const data = await window.api.get('notifications/unread-count');
        updateNotificationBadges(data.count || 0);
    } catch { /* silent */ }
}
window.loadNotiUnreadBadge = loadNotiUnreadBadge;
// --- Push Notification Functions ---
async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push Notifications not supported');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Request permission if not granted
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    await subscribeToPush(registration);
                }
            } else if (Notification.permission === 'granted') {
                await subscribeToPush(registration);
            }
        } else {
            // Sync with backend in case the server lost the record
            await syncPushSubscription(subscription);
        }
    } catch (err) {
        console.error('Push Init Error:', err);
    }
}

async function subscribeToPush(registration) {
    const publicKey = 'BDkz2X8tYJlC9LMhpRWlAe10DmBQPSdoYJgyo-q9pxlsx_wGioY_mYl6AOilHSuEAqxUTF6_hLcvCzFgCPTUsgw';
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    
    try {
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });
        
        await syncPushSubscription(subscription);
        console.log('User is subscribed to Push Notifications');
    } catch (err) {
        console.error('Failed to subscribe to Push:', err);
    }
}

async function syncPushSubscription(subscription) {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const subJson = subscription.toJSON();
    const payload = {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
    };

    try {
        await fetch(API_BASE_URL + '/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Failed to sync push subscription with backend', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

window.initPushNotifications = initPushNotifications;
window.subscribeToPush = subscribeToPush;
