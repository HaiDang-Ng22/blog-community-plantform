// js/common.js

// Cache seller status in memory for the page session
window._userHasShop = false;

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
    // Global theme initialization
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    await checkSellerStatus();
    updateNav();
});

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

        // Search logic
        const searchInput = document.getElementById('header-search-input');
        const searchBtn = document.getElementById('header-search-btn');
        const triggerSearch = () => {
            const query = searchInput.value.trim();
            if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        };
        if (searchBtn) searchBtn.onclick = triggerSearch;
        if (searchInput) {
            searchInput.onkeypress = (e) => { if (e.key === 'Enter') triggerSearch(); };
        }

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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.reload();
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
        color: white;
        font-weight: 600;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
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

    // Regex to match URLs (http, https)
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // We should be careful to escape HTML first if the text is raw, 
    // but in Zynk we often insert as innerHTML, so we just replace the links.
    // Assuming the text is already safe or will be safely rendered.
    return text.replace(urlRegex, function (url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${url}</a>`;
    });
}

// Export to global scope
window.common = {
    formatDate,
    showToast,
    formatCurrency,
    autoLink
};
