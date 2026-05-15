/*
   settings-core.js - Optimized for modular settings
*/

// Use the global API_BASE_URL from api.js if available
const BASE_URL = window.API_BASE_URL || (window.location.origin.includes('localhost') ? 'http://localhost:7000/api' : '/api');

function initSettings() {
    console.log('[Settings] Core starting...');
    
    // Detect page type for mobile layout
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isHub = currentPage === 'index.html';
    document.body.classList.add(isHub ? 's-page-hub' : 's-page-detail');

    // Add back button for mobile if it's a detail page
    if (!isHub) {
        const header = document.querySelector('.s-header');
        if (header) {
            const backBtn = document.createElement('a');
            backBtn.href = 'index.html';
            backBtn.className = 's-back-btn';
            backBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Quay lại cài đặt';
            header.prepend(backBtn);
        }
    }

    // 1. Render Sidebar immediately
    renderSettingsSidebar();
    
    // 2. Load Data
    loadSettingsData();
}

function renderSettingsSidebar() {
    const sidebar = document.getElementById('s-sidebar');
    if (!sidebar) {
        console.error('[Settings] Sidebar element not found!');
        return;
    }

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const menu = [
        { label: 'CÀI ĐẶT CÁ NHÂN', type: 'header' },
        { id: 'profile', name: 'Hồ sơ cá nhân', icon: 'fa-user', url: 'profile.html' },
        { id: 'security', name: 'Bảo mật', icon: 'fa-shield-halved', url: 'security.html' },
        { id: 'privacy', name: 'Quyền riêng tư', icon: 'fa-lock', url: 'privacy.html' },
        { id: 'verification', name: 'Xác minh danh tính', icon: 'fa-certificate', url: 'verification.html' },
        { id: 'marketplace', name: 'Đăng ký bán hàng', icon: 'fa-store', url: '../seller-center.html' },
        { label: 'TRẢI NGHIỆM', type: 'header' },
        { id: 'notifications', name: 'Thông báo', icon: 'fa-bell', url: 'notifications.html' },
        { id: 'appearance', name: 'Giao diện', icon: 'fa-palette', url: 'appearance.html' },
        { label: 'KHÁC', type: 'header' },
        { id: 'danger', name: 'Vùng nguy hiểm', icon: 'fa-triangle-exclamation', url: 'danger.html', class: 'danger' }
    ];

    sidebar.innerHTML = menu.map(item => {
        if (item.type === 'header') return `<div class="s-menu-label">${item.label}</div>`;
        const isActive = currentPage === item.url ? 'active' : '';
        return `
            <a href="${item.url}" class="s-nav-item ${isActive} ${item.class || ''}">
                <i class="fa-solid ${item.icon}"></i>
                <span>${item.name}</span>
            </a>
        `;
    }).join('');

    // Update Marketplace status asynchronously
    updateSidebarMarketplaceStatus();
}

async function updateSidebarMarketplaceStatus() {
    const marketplaceItem = document.querySelector('a[href="../seller-center.html"]');
    if (!marketplaceItem || !window.api) return;

    try {
        // 1. Check if user is already a seller
        await window.api.get('seller/my-shop');
        marketplaceItem.querySelector('span').textContent = 'Kênh người bán';
        marketplaceItem.querySelector('i').className = 'fa-solid fa-shop-lock';
    } catch (err) {
        if (err.status === 404) {
            try {
                // 2. Check application status
                const app = await window.api.get('seller/application-status');
                if (app && app.status === 'Pending') {
                    marketplaceItem.querySelector('span').textContent = 'Đang chờ duyệt';
                    marketplaceItem.querySelector('i').className = 'fa-solid fa-clock-rotate-left';
                } else if (app && app.status === 'Rejected') {
                    marketplaceItem.querySelector('span').textContent = 'Đã bị từ chối';
                    marketplaceItem.querySelector('i').className = 'fa-solid fa-circle-exclamation';
                }
            } catch (e) {}
        }
    }
}

