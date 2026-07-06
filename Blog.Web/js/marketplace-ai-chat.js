// marketplace-ai-chat.js — Zynk AI Shopping Assistant
// Handles the chat UI, API calls, rendering product recommendation cards.

(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────────────────────
    let chatHistory = [];
    let isTyping = false;
    let initialized = false;

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

    // ── Toggle open / close ────────────────────────────────────────────────────
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
                _renderGreeting();
            }
            // Auto-focus input
            setTimeout(() => {
                const inp = document.getElementById('ai-shop-chat-input');
                if (inp) inp.focus();
            }, 350);
        } else {
            win.classList.add('hidden');
            if (btn) btn.style.transform = '';
        }
    };

    // ── Key press handler ──────────────────────────────────────────────────────
    window.handleAiShopChatKeyPress = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAiShopChatMessage();
        }
    };

    // ── Send message ───────────────────────────────────────────────────────────
    window.sendAiShopChatMessage = async function () {
        if (isTyping) return;

        const input = document.getElementById('ai-shop-chat-input');
        const sendBtn = document.getElementById('ai-shop-chat-send-btn');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        _hideSuggestions();

        // Render user message
        _appendUserMessage(text);

        // Add to history
        chatHistory.push({ sender: 'Người dùng', text });

        // Show typing indicator
        const typingId = _appendTyping();
        isTyping = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            // Get search history from localStorage for personalization
            let searchKeywords = [];
            try {
                searchKeywords = JSON.parse(localStorage.getItem('zynk_search_history') || '[]');
            } catch(e) {
                console.error(e);
            }

            const payload = {
                question: text,
                history: chatHistory.slice(-8), // Send last 8 messages for context
                searchKeywords: searchKeywords
            };

            const res = await window.api.post('search/chat-products', payload);

            _removeTyping(typingId);
            isTyping = false;
            if (sendBtn) sendBtn.disabled = false;

            const botText = res.response || 'Xin lỗi, em chưa hiểu yêu cầu này. Bạn có thể mô tả rõ hơn không?';
            const products = res.recommendedProducts || [];
            const groups = res.groups || [];

            // Add bot response to history
            chatHistory.push({ sender: 'Zynk AI', text: botText });

            _appendBotMessage(botText, products, groups);

        } catch (err) {
            _removeTyping(typingId);
            isTyping = false;
            if (sendBtn) sendBtn.disabled = false;

            const errMsg = 'Ối! Có lỗi kết nối. Bạn vui lòng thử lại nhé 🙏';
            _appendBotMessage(errMsg, [], []);
            console.error('[AiShopChat] Error:', err);
        }
    };

    // ── Send from suggestion chip ──────────────────────────────────────────────
    window.sendAiShopSuggestion = function (text) {
        const input = document.getElementById('ai-shop-chat-input');
        if (input) {
            input.value = text;
            sendAiShopChatMessage();
        }
    };

    // ── Add to cart directly from chat ─────────────────────────────────────────
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
                img: img || '',
                qty: 1
            });
        }
        localStorage.setItem('zynk_cart', JSON.stringify(cart));

        // Update cart badge if function available
        if (typeof updateCartBadge === 'function') updateCartBadge();
        const badge = document.getElementById('cart-count');
        if (badge) {
            const total = cart.reduce((s, i) => s + i.qty, 0);
            badge.textContent = total;
        }

        // Feedback animation on button
        _showCartFeedback();
    };

    // ── Private helpers ────────────────────────────────────────────────────────
    function _renderGreeting() {
        _appendBotMessage(GREETING, []);
        _renderSuggestions();
    }

    function _renderSuggestions() {
        const container = document.getElementById('ai-shop-chat-window');
        if (!container) return;

        // Remove old suggestions if any
        const old = container.querySelector('.ai-shop-suggestions');
        if (old) old.remove();

        const msgs = document.getElementById('ai-shop-chat-messages');
        if (!msgs) return;

        const sugDiv = document.createElement('div');
        sugDiv.className = 'ai-shop-suggestions';
        sugDiv.id = 'ai-shop-suggestions-bar';
        SUGGESTIONS.forEach(s => {
            const chip = document.createElement('span');
            chip.className = 'ai-shop-suggestion-chip';
            chip.textContent = s;
            chip.onclick = () => window.sendAiShopSuggestion(s);
            sugDiv.appendChild(chip);
        });

        // Insert after messages, before input
        const inputArea = container.querySelector('.ai-shop-chat-input-area');
        container.insertBefore(sugDiv, inputArea);
    }

    function _hideSuggestions() {
        const bar = document.getElementById('ai-shop-suggestions-bar');
        if (bar) {
            bar.style.transition = 'opacity 0.2s';
            bar.style.opacity = '0';
            setTimeout(() => bar.remove(), 250);
        }
    }

    function _appendUserMessage(text) {
        const container = document.getElementById('ai-shop-chat-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-shop-msg user';
        msgDiv.innerHTML = `
            <div class="ai-shop-bubble">${_escapeHtml(text)}</div>
            <span class="ai-shop-msg-time">${_getTime()}</span>
        `;
        container.appendChild(msgDiv);
        _scrollToBottom(container);
    }

    function _appendBotMessage(text, products, groups) {
        const container = document.getElementById('ai-shop-chat-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-shop-msg bot';

        // Format text with bold (**text**) support
        const formattedText = _formatText(text);

        let html = `<div class="ai-shop-bubble">${formattedText}`;

        // Render on the main page instead of inside the chat window
        const hasRecs = (groups && groups.length > 0) || (products && products.length > 0);
        if (hasRecs) {
            const query = chatHistory[chatHistory.length - 2]?.text || 'yêu cầu của bạn';
            _renderRecommendationsOnMainPage(query, products, groups);

            const totalCount = groups && groups.length > 0
                ? groups.reduce((sum, g) => sum + (g.products ? g.products.length : 0), 0)
                : (products ? products.length : 0);

            html += `
                <div class="ai-shop-main-page-indicator">
                    <i class="fa-solid fa-circle-check"></i> Đã tìm thấy ${totalCount} sản phẩm phù hợp và hiển thị trực tiếp ở trang chính.
                    <button class="ai-shop-scroll-to-main-btn" onclick="window.scrollToMainProducts()">
                        Xem ngay <i class="fa-solid fa-arrow-down"></i>
                    </button>
                </div>
            `;
        }

        html += `</div>`;
        html += `<span class="ai-shop-msg-time">${_getTime()}</span>`;
        msgDiv.innerHTML = html;
        container.appendChild(msgDiv);
        _scrollToBottom(container);
    }

    function _appendTyping() {
        const container = document.getElementById('ai-shop-chat-messages');
        if (!container) return null;

        const id = 'ai-typing-' + Date.now();
        const wrap = document.createElement('div');
        wrap.className = 'ai-shop-msg bot';
        wrap.id = id;
        wrap.innerHTML = `
            <div class="ai-shop-typing">
                <span></span><span></span><span></span>
            </div>
        `;
        container.appendChild(wrap);
        _scrollToBottom(container);
        return id;
    }

    function _removeTyping(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function _renderRecommendationsOnMainPage(query, products, groups) {
        const grid = document.getElementById('product-grid');
        const titleEl = document.getElementById('market-title');
        if (!grid) return;

        // 1. Update Title
        if (titleEl) {
            titleEl.innerHTML = `🤖 Zynk AI gợi ý cho: "${_escapeHtml(query)}" 
                <button onclick="window.resetAiRecommendations()" class="glass-btn-reset">
                    <i class="fa-solid fa-rotate-left"></i> Quay lại gợi ý thường
                </button>`;
        }

        // 2. Clear grid
        grid.innerHTML = '';

        // 3. Render Groups or Flat list
        let index = 0;
        if (groups && groups.length > 0) {
            groups.forEach(g => {
                const header = document.createElement('div');
                header.className = 'ai-recommendation-group-header';
                header.innerHTML = `<i class="fa-solid fa-sparkles" style="color: #a855f7;"></i> ${_escapeHtml(g.label)}`;
                grid.appendChild(header);

                g.products.forEach(p => {
                    grid.appendChild(_createProductCardElement(p, index++));
                });
            });
        } else if (products && products.length > 0) {
            products.forEach(p => {
                grid.appendChild(_createProductCardElement(p, index++));
            });
        } else {
            grid.innerHTML = '<div class="no-posts" style="grid-column: 1/-1;"><i class="fa fa-box-open"></i><p>Không tìm thấy sản phẩm phù hợp.</p></div>';
        }
    }

    function _createProductCardElement(p, index) {
        const isMall = index % 3 === 0;
        const hasDiscount = index % 2 === 0;
        const discountPct = Math.floor(Math.random() * 20) + 10;
        const price = _formatCurrency(p.price ?? 0);
        const originalPrice = _formatCurrency((p.price ?? 0) * 1.2);
        const shopName = _escapeHtml(p.shopName ?? 'Zynk Shop');
        const name = _escapeHtml(p.name ?? 'Sản phẩm');
        const imgUrl = p.featuredImageUrl || 'https://via.placeholder.com/300';
        
        const card = document.createElement('div');
        card.className = 'product-card fadeInUp';
        card.innerHTML = `
            ${isMall ? '<div class="badge-mall">Mall</div>' : ''}
            ${hasDiscount ? `<div class="discount-tag"><span>${discountPct}%</span><span>GIẢM</span></div>` : ''}
            <div class="product-image-box">
                <img src="${imgUrl}" alt="${name}">
            </div>
            <div class="product-info">
                <span class="product-shop"><i class="fa fa-shop"></i> ${shopName}</span>
                <h3 class="product-name">${name}</h3>
                <div class="product-meta">
                    <div>
                        <span class="product-price">${price}</span>
                        ${hasDiscount ? `<div class="price-original">${originalPrice}</div>` : ''}
                    </div>
                    <span class="product-stats">${p.salesCount ?? 0} đã bán</span>
                </div>
            </div>
        `;
        card.onclick = () => {
            if (typeof openProductModal === 'function') {
                openProductModal(p.id);
            }
        };
        return card;
    }

    window.resetAiRecommendations = function () {
        const titleEl = document.getElementById('market-title');
        if (titleEl) {
            titleEl.innerHTML = 'Gợi ý hôm nay';
        }
        if (typeof loadProducts === 'function') {
            loadProducts();
        }
    };

    window.scrollToMainProducts = function () {
        const titleEl = document.getElementById('market-title');
        if (titleEl) {
            titleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    function _scrollToBottom(container) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }

    function _formatCurrency(amount) {
        if (typeof window.common !== 'undefined' && window.common.formatCurrency) {
            return window.common.formatCurrency(amount);
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    function _getTime() {
        return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    function _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _formatText(text) {
        // Escape HTML first, then apply bold formatting
        let escaped = _escapeHtml(text);
        // Convert **text** to <strong>
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Convert bullet list lines starting with • or -
        escaped = escaped.replace(/^[•\-]\s(.+)$/gm, '<span style="display:block;padding-left:8px">• $1</span>');
        return escaped;
    }

    function _showCartFeedback() {
        // Flash the floating cart button
        const cartFloat = document.getElementById('cart-float');
        if (cartFloat) {
            cartFloat.style.transform = 'scale(1.3)';
            cartFloat.style.transition = 'transform 0.2s ease';
            setTimeout(() => {
                cartFloat.style.transform = '';
            }, 300);
        }
        // Small toast notification
        const toast = document.createElement('div');
        toast.textContent = '✅ Đã thêm vào giỏ hàng!';
        toast.style.cssText = `
            position: fixed;
            bottom: 170px;
            right: 32px;
            background: linear-gradient(135deg, #667eea, #a855f7);
            color: #fff;
            padding: 10px 18px;
            border-radius: 24px;
            font-size: 0.82rem;
            font-weight: 600;
            box-shadow: 0 6px 20px rgba(102,126,234,0.4);
            z-index: 9999;
            animation: msgSlideIn 0.3s ease;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 1800);
    }

})();
