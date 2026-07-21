// marketplace-ai-chat.js — Zynk AI Shopping Assistant v3 (Redesigned & Smart)
// Uses /api/ai-chat/* endpoints with session management, smart order intents, and premium UI.

(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────────────────────
    const LS_ANON_KEY = 'zynk_anon_session_id';
    const LS_SESSION_KEY = 'zynk_ai_session_id';

    // ── State ───────────────────────────────────────────────────────────────────
    let currentSessionId = null;
    let anonymousSessionId = null;
    let isTyping = false;
    let initialized = false;
    let _originalGridContent = null;

    const SUGGESTIONS = [
        '🧥 Áo khoác đẹp',
        '👟 Giày sneaker',
        '📦 Đơn hàng của tôi',
        '🛒 Xem giỏ hàng',
        '⚡ Sản phẩm bán chạy',
    ];

    const GREETING = `Chào bạn! 👋 Em là **Zynk AI**, trợ lý mua sắm thông minh của Zynk Shop.

Em có thể giúp bạn:
• 🔍 Tìm kiếm sản phẩm theo nhu cầu & ngân sách
• 🛒 Xem & quản lý giỏ hàng
• 📦 Kiểm tra đơn hàng & trạng thái giao hàng
• 💳 Hướng dẫn thanh toán & đổi trả hàng

Bạn cần hỗ trợ gì hôm nay? 😊`;

    // ── Helpers ─────────────────────────────────────────────────────────────────
    function isLoggedIn() {
        return !!(localStorage.getItem('zynk_token') || localStorage.getItem('auth_token'));
    }

    function getAnonymousSessionId() {
        let id = localStorage.getItem(LS_ANON_KEY);
        if (!id) {
            id = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(LS_ANON_KEY, id);
        }
        return id;
    }

    function _formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    }

    function _formatTime(d) {
        return new Date(d || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    function _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _decodeHtml(str) {
        if (!str) return '';
        const el = document.createElement('textarea');
        el.innerHTML = str;
        return el.value;
    }

    function _formatText(text) {
        let escaped = _escapeHtml(text);
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/^[•\-]\s(.+)$/gm, '<span style="display:block;padding-left:8px">• $1</span>');
        return escaped;
    }

    function _getMessages() {
        return document.getElementById('ai-shop-chat-messages');
    }

    function _scrollBottom() {
        const el = _getMessages();
        if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }

    // ── Session management ───────────────────────────────────────────────────────
    async function initSession() {
        anonymousSessionId = getAnonymousSessionId();
        const savedId = localStorage.getItem(LS_SESSION_KEY);
        if (savedId) {
            currentSessionId = savedId;
            return;
        }
        await _createSession();
    }

    async function _createSession() {
        try {
            const body = { anonymousSessionId };
            const token = localStorage.getItem('zynk_token') || localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const res = await fetch('/api/ai-chat/sessions', {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const data = await res.json();
                currentSessionId = data.id;
                localStorage.setItem(LS_SESSION_KEY, data.id);
            }
        } catch (e) {
            console.warn('[AiChat] Could not create session:', e);
        }
    }

    // ── Toggle open / close ──────────────────────────────────────────────────────
    window.toggleAiShopChat = function () {
        const win = document.getElementById('ai-shop-chat-window');
        const btn = document.getElementById('ai-shop-chat-toggle');
        if (!win) return;

        const isHidden = win.classList.contains('hidden');

        if (isHidden) {
            win.classList.remove('hidden');
            if (btn) btn.style.transform = 'scale(1) rotate(0deg)';
            if (!initialized) {
                initialized = true;
                _init();
            }
            setTimeout(() => {
                const inp = document.getElementById('ai-shop-chat-input');
                if (inp) inp.focus();
            }, 300);
        } else {
            win.classList.add('hidden');
            if (btn) btn.style.transform = '';
        }
    };

    async function _init() {
        _renderGreeting();
        _renderQuickActionsBar();
        _renderSuggestions();
        await initSession();
        _setupHeaderActions();
    }

    // ── Send message ─────────────────────────────────────────────────────────────
    window.handleAiShopChatKeyPress = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.sendAiShopChatMessage();
        }
    };

    window.sendAiShopChatMessage = async function () {
        if (isTyping) return;

        const input = document.getElementById('ai-shop-chat-input');
        const sendBtn = document.getElementById('ai-shop-chat-send-btn');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        _hideSuggestions();

        _appendUserMessage(text);

        const typingId = _appendTyping();
        isTyping = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            if (!currentSessionId) {
                await _createSession();
            }

            if (!currentSessionId) {
                throw new Error('Cannot create chat session');
            }

            const clientMsgId = _generateUUID();
            const body = {
                sessionId: currentSessionId,
                anonymousSessionId,
                message: text,
                clientMessageId: clientMsgId,
                pageContext: 'marketplace'
            };

            const token = localStorage.getItem('zynk_token') || localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const res = await fetch('/api/ai-chat/messages', {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(30000)
            });

            _removeTyping(typingId);
            isTyping = false;
            if (sendBtn) sendBtn.disabled = false;

            if (res.status === 404) {
                localStorage.removeItem(LS_SESSION_KEY);
                currentSessionId = null;
                await _createSession();
                _appendBotMessage('Phiên chat đã hết hạn, em đã tạo phiên mới. Bạn vui lòng nhắn lại nhé! 😊', [], [], text);
                return;
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const botText = data.response || 'Xin lỗi, em chưa hiểu yêu cầu. Bạn mô tả rõ hơn được không?';
            const groups = data.groups || [];
            const suggestedReplies = data.suggestedReplies || [];
            const actionType = data.actionType || null;
            const orders = data.orders || [];

            _appendBotMessage(botText, groups, suggestedReplies, text, data.messageId, actionType, orders);

        } catch (err) {
            _removeTyping(typingId);
            isTyping = false;
            if (sendBtn) sendBtn.disabled = false;
            _appendBotMessage('Ối! Có lỗi kết nối. Bạn vui lòng thử lại nhé 🙏', [], [], text);
            console.error('[AiChat] Error:', err);
        }
    };

    window.sendAiShopSuggestion = function (text) {
        const input = document.getElementById('ai-shop-chat-input');
        if (input) {
            input.value = text;
            window.sendAiShopChatMessage();
        }
    };

    // ── Render functions ─────────────────────────────────────────────────────────
    function _renderGreeting() {
        const msgs = _getMessages();
        if (!msgs) return;
        msgs.innerHTML = '';
        _appendBotMessage(GREETING, [], []);
    }

    function _appendUserMessage(text) {
        const msgs = _getMessages();
        if (!msgs) return;

        const div = document.createElement('div');
        div.className = 'ai-shop-msg user';
        div.innerHTML = `
            <div class="ai-shop-bubble">${_escapeHtml(text)}</div>
            <span class="ai-shop-time">${_formatTime()}</span>
        `;
        msgs.appendChild(div);
        _scrollBottom();
    }

    function _appendBotMessage(text, groups, suggestedReplies, userQuery, messageId, actionType, orders) {
        const msgs = _getMessages();
        if (!msgs) return;

        const div = document.createElement('div');
        div.className = 'ai-shop-msg bot';

        const bubble = document.createElement('div');
        bubble.className = 'ai-shop-bubble';
        bubble.innerHTML = _formatText(text);
        div.appendChild(bubble);

        // Action handling
        if (actionType === 'view_cart') {
            const cartCard = _buildCartSummaryCard();
            if (cartCard) div.appendChild(cartCard);
        } else if (actionType === 'redirect_cart') {
            const checkoutBtn = document.createElement('button');
            checkoutBtn.className = 'ai-cart-checkout-btn';
            checkoutBtn.style.marginTop = '6px';
            checkoutBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> Đến trang giỏ hàng ngay ➔`;
            checkoutBtn.onclick = () => window.location.href = '/cart.html';
            div.appendChild(checkoutBtn);
        } else if (actionType === 'view_orders' || (orders && orders.length > 0)) {
            const ordersCard = _buildOrdersListCard(orders);
            if (ordersCard) div.appendChild(ordersCard);
        } else if (actionType === 'require_login') {
            const loginBtn = document.createElement('button');
            loginBtn.className = 'ai-view-on-page-btn';
            loginBtn.style.cssText = 'background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:700;margin-top:6px;';
            loginBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay`;
            loginBtn.onclick = () => window.location.href = '/auth.html';
            div.appendChild(loginBtn);
        }

        // Render product groups in chat
        if (groups && groups.length > 0) {
            const hasProducts = groups.some(g => g.products && g.products.length > 0);
            if (hasProducts) {
                const allProducts = groups.flatMap(g => g.products || []);
                const scrollArea = _buildProductScrollAreaH(allProducts);
                div.appendChild(scrollArea);

                const viewBtn = document.createElement('button');
                viewBtn.className = 'ai-view-on-page-btn';
                viewBtn.innerHTML = `✅ Đã hiển thị ${allProducts.length} gợi ý ở trang chính. <span style="font-weight:700">Xem ngay ➔</span>`;
                viewBtn.onclick = () => {
                    window.scrollToMainProducts();
                };
                div.appendChild(viewBtn);

                // Render products on main page (NO Chi tiết button)
                _renderRecommendationsOnMainPage(userQuery || 'Gợi ý Zynk AI', groups);
            }
        }

        // Suggested reply chips
        if (suggestedReplies && suggestedReplies.length > 0) {
            const chips = document.createElement('div');
            chips.className = 'ai-shop-suggestions';
            suggestedReplies.forEach(s => {
                const chip = document.createElement('button');
                chip.className = 'ai-shop-chip';
                chip.textContent = s;
                chip.onclick = () => window.sendAiShopSuggestion(s);
                chips.appendChild(chip);
            });
            div.appendChild(chips);
        }

        const timeEl = document.createElement('span');
        timeEl.className = 'ai-shop-time';
        timeEl.textContent = _formatTime();
        div.appendChild(timeEl);

        msgs.appendChild(div);
        _scrollBottom();
    }

    function _appendTyping() {
        const msgs = _getMessages();
        if (!msgs) return 'typing-' + Date.now();

        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.className = 'ai-shop-msg bot';
        div.id = id;
        div.innerHTML = `<div class="ai-shop-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
        msgs.appendChild(div);
        _scrollBottom();
        return id;
    }

    function _removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // ── Quick Action Bar (above input area) ──────────────────────────────────────
    function _renderQuickActionsBar() {
        const win = document.getElementById('ai-shop-chat-window');
        if (!win || win.querySelector('.ai-quick-actions')) return;

        const inputArea = win.querySelector('.ai-shop-chat-input-area');
        if (!inputArea) return;

        const bar = document.createElement('div');
        bar.className = 'ai-quick-actions';

        const actions = [
            { icon: 'fa-shopping-cart', label: 'Giỏ hàng', query: 'Xem giỏ hàng' },
            { icon: 'fa-box', label: 'Đơn hàng', query: 'Đơn hàng của tôi' },
            { icon: 'fa-fire', label: 'Bán chạy', query: 'Gợi ý sản phẩm bán chạy' },
            { icon: 'fa-circle-question', label: 'Trợ giúp', query: 'Hướng dẫn tính năng' },
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'ai-quick-action-btn';
            btn.innerHTML = `<i class="fa-solid ${a.icon}"></i> ${a.label}`;
            btn.onclick = () => window.sendAiShopSuggestion(a.query);
            bar.appendChild(btn);
        });

        win.insertBefore(bar, inputArea);
    }

    // ── Suggestions ──────────────────────────────────────────────────────────────
    function _renderSuggestions() {
        const container = document.getElementById('ai-shop-suggestions-container');
        if (!container) return;

        container.innerHTML = '';
        SUGGESTIONS.forEach(s => {
            const chip = document.createElement('button');
            chip.className = 'ai-shop-chip';
            chip.textContent = s;
            chip.onclick = () => window.sendAiShopSuggestion(s);
            container.appendChild(chip);
        });
        container.style.display = 'flex';
    }

    function _hideSuggestions() {
        const container = document.getElementById('ai-shop-suggestions-container');
        if (container) container.style.display = 'none';
    }

    // ── Horizontal compact product card in chat (NO buttons, full card clickable) ──
    function _buildProductScrollAreaH(products) {
        const wrap = document.createElement('div');
        wrap.className = 'ai-product-scroll-h';

        products.slice(0, 6).forEach(p => {
            const card = _createProductCardH(p);
            wrap.appendChild(card);
        });

        return wrap;
    }

    function _createProductCardH(p) {
        const price = _formatCurrency(p.price ?? 0);
        const imgUrl = p.featuredImageUrl || 'https://via.placeholder.com/150';
        const productId = p.id || '';
        const trackingId = p.recommendationLogId || '';
        const decodedName = _decodeHtml(p.name ?? 'Sản phẩm');
        const decodedShop = _decodeHtml(p.shopName ?? 'Zynk Shop');

        const card = document.createElement('div');
        card.className = 'ai-product-card-h';
        card.title = `Click để xem chi tiết: ${decodedName}`;

        card.innerHTML = `
            <img src="${_escapeHtml(imgUrl)}" alt="" class="pch-img">
            <div class="pch-info">
                <span class="pch-shop"><i class="fa-solid fa-shop"></i> <span class="pch-shop-txt"></span></span>
                <div class="pch-name"></div>
                <div class="pch-price">${price}</div>
                <span class="pch-sold">${p.salesCount ?? 0} đã bán</span>
            </div>
            <i class="fa-solid fa-chevron-right pch-arrow"></i>
        `;

        const nameEl = card.querySelector('.pch-name');
        const shopEl = card.querySelector('.pch-shop-txt');
        if (nameEl) nameEl.textContent = decodedName;
        if (shopEl) shopEl.textContent = decodedShop;

        // Click full card to view product details
        card.addEventListener('click', () => {
            if (window.trackAndOpenDetails) window.trackAndOpenDetails(productId, trackingId);
            else if (window.openProductModal) window.openProductModal(productId);
        });

        return card;
    }

    // ── Cart Summary Card in Chat ─────────────────────────────────────────────────
    function _buildCartSummaryCard() {
        const cartStr = localStorage.getItem('zynk_cart');
        const cart = cartStr ? JSON.parse(cartStr) : [];

        const wrap = document.createElement('div');
        wrap.className = 'ai-cart-summary';

        if (!cart || cart.length === 0) {
            wrap.innerHTML = `
                <div style="text-align:center;padding:12px;color:#94a3b8;font-size:0.8rem;">
                    <i class="fa-solid fa-basket-shopping" style="font-size:1.8rem;display:block;margin-bottom:6px;opacity:0.5;"></i>
                    Giỏ hàng của bạn đang trống
                </div>
                <button class="ai-view-on-page-btn" style="margin-top:6px;" onclick="window.sendAiShopSuggestion('Gợi ý sản phẩm bán chạy')">
                    🔍 Khám phá sản phẩm hot
                </button>
            `;
            return wrap;
        }

        let total = 0;
        let itemsHtml = '';

        cart.slice(0, 4).forEach(item => {
            const price = typeof (item.price) === 'number' ? item.price : parseInt(String(item.price || '0').replace(/[^0-9]/g, '')) || 0;
            const qty = item.qty || 1;
            total += price * qty;
            const img = item.img || item.image || item.featuredImageUrl || 'https://via.placeholder.com/80';
            itemsHtml += `
                <div class="ai-cart-item">
                    <img src="${_escapeHtml(img)}" alt="">
                    <div class="ci-name">${_escapeHtml(_decodeHtml(item.name || 'Sản phẩm'))}</div>
                    <span class="ci-qty">x${qty}</span>
                    <span class="ci-price">${_formatCurrency(price * qty)}</span>
                </div>
            `;
        });

        if (cart.length > 4) {
            itemsHtml += `<div style="font-size:0.7rem;color:#94a3b8;text-align:center;padding-top:4px;">... và thêm ${cart.length - 4} sản phẩm khác</div>`;
        }

        wrap.innerHTML = `
            <div style="font-size:0.78rem;font-weight:700;color:#334155;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
                <span>🛒 Giỏ hàng (${cart.length} món)</span>
                <a href="/cart.html" style="font-size:0.7rem;color:#6366f1;text-decoration:none;font-weight:600;">Xem tất cả ➔</a>
            </div>
            ${itemsHtml}
            <div class="ai-cart-total">
                <span class="ct-label">Tổng cộng:</span>
                <span class="ct-amount">${_formatCurrency(total)}</span>
            </div>
            <button class="ai-cart-checkout-btn" onclick="window.location.href='/cart.html'">
                <i class="fa-solid fa-credit-card"></i> Tiến hành thanh toán
            </button>
        `;

        return wrap;
    }

    // ── Orders List Card in Chat ──────────────────────────────────────────────────
    function _buildOrdersListCard(orders) {
        if (!orders || orders.length === 0) return null;

        const wrap = document.createElement('div');
        wrap.className = 'ai-order-list';

        orders.slice(0, 3).forEach(o => {
            const card = document.createElement('div');
            card.className = 'ai-order-card';

            const statusMap = {
                'Pending': { text: '⏳ Chờ xác nhận', cls: 'pending' },
                'Processing': { text: '⚙️ Đang xử lý', cls: 'pending' },
                'Shipping': { text: '🚚 Đang giao hàng', cls: 'shipping' },
                'InTransit': { text: '🚚 Đang giao hàng', cls: 'shipping' },
                'Completed': { text: '✅ Đã giao', cls: 'done' },
                'Delivered': { text: '✅ Đã giao', cls: 'done' },
                'Cancelled': { text: '❌ Đã hủy', cls: 'cancel' }
            };

            const statusInfo = statusMap[o.status] || { text: o.statusText || o.status, cls: 'pending' };
            const orderIdShort = o.id ? o.id.substring(0, 8) : '#';

            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="oc-id">Mã: #${_escapeHtml(orderIdShort)}</span>
                    <span class="oc-status ${statusInfo.cls}">${statusInfo.text}</span>
                </div>
                <div class="oc-total">Tổng: ${_formatCurrency(o.totalAmount || o.price || 0)}</div>
                <div class="oc-date">Ngày tạo: ${new Date(o.createdAt || Date.now()).toLocaleDateString('vi-VN')}</div>
            `;

            card.onclick = () => {
                window.location.href = '/settings.html#orders';
            };

            wrap.appendChild(card);
        });

        return wrap;
    }

    // ── Render on main page (NO Chi tiết button, NO Thêm vào giỏ button) ───────────
    function _renderRecommendationsOnMainPage(query, groups) {
        const grid = document.getElementById('product-grid');
        const titleEl = document.getElementById('market-title');
        if (!grid) return;

        if (!_originalGridContent) {
            _originalGridContent = grid.innerHTML;
        }

        if (titleEl) {
            titleEl.innerHTML = `🤖 Zynk AI gợi ý cho: "<span id="ai-query-text"></span>"
                <button onclick="window.resetAiRecommendations()" class="glass-btn-reset">
                    <i class="fa-solid fa-rotate-left"></i> Quay lại gợi ý thường
                </button>`;
            const querySpan = titleEl.querySelector('#ai-query-text');
            if (querySpan) querySpan.textContent = query;
        }

        grid.innerHTML = '';

        if (!groups || groups.length === 0) {
            grid.innerHTML = '<p style="text-align:center;padding:40px;color:#94a3b8">Chưa tìm thấy sản phẩm phù hợp</p>';
            return;
        }

        groups.forEach(g => {
            if (!g.products || g.products.length === 0) return;

            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:24px;';

            const header = document.createElement('h3');
            header.className = 'section-title';
            header.style.cssText = 'font-size:1rem;font-weight:700;margin-bottom:12px;color:#334155;';
            header.innerHTML = `<i class="fa-solid fa-sparkles" style="color:#a855f7;"></i> `;
            const headerText = document.createElement('span');
            headerText.textContent = g.label || 'Phù hợp nhất';
            header.appendChild(headerText);
            section.appendChild(header);

            const productGrid = document.createElement('div');
            productGrid.className = 'products-grid';

            g.products.forEach(p => {
                const card = _createMainProductCard(p);
                productGrid.appendChild(card);
            });

            section.appendChild(productGrid);
            grid.appendChild(section);
        });
    }

    // Main page card: Full card is clickable. NO "Chi tiết" or "Thêm giỏ" buttons per user request.
    function _createMainProductCard(p) {
        const price = _formatCurrency(p.price ?? 0);
        const productId = p.id || '';
        const trackingId = p.recommendationLogId || '';
        const decodedName = _decodeHtml(p.name ?? 'Sản phẩm');
        const decodedShop = _decodeHtml(p.shopName ?? 'Zynk Shop');

        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.cursor = 'pointer';
        card.title = `Click để xem chi tiết: ${decodedName}`;

        card.innerHTML = `
            <div class="product-image-box">
                <img src="${_escapeHtml(p.featuredImageUrl || 'https://via.placeholder.com/300')}" alt="">
            </div>
            <div class="product-info">
                <span class="product-shop"><i class="fa fa-shop"></i> <span class="mc-shop"></span></span>
                <h3 class="product-name mc-name"></h3>
                <div class="product-meta">
                    <span class="product-price">${price}</span>
                    <span class="product-stats">${p.salesCount ?? 0} đã bán</span>
                </div>
            </div>
        `;

        const nameEl = card.querySelector('.mc-name');
        const shopEl = card.querySelector('.mc-shop');
        if (nameEl) nameEl.textContent = decodedName;
        if (shopEl) shopEl.textContent = decodedShop;

        // Click full card = open details
        const openProduct = () => {
            if (window.trackAndOpenDetails) window.trackAndOpenDetails(productId, trackingId);
            else if (window.openProductModal) window.openProductModal(productId);
        };
        card.addEventListener('click', openProduct);

        return card;
    }

    window.resetAiRecommendations = function () {
        const titleEl = document.getElementById('market-title');
        if (titleEl) titleEl.innerHTML = 'Gợi ý hôm nay';

        const grid = document.getElementById('product-grid');
        if (grid && _originalGridContent) {
            grid.innerHTML = _originalGridContent;
            _originalGridContent = null;
        } else if (typeof loadProducts === 'function') {
            loadProducts();
        }
    };

    window.scrollToMainProducts = function () {
        const titleEl = document.getElementById('market-title');
        if (titleEl) titleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ── Header action buttons ────────────────────────────────────────────────────
    function _setupHeaderActions() {
        const header = document.querySelector('.ai-shop-chat-header');
        if (!header || header.querySelector('.ai-header-actions')) return;

        const actions = document.createElement('div');
        actions.className = 'ai-header-actions';

        const newBtn = document.createElement('button');
        newBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        newBtn.title = 'Cuộc trò chuyện mới';
        newBtn.className = 'ai-shop-header-btn';
        newBtn.onclick = _startNewSession;
        actions.appendChild(newBtn);

        if (isLoggedIn()) {
            const histBtn = document.createElement('button');
            histBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
            histBtn.title = 'Lịch sử trò chuyện';
            histBtn.className = 'ai-shop-header-btn';
            histBtn.onclick = _showSessionHistory;
            actions.appendChild(histBtn);
        }

        const closeBtn = header.querySelector('.ai-shop-chat-close, [onclick*="toggleAiShopChat"]');
        if (closeBtn) {
            header.insertBefore(actions, closeBtn);
        } else {
            header.appendChild(actions);
        }
    }

    async function _startNewSession() {
        localStorage.removeItem(LS_SESSION_KEY);
        currentSessionId = null;
        await _createSession();
        _renderGreeting();
        _renderSuggestions();
    }

    async function _showSessionHistory() {
        const token = localStorage.getItem('zynk_token') || localStorage.getItem('auth_token');
        if (!token) return;

        try {
            const res = await fetch('/api/ai-chat/sessions?pageSize=10', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            const data = await res.json();
            const sessions = data.sessions || data || [];

            const msgs = _getMessages();
            if (!msgs) return;

            const panel = document.createElement('div');
            panel.style.cssText = 'background:#ffffff;border-radius:12px;padding:12px;margin:8px 0;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.06);';
            panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px;color:#334155;font-size:0.8rem;">📜 Lịch sử trò chuyện</div>';

            if (sessions.length === 0) {
                panel.innerHTML += '<p style="color:#94a3b8;font-size:0.78rem;">Chưa có lịch sử nào.</p>';
            } else {
                sessions.forEach(s => {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding:7px 10px;border-radius:8px;cursor:pointer;margin-bottom:4px;border:1px solid #f1f5f9;background:#f8fafc;font-size:0.78rem;color:#1e293b;';
                    item.textContent = s.title || 'Cuộc trò chuyện';
                    item.onclick = () => {
                        currentSessionId = s.id;
                        localStorage.setItem(LS_SESSION_KEY, s.id);
                        panel.remove();
                        _renderGreeting();
                    };
                    item.onmouseover = () => item.style.background = '#ede9fe';
                    item.onmouseout = () => item.style.background = '#f8fafc';
                    panel.appendChild(item);
                });
            }

            msgs.appendChild(panel);
            _scrollBottom();
        } catch (e) {
            console.warn('[AiChat] Could not load history:', e);
        }
    }

    // ── UUID generator ────────────────────────────────────────────────────────────
    function _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    // ── Track and open product ────────────────────────────────────────────────────
    window.trackAndOpenDetails = function (productId, recommendationLogId) {
        if (recommendationLogId) {
            fetch(`/api/ai-chat/recommendations/${recommendationLogId}/click`, { method: 'POST' }).catch(() => {});
        }
        if (window.openProductModal) window.openProductModal(productId);
    };

    window.trackAndAddToCart = function (productId, recommendationLogId, event) {
        if (event) event.stopPropagation();
        if (recommendationLogId) {
            fetch(`/api/ai-chat/recommendations/${recommendationLogId}/add-to-cart`, { method: 'POST' }).catch(() => {});
        }
        if (window.openProductModal) window.openProductModal(productId);
    };

})();
