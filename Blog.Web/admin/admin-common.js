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
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    let badgeTimer = null;
    let commandItems = [];
    let commandIndex = 0;
    let adminAiBusy = false;
    const adminAiActions = new Map();

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
                    <button class="admin-ai-topbar-trigger" type="button" aria-label="Mở Admin AI Copilot">
                        <span class="admin-ai-spark"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
                        <span>Admin AI</span>
                    </button>
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
        document.querySelector('.admin-ai-topbar-trigger')?.addEventListener('click', toggleAdminAi);
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

    function createAdminAiPanel() {
        let panel = document.getElementById('admin-ai-panel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'admin-ai-panel';
        panel.className = 'admin-ai-panel';
        panel.setAttribute('aria-label', 'Admin AI Copilot');
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = `
            <header class="admin-ai-header">
                <div class="admin-ai-brand">
                    <span class="admin-ai-orb"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
                    <span><strong>Admin AI Copilot</strong><small>Trợ lý vận hành an toàn</small></span>
                </div>
                <div class="admin-ai-header-actions">
                    <button type="button" class="admin-ai-icon-button" data-ai-minimize title="Thu gọn AI Copilot" aria-label="Thu gọn AI Copilot"><i class="fa-solid fa-window-minimize"></i></button>
                    <button type="button" class="admin-ai-icon-button" data-ai-clear title="Xóa cuộc trò chuyện" aria-label="Xóa cuộc trò chuyện"><i class="fa-solid fa-broom"></i></button>
                    <button type="button" class="admin-ai-icon-button" data-ai-close aria-label="Đóng Admin AI"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </header>
            <div class="admin-ai-safety">
                <i class="fa-solid fa-shield-halved"></i>
                <span>AI chỉ dùng các tác vụ được cho phép. Mọi thay đổi dữ liệu đều cần bạn xác nhận.</span>
            </div>
            <div class="admin-ai-messages" aria-live="polite">
                <div class="admin-ai-message assistant">
                    <span class="admin-ai-message-avatar"><i class="fa-solid fa-sparkles"></i></span>
                    <div class="admin-ai-bubble">
                        Xin chào! Mình có thể kiểm tra hệ thống, lọc báo cáo, quản lý danh mục và từ khóa cấm.
                    </div>
                </div>
            </div>
            <div class="admin-ai-suggestions">
                <button type="button" data-ai-prompt="Tổng hợp tình trạng hệ thống"><i class="fa-solid fa-chart-pie"></i> Tổng hợp hệ thống</button>
                <button type="button" data-ai-prompt="Kiểm tra các báo cáo vi phạm chưa xử lý"><i class="fa-solid fa-flag"></i> Kiểm tra báo cáo</button>
                <button type="button" data-ai-prompt="Liệt kê các danh mục chưa có sản phẩm"><i class="fa-solid fa-folder-open"></i> Danh mục trống</button>
                <button type="button" data-ai-prompt="Quét các bài viết gần đây theo danh sách từ khóa cấm"><i class="fa-solid fa-shield"></i> Quét nội dung</button>
            </div>
            <div id="admin-ai-cat-chips-bar" class="admin-ai-cat-chips-bar hidden"></div>
            <form class="admin-ai-composer">
                <textarea id="admin-ai-input" rows="1" maxlength="1200" placeholder="Ví dụ: Tạo danh mục “Phụ kiện máy ảnh” trong “Máy ảnh”..."></textarea>
                <button type="submit" class="admin-ai-send" aria-label="Gửi yêu cầu"><i class="fa-solid fa-arrow-up"></i></button>
            </form>
            <div class="admin-ai-footer"><span>Gemini</span> hỗ trợ lập kế hoạch · Admin quyết định thực thi</div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('[data-ai-close]').addEventListener('click', () => toggleAdminAi(false));
        panel.querySelector('[data-ai-minimize]')?.addEventListener('click', () => toggleAdminAiMinimize());
        panel.querySelector('[data-ai-clear]').addEventListener('click', clearAdminAi);
        panel.querySelector('.admin-ai-composer').addEventListener('submit', event => {
            event.preventDefault();
            submitAdminAi();
        });
        panel.querySelectorAll('[data-ai-prompt]').forEach(button => button.addEventListener('click', () => {
            const input = document.getElementById('admin-ai-input');
            input.value = button.dataset.aiPrompt;
            submitAdminAi();
        }));
        panel.addEventListener('click', handleAdminAiClick);
        panel.querySelector('textarea').addEventListener('input', event => {
            event.target.style.height = 'auto';
            event.target.style.height = `${Math.min(event.target.scrollHeight, 110)}px`;
        });
        panel.querySelector('textarea').addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                panel.querySelector('.admin-ai-composer').requestSubmit();
            }
        });
        return panel;
    }

    window.updateAdminAiCategoryChips = function (categories) {
        createAdminAiPanel();
        const bar = document.getElementById('admin-ai-cat-chips-bar');
        if (!bar) return;
        if (!Array.isArray(categories) || !categories.length) {
            bar.classList.add('hidden');
            return;
        }
        const items = categories.slice(0, 10);
        bar.innerHTML = `
            <span><i class="fa-solid fa-wand-magic-sparkles"></i> Gợi ý mục con cho:</span>
            ${items.map(cat => `
                <button type="button" class="admin-ai-cat-chip" data-ai-cat-suggest="${escapeHtml(cat.name)}">
                    <i class="fa-solid ${safeAiIcon(cat.icon)}"></i> ${escapeHtml(cat.name)}
                </button>`).join('')}
        `;
        bar.classList.remove('hidden');
        bar.querySelectorAll('[data-ai-cat-suggest]').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.aiCatSuggest;
                const input = document.getElementById('admin-ai-input');
                if (input) {
                    input.value = `Gợi ý các danh mục con cho "${name}"`;
                    submitAdminAi();
                }
            });
        });
    };

    function toggleAdminAi(force) {
        const panel = createAdminAiPanel();
        const shouldOpen = typeof force === 'boolean' ? force : !document.body.classList.contains('admin-ai-open');
        document.body.classList.toggle('admin-ai-open', shouldOpen);
        panel.setAttribute('aria-hidden', String(!shouldOpen));
        document.querySelector('.admin-ai-topbar-trigger')?.classList.toggle('active', shouldOpen);
        if (!shouldOpen) toggleAdminAiMinimize(false);
        if (shouldOpen && !panel.classList.contains('minimized')) setTimeout(() => document.getElementById('admin-ai-input')?.focus(), 180);
    }

    function toggleAdminAiMinimize(force) {
        const panel = createAdminAiPanel();
        const isMinimized = typeof force === 'boolean' ? force : !panel.classList.contains('minimized');
        panel.classList.toggle('minimized', isMinimized);
        document.body.classList.toggle('admin-ai-minimized', isMinimized);
        const minIcon = panel.querySelector('[data-ai-minimize] i');
        if (minIcon) {
            minIcon.className = `fa-solid ${isMinimized ? 'fa-expand' : 'fa-window-minimize'}`;
        }
    }

    window.toggleAdminAiMinimize = toggleAdminAiMinimize;

    function clearAdminAi() {
        adminAiActions.clear();
        const messages = document.querySelector('.admin-ai-messages');
        if (!messages) return;
        messages.innerHTML = `
            <div class="admin-ai-message assistant">
                <span class="admin-ai-message-avatar"><i class="fa-solid fa-sparkles"></i></span>
                <div class="admin-ai-bubble">Cuộc trò chuyện đã được làm mới. Bạn muốn mình hỗ trợ tác vụ nào?</div>
            </div>`;
    }

    function appendAdminAiMessage(role, html) {
        const messages = document.querySelector('.admin-ai-messages');
        if (!messages) return null;
        const wrapper = document.createElement('div');
        wrapper.className = `admin-ai-message ${role}`;
        wrapper.innerHTML = role === 'assistant'
            ? `<span class="admin-ai-message-avatar"><i class="fa-solid fa-sparkles"></i></span><div class="admin-ai-bubble">${html}</div>`
            : `<div class="admin-ai-bubble">${html}</div>`;
        messages.appendChild(wrapper);
        messages.scrollTop = messages.scrollHeight;
        return wrapper;
    }

    function setAdminAiBusy(value) {
        adminAiBusy = value;
        const button = document.querySelector('.admin-ai-send');
        const input = document.getElementById('admin-ai-input');
        if (button) {
            button.disabled = value;
            button.innerHTML = value
                ? '<i class="fa-solid fa-spinner fa-spin"></i>'
                : '<i class="fa-solid fa-arrow-up"></i>';
        }
        if (input) input.disabled = value;
    }

    async function submitAdminAi() {
        if (adminAiBusy) return;
        const input = document.getElementById('admin-ai-input');
        const message = input?.value.trim();
        if (!message) return;
        toggleAdminAi(true);
        appendAdminAiMessage('user', escapeHtml(message));
        input.value = '';
        input.style.height = 'auto';
        setAdminAiBusy(true);
        const thinking = appendAdminAiMessage('assistant', '<span class="admin-ai-thinking"><i></i><i></i><i></i> Đang phân tích dữ liệu và lập kế hoạch...</span>');
        try {
            const plan = await window.adminApi.post('admin/ai/plan', { message });
            thinking?.remove();
            renderAdminAiPlan(plan);
        } catch (error) {
            thinking?.remove();
            appendAdminAiMessage('assistant', `<span class="admin-ai-error"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(error.message || 'Admin AI chưa thể xử lý yêu cầu này.')}</span>`);
        } finally {
            setAdminAiBusy(false);
            document.getElementById('admin-ai-input')?.focus();
        }
    }

    function renderAdminAiPlan(plan) {
        const actions = Array.isArray(plan.actions) ? plan.actions : [];
        actions.forEach(action => adminAiActions.set(action.id, action));
        const actionHtml = actions.length ? `
            <div class="admin-ai-plan">
                ${actions.map(action => {
                    const riskClass = action.risk === 'destructive' ? 'danger' : action.risk === 'write' ? 'write' : 'read';
                    const riskLabel = action.risk === 'destructive' ? 'Rủi ro cao' : action.risk === 'write' ? 'Thay đổi dữ liệu' : 'Chỉ đọc';
                    return `
                        <article class="admin-ai-action ${riskClass}">
                            <div class="admin-ai-action-icon"><i class="fa-solid ${actionIcon(action.type)}"></i></div>
                            <div class="admin-ai-action-copy">
                                <div><strong>${escapeHtml(action.title)}</strong><span class="admin-ai-risk">${riskLabel}</span></div>
                                <p>${escapeHtml(action.description)}</p>
                            </div>
                            <button type="button" data-ai-action="${escapeHtml(action.id)}">
                                ${action.requiresConfirmation ? 'Xem & xác nhận' : 'Thực hiện'}
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </article>`;
                }).join('')}
            </div>` : '';
        appendAdminAiMessage('assistant', `<p>${escapeHtml(plan.reply || 'Mình đã chuẩn bị kế hoạch.')}</p>${actionHtml}`);
    }

    function actionIcon(type) {
        if (type.includes('categor')) return 'fa-layer-group';
        if (type.includes('report')) return 'fa-flag';
        if (type.includes('banned') || type.includes('scan')) return 'fa-shield-halved';
        if (type === 'navigate') return 'fa-arrow-up-right-from-square';
        return 'fa-chart-pie';
    }

    function handleAdminAiClick(event) {
        const actionButton = event.target.closest('[data-ai-action]');
        if (actionButton) {
            const action = adminAiActions.get(actionButton.dataset.aiAction);
            if (!action) return;
            if (action.requiresConfirmation) confirmAdminAiAction(action, actionButton);
            else executeAdminAiAction(action, false, actionButton);
        }
        const navButton = event.target.closest('[data-ai-navigate]');
        if (navButton) window.location.href = navButton.dataset.aiNavigate;
        const refreshButton = event.target.closest('[data-ai-refresh]');
        if (refreshButton) window.location.reload();
    }

    function safeAiIcon(icon) {
        const v = String(icon || '').trim();
        return /^fa-[a-z0-9-]+$/i.test(v) ? v : 'fa-tag';
    }

    function renderActionPreview(action) {
        const params = action.parameters || {};
        const isCategoryAction = action.type && action.type.toLowerCase().includes('categor');
        if (isCategoryAction) {
            const cats = Array.isArray(params.categories) ? params.categories
                : Array.isArray(params.items) ? params.items : [];
            if (cats.length) {
                return `
                    <div class="admin-ai-preview-header">
                        <i class="fa-solid fa-layer-group"></i>
                        <span>${cats.length} danh mục sẽ được tạo</span>
                    </div>
                    <div class="admin-ai-preview-list">
                        ${cats.map(cat => `
                            <div class="admin-ai-preview-item">
                                <span class="admin-ai-preview-item-icon">
                                    <i class="fa-solid ${safeAiIcon(cat.icon)}"></i>
                                </span>
                                <div class="admin-ai-preview-item-info">
                                    <strong>${escapeHtml(cat.name || '—')}</strong>
                                    <span>${cat.parentName ? '→ ' + escapeHtml(cat.parentName) : 'Danh mục gốc'}</span>
                                </div>
                                <span class="admin-ai-preview-badge">Mới</span>
                            </div>`).join('')}
                    </div>`;
            }
        }
        // Fallback: generic key-value preview
        const entries = Object.entries(params).filter(([, v]) => v != null && String(v).length < 120);
        if (!entries.length) return '';
        return `<div class="admin-ai-preview-kv">${entries.slice(0, 6).map(([k, v]) =>
            `<div><span>${escapeHtml(prettyAdminAiKey(k))}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('')}</div>`;
    }

    function confirmAdminAiAction(action, triggerButton) {
        const isCatAction = action.type && action.type.toLowerCase().includes('categor');
        const params = action.parameters || {};
        const hasCats = Array.isArray(params.categories) && params.categories.length
            || Array.isArray(params.items) && params.items.length;

        // For category-add actions: dispatch to page overlay instead of inline confirm
        if (isCatAction && hasCats && (action.type.includes('add') || action.type.includes('create') || action.type.includes('suggest'))) {
            if (triggerButton) triggerButton.disabled = true;
            const count = (params.categories || params.items || []).length;
            const parentLabel = params.parentName ? `" cho "${params.parentName}"` : '';
            appendAdminAiMessage('assistant', `
                <div class="admin-ai-success" style="margin-bottom:6px">
                    <i class="fa-solid fa-layer-group"></i>
                    <strong>Mình đã chuẩn bị ${count} mục con${parentLabel}.</strong>
                </div>
                <p style="font-size:0.8rem;color:var(--admin-text-muted);margin:0">
                    <i class="fa-solid fa-arrow-down"></i>
                    Hãy xem, chọn và xác nhận trực tiếp trong khu vực danh mục bên dưới ↓
                </p>`);
            // Dispatch event for categories.html overlay
            window.dispatchEvent(new CustomEvent('adminAiCategoryPreview', { detail: { action } }));
            // Auto-minimize AI chat drawer so page workspace is 100% visible
            setTimeout(() => toggleAdminAiMinimize(true), 250);
            return;
        }

        // Default: inline confirm in chat
        const destructive = action.risk === 'destructive';
        const previewHtml = renderActionPreview(action);
        const confirmUid = `aic-${Date.now()}`;

        // Disable the trigger so admin can't double-click
        if (triggerButton) triggerButton.disabled = true;

        const wrapper = appendAdminAiMessage('assistant', `
            <div class="admin-ai-inline-confirm" id="${confirmUid}">
                <div class="admin-ai-inline-confirm-head">
                    <span class="admin-ai-inline-confirm-icon ${destructive ? 'danger' : ''}">
                        <i class="fa-solid ${destructive ? 'fa-triangle-exclamation' : 'fa-shield-check'}"></i>
                    </span>
                    <div>
                        <strong>${escapeHtml(action.title)}</strong>
                        <p>${escapeHtml(action.description)}</p>
                    </div>
                </div>
                ${previewHtml}
                <div class="admin-ai-inline-confirm-note">
                    <i class="fa-solid fa-lock"></i>
                    <span>${destructive ? 'Tác vụ này có thể xóa dữ liệu và không thể hoàn tác.' : 'AI chỉ thực hiện đúng các tác vụ được hiển thị ở trên.'}</span>
                </div>
                <div class="admin-ai-inline-confirm-actions">
                    <button type="button" class="admin-ai-inline-cancel">
                        <i class="fa-solid fa-xmark"></i> Hủy
                    </button>
                    <button type="button" class="admin-ai-inline-execute ${destructive ? 'danger' : ''}">
                        <i class="fa-solid fa-check"></i> Xác nhận thực hiện
                    </button>
                </div>
            </div>`);

        wrapper?.querySelector('.admin-ai-inline-cancel')?.addEventListener('click', () => {
            wrapper.remove();
            if (triggerButton) triggerButton.disabled = false;
        });
        wrapper?.querySelector('.admin-ai-inline-execute')?.addEventListener('click', () => {
            wrapper.remove();
            executeAdminAiAction(action, true, null);
        });
    }

    async function executeAdminAiAction(action, confirmed, trigger) {
        if (trigger) trigger.disabled = true;
        const progress = appendAdminAiMessage('assistant', `<span class="admin-ai-thinking"><i></i><i></i><i></i> Đang thực hiện "${escapeHtml(action.title)}"...</span>`);
        try {
            const result = await window.adminApi.post('admin/ai/execute', {
                type: action.type,
                parameters: action.parameters || {},
                confirmed
            });
            progress?.remove();
            const isCatAction = action.type && action.type.toLowerCase().includes('categor');
            const dataHtml = isCatAction
                ? renderCategoryResultCards(result.data, action)
                : renderAdminAiData(result.data);
            const destination = result.navigateTo;
            const followUp = destination && destination !== currentPage
                ? `<button class="admin-ai-result-link" type="button" data-ai-navigate="${escapeHtml(destination)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở trang liên quan</button>`
                : '';
            appendAdminAiMessage('assistant', `
                <div class="admin-ai-success"><i class="fa-solid fa-circle-check"></i><strong>${escapeHtml(result.message || 'Tác vụ đã hoàn tất.')}</strong></div>
                ${dataHtml}${followUp}`);
            window.adminToast.success(result.message || 'Admin AI đã hoàn tất tác vụ.');
            window.dispatchEvent(new CustomEvent('adminAiActionCompleted', { detail: { action, result } }));
        } catch (error) {
            progress?.remove();
            appendAdminAiMessage('assistant', `<span class="admin-ai-error"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(error.message || 'Không thể thực hiện tác vụ.')}</span>`);
            if (trigger) trigger.disabled = false;
        }
    }

    // Expose so categories.html can trigger execution after checkbox selection
    window.executeAdminAiActionPublic = (action) => executeAdminAiAction(action, true, null);

    function renderCategoryResultCards(data, action) {
        if (!data) return '';
        const parentDefault = action?.parameters?.parentName || '';
        const cats = Array.isArray(data) ? data
            : Array.isArray(data?.added) ? data.added
            : Array.isArray(data?.categories) ? data.categories
            : typeof data === 'object' && (data.name || data.Name) ? [data]
            : [];
        if (!cats.length) return renderAdminAiData(data);
        return `
            <div class="admin-ai-cat-result-list">
                ${cats.map(cat => {
                    const name = cat.name || cat.Name || '—';
                    const icon = safeAiIcon(cat.icon || cat.Icon || 'fa-tag');
                    const parent = cat.parentName || cat.ParentName || data?.parentName || parentDefault;
                    return `
                    <div class="admin-ai-cat-result-item">
                        <span class="admin-ai-cat-result-icon"><i class="fa-solid ${icon}"></i></span>
                        <div>
                            <strong>${escapeHtml(name)}</strong>
                            <span>${parent ? '→ ' + escapeHtml(parent) : 'Danh mục gốc'}</span>
                        </div>
                        <span class="admin-ai-cat-result-check"><i class="fa-solid fa-circle-check"></i></span>
                    </div>`;
                }).join('')}
            </div>`;
    }

    function renderAdminAiData(data) {
        if (data == null) return '';
        if (Array.isArray(data)) {
            if (!data.length) return '<div class="admin-ai-empty-result">Không có dữ liệu phù hợp.</div>';
            return `<div class="admin-ai-data-list">${data.slice(0, 20).map(item => renderAdminAiDataItem(item)).join('')}</div>`;
        }
        if (typeof data === 'object') {
            return `<div class="admin-ai-data-grid">${Object.entries(data).slice(0, 12).map(([key, value]) => `
                <div><span>${escapeHtml(prettyAdminAiKey(key))}</span><strong>${escapeHtml(formatAdminAiValue(value))}</strong></div>`).join('')}</div>`;
        }
        return `<div class="admin-ai-empty-result">${escapeHtml(String(data))}</div>`;
    }

    function renderAdminAiDataItem(item) {
        if (typeof item !== 'object' || item == null) return `<div class="admin-ai-data-item">${escapeHtml(String(item))}</div>`;
        // Pretty-print category-like objects
        const name = item.name || item.Name || item.title || item.Title;
        const icon = item.icon || item.Icon;
        const parent = item.parentName || item.ParentName || item.parentCategoryId || item.ParentCategoryId;
        if (name) {
            return `<div class="admin-ai-data-item">
                ${icon ? `<span style="margin-right:5px"><i class="fa-solid ${safeAiIcon(icon)}"></i></span>` : ''}
                <strong>${escapeHtml(String(name))}</strong>
                ${parent ? `<span><b>Mục cha:</b> ${escapeHtml(String(parent))}</span>` : ''}
            </div>`;
        }
        const entries = Object.entries(item).filter(([, value]) => value != null && value !== '' && typeof value !== 'object').slice(0, 6);
        return `<div class="admin-ai-data-item">${entries.map(([key, value], index) => index === 0
            ? `<strong>${escapeHtml(formatAdminAiValue(value))}</strong>`
            : `<span><b>${escapeHtml(prettyAdminAiKey(key))}:</b> ${escapeHtml(formatAdminAiValue(value))}</span>`).join('')}</div>`;
    }

    function prettyAdminAiKey(key) {
        const labels = {
            users: 'Người dùng', categories: 'Danh mục', pendingReports: 'Báo cáo chờ',
            bannedWords: 'Từ khóa cấm', pendingShops: 'Shop chờ', name: 'Tên',
            reason: 'Lý do', target: 'Đối tượng', reporter: 'Người báo cáo',
            products: 'Sản phẩm', children: 'Mục con', words: 'Từ khóa'
        };
        return labels[key] || key.replace(/([A-Z])/g, ' $1').trim();
    }

    function formatAdminAiValue(value) {
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object' && value != null) return JSON.stringify(value);
        const text = String(value ?? '');
        return text.length > 160 ? `${text.slice(0, 157)}...` : text;
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
    window.adminToast.success = (msg, timeout) => window.adminToast(msg, 'success', timeout);
    window.adminToast.error = (msg, timeout) => window.adminToast(msg, 'error', timeout);
    window.adminToast.warning = (msg, timeout) => window.adminToast(msg, 'warning', timeout);
    window.adminToast.info = (msg, timeout) => window.adminToast(msg, 'info', timeout);

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
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            toggleAdminAi();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openCommandPalette();
        }
        if (event.key === 'Escape') {
            if (document.body.classList.contains('admin-mobile-nav-open')) closeMobileNav();
            else if (document.body.classList.contains('admin-ai-open')) toggleAdminAi(false);
            else window.adminModal.close();
        }
    }

    function initialize() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration()
                .then(registration => registration?.update())
                .catch(error => {
                    if (isLocal) console.warn('Unable to refresh service worker:', error);
                });
        }
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
