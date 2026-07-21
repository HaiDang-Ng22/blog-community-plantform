// marketplace-ai-chat.js — Zynk AI Shopping Assistant v2
// Uses the new /api/ai-chat/* endpoints with session management.

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
        '🧥 Tìm áo khoác đẹp',
        '👟 Gợi ý giày sneaker',
        '👜 Túi xách thời trang',
        '💄 Sản phẩm làm đẹp',
        '📱 Phụ kiện điện tử',
    ];

    const GREETING = `Chào bạn! 👋 Em là **Zynk AI**, trợ lý mua sắm thông minh của Zynk Shop.

Em có thể giúp bạn:
• 🔍 Tìm sản phẩm theo nhu cầu
• 💡 Gợi ý sản phẩm phù hợp
• 🛒 Thêm nhanh vào giỏ hàng

Bạn đang cần tìm gì hôm nay? 😊`;

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
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    function _formatTime(d) {
        return new Date(d || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    function _escapeHtml(str) {
        if (!str) return '';
        // Only escape HTML-dangerous chars, NOT unicode/Vietnamese chars
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
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

        // Try to restore saved session
        const savedId = localStorage.getItem(LS_SESSION_KEY);
        if (savedId) {
            currentSessionId = savedId;
            return; // Will validate on first message send
        }

        // Create new session
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
            console.warn('[AiChat] Could not create session, will retry on message:', e);
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
            // Ensure we have a valid session
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
                // Session expired, recreate
                localStorage.removeItem(LS_SESSION_KEY);
                currentSessionId = null;
                await _createSession();
                _appendBotMessage('Phiên chat đã hết hạn, em đã tạo phiên mới. Bạn vui lòng nhắn lại nhé! 😊', [], []);
                return;
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const botText = data.response || 'Xin lỗi, em chưa hiểu yêu cầu. Bạn mô tả rõ hơn được không?';
            const groups = data.groups || [];
            const suggestedReplies = data.suggestedReplies || [];

            _appendBotMessage(botText, groups, suggestedReplies, data.sessionId, data.messageId);

        } catch (err) {
            _removeTyping(typingId);
            isTyping = false;
            if (sendBtn) sendBtn.disabled = false;
            _appendBotMessage('Ối! Có lỗi kết nối. Bạn vui lòng thử lại nhé 🙏', [], []);
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
            <div class="ai-shop-bubble user-bubble">${_escapeHtml(text)}</div>
            <span class="ai-shop-time">${_formatTime()}</span>
        `;
        msgs.appendChild(div);
        _scrollBottom();
    }

    function _appendBotMessage(text, groups, suggestedReplies, sessionId, messageId) {
        const msgs = _getMessages();
        if (!msgs) return;

        const div = document.createElement('div');
        div.className = 'ai-shop-msg bot';

        const bubble = document.createElement('div');
        bubble.className = 'ai-shop-bubble bot-bubble';
        bubble.innerHTML = _formatText(text);
        div.appendChild(bubble);

        // Render product groups
        if (groups && groups.length > 0) {
            const hasProducts = groups.some(g => g.products && g.products.length > 0);
            if (hasProducts) {
                const allProducts = groups.flatMap(g => g.products || []);
                const scrollArea = _buildProductScrollArea(allProducts);
                div.appendChild(scrollArea);

                // "View on page" button
                const viewBtn = document.createElement('button');
                viewBtn.className = 'ai-view-on-page-btn';
                viewBtn.innerHTML = `✅ Đã tìm thấy ${allProducts.length} gợi ý phù hợp và hiển thị trực tiếp ở trang chính. <span style="font-weight:700">Xem ngay ➔</span>`;
                viewBtn.onclick = () => {
                    _renderRecommendationsOnMainPage(text, groups);
                    window.scrollToMainProducts();
                };
                div.appendChild(viewBtn);

                // Auto-render to main page
                _renderRecommendationsOnMainPage(text, groups);
            }
        }

        // Suggested replies
        if (suggestedReplies && suggestedReplies.length > 0) {
            const chips = document.createElement('div');
            chips.className = 'ai-shop-suggestions';
            chips.style.marginTop = '8px';
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
        div.innerHTML = `<div class="ai-shop-bubble bot-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
        msgs.appendChild(div);
        _scrollBottom();
        return id;
    }

    function _removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
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

    // ── Product card ─────────────────────────────────────────────────────────────
    function _buildProductScrollArea(products) {
        const wrap = document.createElement('div');
        wrap.className = 'ai-product-scroll-wrap';
        wrap.style.cssText = 'display:flex; gap:10px; overflow-x:auto; padding:8px 0; margin-top:8px; scrollbar-width:thin;';

        products.slice(0, 6).forEach(p => {
            const card = _createProductCardElement(p);
            wrap.appendChild(card);
        });

        return wrap;
    }

    function _createProductCardElement(p) {
        const price = _formatCurrency(p.price ?? 0);
        const imgUrl = p.featuredImageUrl || 'https://via.placeholder.com/200';
        const isMall = p.isMall === true;
        const hasDiscount = (p.discountPct ?? 0) > 0;
        const originalPrice = p.originalPrice ? _formatCurrency(p.originalPrice) : '';
        const productId = p.id || '';
        const trackingId = p.recommendationLogId || '';

        const card = document.createElement('div');
        card.className = 'product-card fadeInUp';
        card.style.cssText = 'min-width:160px; max-width:160px; flex-shrink:0;';

        card.innerHTML = `
            ${isMall ? '<div class="badge-mall">Mall</div>' : ''}
            ${hasDiscount ? `<div class="discount-tag"><span>${p.discountPct}%</span><span>GIẢM</span></div>` : ''}
            <div class="product-image-box">
                <img src="${_escapeHtml(imgUrl)}" alt="" class="pcard-img" style="width:100%;height:120px;object-fit:cover;border-radius:8px;">
            </div>
            <div class="product-info" style="padding:6px 4px;">
                <span class="product-shop" style="font-size:0.7rem;color:#64748b;"><i class="fa fa-shop"></i> <span class="pcard-shop"></span></span>
                <h3 class="product-name pcard-name" style="font-size:0.8rem;margin:4px 0;line-height:1.3;cursor:pointer;"></h3>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span class="product-price" style="font-weight:700;font-size:0.85rem;color:#a855f7;">${price}</span>
                    ${hasDiscount && originalPrice ? `<span style="text-decoration:line-through;font-size:0.7rem;color:#94a3b8;">${originalPrice}</span>` : ''}
                </div>
                <span style="font-size:0.7rem;color:#94a3b8;">${p.salesCount ?? 0} đã bán</span>
                <div style="display:flex;gap:4px;margin-top:6px;">
                    <button class="pcard-detail" style="flex:1;padding:4px;font-size:0.7rem;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:6px;cursor:pointer;">
                        <i class="fa-solid fa-eye"></i> Chi tiết
                    </button>
                    <button class="pcard-cart" style="flex:1;padding:4px;font-size:0.7rem;border:none;background:linear-gradient(135deg,#667eea,#a855f7);color:#fff;border-radius:6px;cursor:pointer;font-weight:700;">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        `;

        // Set text safely (no HTML entity encoding for Vietnamese)
        const nameEl = card.querySelector('.pcard-name');
        const shopEl = card.querySelector('.pcard-shop');
        const imgEl = card.querySelector('.pcard-img');
        if (nameEl) nameEl.textContent = p.name ?? 'Sản phẩm';
        if (shopEl) shopEl.textContent = p.shopName ?? 'Zynk Shop';
        if (imgEl) imgEl.alt = p.name ?? '';

        // Event listeners
        const imageBox = card.querySelector('.product-image-box');
        if (imageBox) imageBox.addEventListener('click', () => window.trackAndOpenDetails && window.trackAndOpenDetails(productId, trackingId) || window.openProductModal && window.openProductModal(productId));
        if (nameEl) nameEl.addEventListener('click', () => window.trackAndOpenDetails && window.trackAndOpenDetails(productId, trackingId) || window.openProductModal && window.openProductModal(productId));
        card.querySelector('.pcard-detail')?.addEventListener('click', () => window.trackAndOpenDetails && window.trackAndOpenDetails(productId, trackingId) || window.openProductModal && window.openProductModal(productId));
        card.querySelector('.pcard-cart')?.addEventListener('click', (e) => window.trackAndAddToCart && window.trackAndAddToCart(productId, trackingId, e));

        return card;
    }

    // ── Render on main page ──────────────────────────────────────────────────────
    function _renderRecommendationsOnMainPage(query, groups) {
        const grid = document.getElementById('product-grid');
        const titleEl = document.getElementById('market-title');
        if (!grid) return;

        // Save original content
        if (!_originalGridContent) {
            _originalGridContent = grid.innerHTML;
        }

        // Update title safely
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
            header.innerHTML = `<i class="fa-solid fa-sparkles"></i> `;
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

    function _createMainProductCard(p) {
        const price = _formatCurrency(p.price ?? 0);
        const productId = p.id || '';
        const trackingId = p.recommendationLogId || '';

        const card = document.createElement('div');
        card.className = 'product-card';

        card.innerHTML = `
            <div class="product-image-box" style="cursor:pointer;">
                <img src="${_escapeHtml(p.featuredImageUrl || '')}" alt="" style="width:100%;object-fit:cover;">
            </div>
            <div class="product-info">
                <span class="product-shop"><i class="fa fa-shop"></i> <span class="mc-shop"></span></span>
                <h3 class="product-name mc-name" style="cursor:pointer;"></h3>
                <div class="product-meta">
                    <span class="product-price">${price}</span>
                    <span class="product-stats">${p.salesCount ?? 0} đã bán</span>
                </div>
                <div class="product-actions" style="display:flex;gap:6px;margin-top:8px;">
                    <button class="btn btn-small mc-detail" style="flex:1;"><i class="fa-solid fa-eye"></i> Chi tiết</button>
                    <button class="btn btn-small primary-btn mc-cart" style="flex:1;"><i class="fa-solid fa-cart-plus"></i> Thêm giỏ</button>
                </div>
            </div>
        `;

        // Set text via textContent to avoid Vietnamese encoding
        const nameEl = card.querySelector('.mc-name');
        const shopEl = card.querySelector('.mc-shop');
        if (nameEl) nameEl.textContent = p.name ?? 'Sản phẩm';
        if (shopEl) shopEl.textContent = p.shopName ?? 'Zynk Shop';

        // Events
        const imgBox = card.querySelector('.product-image-box');
        if (imgBox) imgBox.addEventListener('click', () => window.trackAndOpenDetails ? window.trackAndOpenDetails(productId, trackingId) : window.openProductModal && window.openProductModal(productId));
        if (nameEl) nameEl.addEventListener('click', () => window.trackAndOpenDetails ? window.trackAndOpenDetails(productId, trackingId) : window.openProductModal && window.openProductModal(productId));
        card.querySelector('.mc-detail')?.addEventListener('click', () => window.trackAndOpenDetails ? window.trackAndOpenDetails(productId, trackingId) : window.openProductModal && window.openProductModal(productId));
        card.querySelector('.mc-cart')?.addEventListener('click', (e) => window.trackAndAddToCart && window.trackAndAddToCart(productId, trackingId, e));

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
        actions.style.cssText = 'display:flex;align-items:center;margin-left:auto;margin-right:8px;gap:4px;';

        const newBtn = document.createElement('button');
        newBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        newBtn.title = 'Cuộc trò chuyện mới';
        newBtn.className = 'ai-shop-header-btn';
        newBtn.onclick = _startNewSession;
        actions.appendChild(newBtn);

        // History button only for logged-in users
        if (isLoggedIn()) {
            const histBtn = document.createElement('button');
            histBtn.innerHTML = '<i class="fa-solid fa-history"></i>';
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
            panel.style.cssText = 'background:#f8fafc;border-radius:12px;padding:12px;margin:8px 0;border:1px solid #e2e8f0;';
            panel.innerHTML = '<div style="font-weight:600;margin-bottom:8px;color:#334155;">📜 Lịch sử trò chuyện</div>';

            if (sessions.length === 0) {
                panel.innerHTML += '<p style="color:#94a3b8;font-size:0.85rem;">Chưa có lịch sử nào.</p>';
            } else {
                sessions.forEach(s => {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding:8px;border-radius:8px;cursor:pointer;margin-bottom:4px;border:1px solid #e2e8f0;background:#fff;font-size:0.82rem;';
                    item.textContent = s.title || 'Cuộc trò chuyện';
                    item.onclick = () => {
                        currentSessionId = s.id;
                        localStorage.setItem(LS_SESSION_KEY, s.id);
                        panel.remove();
                        _renderGreeting();
                    };
                    item.onmouseover = () => item.style.background = '#f1f5f9';
                    item.onmouseout = () => item.style.background = '#fff';
                    panel.appendChild(item);
                });
            }

            msgs.appendChild(panel);
            _scrollBottom();
        } catch (e) {
            console.warn('[AiChat] Could not load history:', e);
        }
    }

    // ── Add to cart from chat ─────────────────────────────────────────────────────
    window.addCartFromChat = function (id, name, price, img, shopName) {
        let cart = JSON.parse(localStorage.getItem('zynk_cart') || '[]');
        const existing = cart.find(i => i.cartItemId === id);
        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({
                id,
                cartItemId: id,
                variantId: null,
                variantName: null,
                shopName: shopName || 'Zynk Shop',
                name,
                price,
                image: img,
                qty: 1
            });
        }
        localStorage.setItem('zynk_cart', JSON.stringify(cart));
        _showCartFeedback();
        if (typeof updateCartCount === 'function') updateCartCount();
    };

    // ── Compare from chat ─────────────────────────────────────────────────────────
    window.compareProductFromChat = function (name) {
        if (window.sendAiShopSuggestion) {
            window.sendAiShopSuggestion(`So sánh sản phẩm "${name}" với các sản phẩm khác.`);
        }
    };

    // ── Cart feedback ─────────────────────────────────────────────────────────────
    function _showCartFeedback() {
        const cartFloat = document.getElementById('cart-float');
        if (cartFloat) {
            cartFloat.style.transform = 'scale(1.3)';
            setTimeout(() => { cartFloat.style.transform = ''; }, 300);
        }
        const toast = document.createElement('div');
        toast.textContent = '✅ Đã thêm vào giỏ hàng!';
        toast.style.cssText = `position:fixed;bottom:90px;right:20px;background:#22c55e;color:#fff;padding:10px 18px;border-radius:20px;font-size:0.85rem;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:fadeInUp .3s ease;`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
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
