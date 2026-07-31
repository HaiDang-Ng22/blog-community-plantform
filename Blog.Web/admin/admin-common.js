// Shared admin shell, navigation and interaction system.
(function () {
    'use strict';

    const pages = [
        { section: 'Tổng quan', href: 'index.html', icon: 'fa-chart-pie', label: 'Bảng điều khiển', hint: 'Thống kê hệ thống' },
        { section: 'Cộng đồng', href: 'users.html', icon: 'fa-users', label: 'Người dùng', hint: 'Tài khoản & vai trò' },
        { section: 'Cộng đồng', href: 'reports.html', icon: 'fa-flag', label: 'Báo cáo vi phạm', hint: 'Kiểm duyệt nội dung', badge: 'badge-reports' },
        { section: 'Cộng đồng', href: 'verifications.html', icon: 'fa-circle-check', label: 'Duyệt tích xanh', hint: 'Xác minh danh tính', badge: 'badge-verifications' },
        { section: 'Cộng đồng', href: 'banned-words.html', icon: 'fa-shield-halved', label: 'Từ khóa cấm', hint: 'An toàn cộng đồng' },
        { section: 'Thương mại', href: 'shops.html', icon: 'fa-shop', label: 'Cửa hàng', hint: 'Duyệt & vận hành shop', badge: 'badge-shops' },
        { section: 'Thương mại', href: 'categories.html', icon: 'fa-layer-group', label: 'Danh mục', hint: 'Cấu trúc ngành hàng' },
        { section: 'Thương mại', href: 'auctions.html', icon: 'fa-gavel', label: 'Đấu giá', hint: 'Phiên & yêu cầu' },
        { section: 'Tăng trưởng', href: 'banners.html', icon: 'fa-panorama', label: 'Banner', hint: 'Nội dung quảng bá' },
        { section: 'Tăng trưởng', href: 'vouchers.html', icon: 'fa-ticket', label: 'Voucher', hint: 'Khuyến mãi hệ thống' }
    ];

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    let badgeTimer = null;
    let commandItems = [];
    let commandIndex = 0;

    window.adminApi = window.api;

    function getUserInfo() {
        try {
            return JSON.parse(localStorage.getItem('user_info') || '{}');
        } catch {
            return {};
        }
    }

    function checkAuth() {
        const token = localStorage.getItem('auth_token');
        const userInfo = getUserInfo();
        const role = String(userInfo.role || userInfo.Role || '').toLowerCase();

        if (!token || role !== 'admin') {
            const target = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.replace(`../auth.html?returnUrl=${target}`);
            return false;
        }
        return true;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    window.adminEscapeHtml = escapeHtml;

    window.adminSafeUrl = function adminSafeUrl(value, fallback = '') {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
        } catch {
            return fallback;
        }
    };

    function groupedNavigation() {
        let lastSection = '';
        return pages.map(page => {
            const section = page.section !== lastSection
                ? `<div class="nav-section-label">${page.section}</div>`
                : '';
            lastSection = page.section;
            const active = page.href === currentPage ? ' active' : '';
            const badge = page.badge ? `<span id="${page.badge}" class="admin-badge hidden">0</span>` : '';
            return `${section}
                <a href="${page.href}" class="nav-item${active}" title="${page.label}">
                    <i class="fa-solid ${page.icon}"></i>
                    <span>${page.label}</span>${badge}
                </a>`;
        }).join('');
    }

    function injectShell() {
        const user = getUserInfo();
        const fullName = user.fullName || user.FullName || user.username || 'Quản trị viên';
        const initials = fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'AD';
        const current = pages.find(page => page.href === currentPage) || pages[0];

        document.body.classList.add('admin-body');
        if (localStorage.getItem('admin_sidebar_collapsed') === 'true' && window.innerWidth >= 1024) {
            document.body.classList.add('admin-sidebar-collapsed');
        }

        document.body.insertAdjacentHTML('afterbegin', `
            <aside class="admin-sidebar" aria-label="Điều hướng quản trị">
                <div class="sidebar-header">
                    <div class="sidebar-logo" aria-hidden="true">Z</div>
                    <div class="sidebar-brand">
                        <span class="sidebar-title">Zynk Admin</span>
                        <span class="sidebar-subtitle">Control center</span>
                    </div>
                    <button class="sidebar-collapse" type="button" aria-label="Thu gọn thanh điều hướng">
                        <i class="fa-solid fa-angles-left"></i>
                    </button>
                </div>
                <nav class="sidebar-nav">${groupedNavigation()}</nav>
                <div class="sidebar-footer">
                    <a href="../index.html" class="nav-item" title="Trở về Zynk">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i><span>Trở về Zynk</span>
                    </a>
                    <button type="button" class="nav-item" id="admin-logout" style="width:100%; border:0; background:transparent; color:#ff8998;">
                        <i class="fa-solid fa-right-from-bracket"></i><span>Đăng xuất</span>
                    </button>
                </div>
            </aside>
            <div class="admin-sidebar-backdrop" aria-hidden="true"></div>
        `);

        const main = document.querySelector('.admin-main');
        if (!main) return;
        main.insertAdjacentHTML('afterbegin', `
            <div class="admin-topbar">
                <div class="admin-topbar-start">
                    <button class="admin-icon-btn admin-mobile-menu" type="button" aria-label="Mở menu">
                        <i class="fa-solid fa-bars-staggered"></i>
                    </button>
                    <div class="admin-context">
                        <strong>${escapeHtml(current.label)}</strong>
                        <span>${escapeHtml(current.hint)}</span>
                    </div>
                </div>
                <div class="admin-topbar-actions">
                    <button class="admin-search-trigger" type="button" aria-label="Tìm kiếm nhanh">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <span>Tìm chức năng quản trị</span>
                        <kbd>Ctrl K</kbd>
                    </button>
                    <button class="admin-icon-btn admin-theme-toggle" type="button" aria-label="Đổi giao diện sáng tối">
                        <i class="fa-solid ${document.documentElement.classList.contains('dark-mode-root') ? 'fa-sun' : 'fa-moon'}"></i>
                    </button>
                    <div class="admin-user-chip" title="${escapeHtml(fullName)}">
                        <div class="admin-user-avatar">${escapeHtml(initials)}</div>
                        <div><strong>${escapeHtml(fullName)}</strong><span>Quản trị viên</span></div>
                    </div>
                </div>
            </div>
        `);

        document.querySelector('.sidebar-collapse')?.addEventListener('click', toggleSidebar);
        document.querySelector('.admin-mobile-menu')?.addEventListener('click', openMobileNav);
        document.querySelector('.admin-sidebar-backdrop')?.addEventListener('click', closeMobileNav);
        document.querySelector('.admin-search-trigger')?.addEventListener('click', openCommandPalette);
        document.querySelector('.admin-theme-toggle')?.addEventListener('click', toggleTheme);
        document.getElementById('admin-logout')?.addEventListener('click', adminLogout);

        document.querySelectorAll('.admin-sidebar .nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth < 1024) closeMobileNav();
            });
        });
    }

    function toggleSidebar() {
        if (window.innerWidth < 1024) {
            closeMobileNav();
            return;
        }
        document.body.classList.toggle('admin-sidebar-collapsed');
        const collapsed = document.body.classList.contains('admin-sidebar-collapsed');
        localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
        const icon = document.querySelector('.sidebar-collapse i');
        if (icon) icon.className = `fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`;
        window.dispatchEvent(new Event('resize'));
    }

    function openMobileNav() {
        document.body.classList.add('admin-mobile-nav-open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileNav() {
        document.body.classList.remove('admin-mobile-nav-open');
        document.body.style.overflow = '';
    }

    function toggleTheme() {
        const isDark = !document.documentElement.classList.contains('dark-mode-root');
        const theme = isDark ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark-mode-root', isDark);
        document.documentElement.style.colorScheme = theme;
        document.body.classList.toggle('dark-mode', isDark);
        const icon = document.querySelector('.admin-theme-toggle i');
        if (icon) icon.className = `fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`;
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
        window.adminToast(isDark ? 'Đã bật giao diện tối' : 'Đã bật giao diện sáng', 'info');
    }

    function adminLogout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.replace('../auth.html');
    }

    function createModal() {
        let modal = document.getElementById('admin-global-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'admin-global-modal';
        modal.className = 'admin-modal-backdrop hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.addEventListener('click', event => {
            if (event.target === modal) window.adminModal.close();
        });
        document.body.appendChild(modal);
        return modal;
    }

    window.adminModal = {
        open(html, options = {}) {
            const modal = createModal();
            modal.innerHTML = `
                <div class="admin-modal-panel ${options.className || ''}">
                    <button class="admin-modal-close" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
                    <div class="admin-modal-content">${html}</div>
                </div>`;
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            modal.querySelector('.admin-modal-close')?.addEventListener('click', () => window.adminModal.close());
            requestAnimationFrame(() => modal.querySelector('input, select, textarea, button:not(.admin-modal-close)')?.focus());
        },
        close() {
            const modal = document.getElementById('admin-global-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.innerHTML = '';
            document.body.style.overflow = document.body.classList.contains('admin-mobile-nav-open') ? 'hidden' : '';
        }
    };

    function openCommandPalette() {
        const items = pages.map(page => `
            <button type="button" class="admin-command-item" data-href="${page.href}" data-search="${escapeHtml(`${page.label} ${page.hint} ${page.section}`.toLowerCase())}">
                <i class="fa-solid ${page.icon}"></i>
                <span><strong>${page.label}</strong><br><small>${page.hint}</small></span>
                <small>${page.section}</small>
            </button>`).join('');
        window.adminModal.open(`
            <div class="admin-command-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="admin-command-input" type="search" placeholder="Nhập tên chức năng..." autocomplete="off">
            </div>
            <div class="admin-command-list">${items}</div>
        `, { className: 'admin-command-panel' });

        const input = document.getElementById('admin-command-input');
        commandItems = Array.from(document.querySelectorAll('.admin-command-item'));
        commandIndex = 0;
        markCommandSelection();

        input?.addEventListener('input', () => {
            const query = input.value.toLowerCase().trim();
            commandItems.forEach(item => item.classList.toggle('hidden', !item.dataset.search.includes(query)));
            commandIndex = 0;
            markCommandSelection();
        });

        input?.addEventListener('keydown', event => {
            const visible = commandItems.filter(item => !item.classList.contains('hidden'));
            if (!visible.length) return;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                commandIndex = (commandIndex + 1) % visible.length;
                markCommandSelection();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                commandIndex = (commandIndex - 1 + visible.length) % visible.length;
                markCommandSelection();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                visible[commandIndex]?.click();
            }
        });

        commandItems.forEach(item => item.addEventListener('click', () => {
            window.location.href = item.dataset.href;
        }));
    }

    function markCommandSelection() {
        const visible = commandItems.filter(item => !item.classList.contains('hidden'));
        commandItems.forEach(item => item.classList.remove('is-selected'));
        visible[commandIndex]?.classList.add('is-selected');
    }

    window.adminToast = function adminToast(message, type = 'success', timeout = 3600) {
        let stack = document.querySelector('.admin-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'admin-toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }
        const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span><button type="button" aria-label="Đóng">&times;</button>`;
        stack.appendChild(toast);
        const close = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(12px)';
            setTimeout(() => toast.remove(), 180);
        };
        toast.querySelector('button')?.addEventListener('click', close);
        setTimeout(close, timeout);
        return toast;
    };

    function installFriendlyAlerts() {
        window.alert = message => {
            const text = String(message || 'Đã hoàn tất thao tác.');
            const type = /lỗi|không thể|thất bại/i.test(text) ? 'error' : 'success';
            window.adminToast(text, type);
        };
    }

    function setBadge(id, count) {
        const badge = document.getElementById(id);
        if (!badge) return;
        const value = Number(count) || 0;
        badge.textContent = value > 99 ? '99+' : String(value);
        badge.classList.toggle('hidden', value <= 0);
    }

    window.updateAdminBadges = async function updateAdminBadges() {
        if (document.hidden || !window.adminApi) return;
        const results = await Promise.allSettled([
            window.adminApi.get('admin/stats'),
            window.adminApi.get('admin/verifications/pending-count')
        ]);
        if (results[0].status === 'fulfilled') {
            setBadge('badge-reports', results[0].value.pendingReports);
            setBadge('badge-shops', results[0].value.pendingShops);
        }
        if (results[1].status === 'fulfilled') {
            setBadge('badge-verifications', results[1].value.count);
        }
    };

    function scheduleBadges() {
        clearTimeout(badgeTimer);
        if (!document.hidden) {
            window.updateAdminBadges();
            badgeTimer = setTimeout(scheduleBadges, 60000);
        }
    }

    function enhanceTables(root = document) {
        root.querySelectorAll('.data-table, .table').forEach(table => {
            const labels = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
            table.querySelectorAll('tbody tr').forEach(row => {
                Array.from(row.children).forEach((cell, index) => {
                    if (!cell.hasAttribute('data-label') && labels[index]) cell.setAttribute('data-label', labels[index]);
                    const text = cell.textContent.trim().toLowerCase();
                    if (cell.hasAttribute('colspan') && /đang tải|chưa có|không có|lỗi/.test(text)) {
                        cell.classList.add('admin-empty-state');
                    }
                });
            });
        });
        enhanceTableToolbars(root);
        root.querySelectorAll('img:not([loading])').forEach(image => {
            image.loading = 'lazy';
            image.decoding = 'async';
        });
    }

    function enhanceTableToolbars(root = document) {
        root.querySelectorAll('.data-table-wrap').forEach((wrap, index) => {
            const table = wrap.querySelector('.data-table, .table');
            if (!table) return;
            let toolbar = wrap.previousElementSibling;
            if (!toolbar?.classList.contains('admin-table-toolbar')) {
                toolbar = document.createElement('div');
                toolbar.className = 'admin-table-toolbar';
                toolbar.innerHTML = `
                    <label class="admin-table-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="search" placeholder="Lọc dữ liệu trong bảng..." aria-label="Lọc dữ liệu">
                    </label>
                    <span class="admin-table-count">0 mục</span>
                    <button type="button" class="btn btn-secondary admin-export-table"><i class="fa-solid fa-file-arrow-down"></i> Xuất CSV</button>`;
                wrap.parentNode.insertBefore(toolbar, wrap);
                const search = toolbar.querySelector('input');
                let searchTimer;
                search.addEventListener('input', () => {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => filterTable(table, search.value, toolbar), 120);
                });
                toolbar.querySelector('.admin-export-table').addEventListener('click', () => exportTable(table, index));
            }
            updateTableCount(table, toolbar);
        });
    }

    function filterTable(table, query, toolbar) {
        const normalized = query.toLocaleLowerCase('vi').trim();
        table.querySelectorAll('tbody tr').forEach(row => {
            if (row.querySelector('[colspan]')) return;
            row.classList.toggle('hidden', normalized && !row.textContent.toLocaleLowerCase('vi').includes(normalized));
        });
        updateTableCount(table, toolbar);
    }

    function updateTableCount(table, toolbar) {
        const rows = Array.from(table.querySelectorAll('tbody tr')).filter(row =>
            !row.classList.contains('hidden') && !row.querySelector('[colspan]'));
        const count = toolbar?.querySelector('.admin-table-count');
        if (count) count.textContent = `${rows.length} mục`;
    }

    function exportTable(table, index) {
        const rows = Array.from(table.querySelectorAll('tr')).filter(row => !row.classList.contains('hidden'));
        if (rows.length <= 1) {
            window.adminToast('Không có dữ liệu để xuất.', 'warning');
            return;
        }
        const csv = rows.map(row => Array.from(row.children).map(cell =>
            `"${cell.textContent.trim().replaceAll('"', '""')}"`).join(',')).join('\r\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `zynk-admin-${currentPage.replace('.html', '')}-${new Date().toISOString().slice(0, 10)}-${index + 1}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        window.adminToast('Đã xuất dữ liệu CSV.', 'success');
    }

    function observeDynamicContent() {
        let queued = false;
        const observer = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                enhanceTables();
                queued = false;
            });
        });
        observer.observe(document.querySelector('.admin-main') || document.body, { childList: true, subtree: true });
    }

    function handleShortcuts(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openCommandPalette();
        }
        if (event.key === 'Escape') {
            if (document.body.classList.contains('admin-mobile-nav-open')) closeMobileNav();
            else window.adminModal.close();
        }
    }

    function initialize() {
        injectShell();
        installFriendlyAlerts();
        enhanceTables();
        observeDynamicContent();
        scheduleBadges();
        document.addEventListener('visibilitychange', scheduleBadges);
        document.addEventListener('keydown', handleShortcuts);
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) closeMobileNav();
        }, { passive: true });
        window.addEventListener('unhandledrejection', event => {
            if (isLocal) console.error('Admin unhandled rejection:', event.reason);
            window.adminToast(event.reason?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
        });
        requestAnimationFrame(() => document.body.classList.add('admin-ready'));
    }

    if (!checkAuth()) return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