async function loadSettingsData() {
    console.log('[Settings] Loading data...');
    
    // 1. Try to get from localStorage first (Instant display like old settings)
    const cachedUser = localStorage.getItem('user_info');
    if (cachedUser) {
        try {
            const user = JSON.parse(cachedUser);
            console.log('[Settings] Using cached user data');
            if (typeof onSettingsLoad === 'function') {
                onSettingsLoad(user);
            }
        } catch (e) { console.error('Parse error', e); }
    }

    // 2. Then fetch fresh data from API
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
        const res = await fetch(`${BASE_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const user = await res.json();
            console.log('[Settings] Fresh data loaded from API');
            // Update cache
            localStorage.setItem('user_info', JSON.stringify(user));
            if (typeof onSettingsLoad === 'function') {
                onSettingsLoad(user);
            }
        }
    } catch (err) {
        console.error('[Settings] API load error:', err);
    }
}

// Global utility
function showSettingsStatus(msg, type = 'success') {
    const box = document.getElementById('settings-msg');
    if (box) {
        box.textContent = msg;
        box.className = `message-box ${type}`;
        box.classList.remove('hidden');
        setTimeout(() => box.classList.add('hidden'), 4000);
    } else {
        alert(msg);
    }
}

// REAL DEVICE DETECTION
async function detectCurrentDevice() {
    const userAgent = navigator.userAgent;
    let browser = "Trình duyệt";
    let os = "Thiết bị";

    // Browser detection
    if (userAgent.indexOf("Edg") > -1) browser = "Microsoft Edge";
    else if (userAgent.indexOf("Chrome") > -1) browser = "Google Chrome";
    else if (userAgent.indexOf("Safari") > -1) browser = "Safari";
    else if (userAgent.indexOf("Firefox") > -1) browser = "Mozilla Firefox";
    else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident/") > -1) browser = "Internet Explorer";

    // OS detection
    if (userAgent.indexOf("Windows NT 10.0") > -1) os = "Windows 10/11 PC";
    else if (userAgent.indexOf("Windows NT 6.2") > -1) os = "Windows 8 PC";
    else if (userAgent.indexOf("Mac") > -1) os = "Macintosh (macOS)";
    else if (userAgent.indexOf("Android") > -1) os = "Thiết bị Android";
    else if (userAgent.indexOf("iPhone") > -1) os = "iPhone (iOS)";
    else if (userAgent.indexOf("iPad") > -1) os = "iPad (iOS)";
    else if (userAgent.indexOf("Linux") > -1) os = "Linux PC";

    let location = "Việt Nam";
    let ip = "Đang tải IP...";
    let isp = "";

    try {
        // Use ipinfo.io for better accuracy in Vietnam
        const res = await fetch('https://ipinfo.io/json');
        if (res.ok) {
            const data = await res.json();
            const city = data.city || "";
            const region = data.region || "";
            location = city ? `${city}, ${region}` : region;
            ip = data.ip || "";
            isp = data.org ? ` (${data.org.split(' ').slice(1).join(' ')})` : "";
        }
    } catch (e) {
        location = "Vị trí ước tính";
    }

    return {
        deviceInfo: `${os} • ${browser}`,
        locationInfo: `${location}${isp} • ${ip}`,
        icon: os.includes("PC") || os.includes("Mac") ? "fa-laptop" : "fa-mobile-screen-button"
    };
}

// Render sessions (Real + Mocks for demo)
async function renderRealSessions() {
    const container = document.getElementById('session-list');
    if (!container) return;

    const current = await detectCurrentDevice();
    
    container.innerHTML = `
        <!-- Current Device -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 1.25rem; border: 1px solid var(--s-border); border-radius: 12px; background: rgba(99,102,241,0.02);">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: var(--s-primary);">
                    <i class="fa-solid ${current.icon}" style="font-size: 1.5rem;"></i>
                </div>
                <div>
                    <div style="font-weight: 700; color: var(--s-text-main);">${current.deviceInfo}</div>
                    <div style="font-size: 0.85rem; color: var(--s-text-muted);">${current.locationInfo}</div>
                    <div style="font-size: 0.75rem; margin-top: 4px; color: #10b981; font-weight: 600;">
                        <i class="fa-solid fa-circle-check"></i> Đang hoạt động • Thiết bị này
                    </div>
                </div>
            </div>
        </div>

        <!-- Placeholder for other sessions -->
        <p style="font-size: 0.8rem; color: var(--s-text-muted); margin-top: 1rem; text-align: center;">Hệ thống chỉ ghi nhận các phiên đăng nhập từ trình duyệt hiện tại.</p>
    `;
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initSettings();
        if (window.location.pathname.includes('security.html')) renderRealSessions();
    });
} else {
    initSettings();
    if (window.location.pathname.includes('security.html')) renderRealSessions();
}
