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

        let html = `<div class="ai-shop-bubble">${formattedText}</div>`;

        // Render product cards (grouped or flat)
        if (groups && groups.length > 0) {
            html += _buildGroupedProductCards(groups);
        } else if (products && products.length > 0) {
            html += _buildProductCards(products);
        }

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

    function _buildGroupedProductCards(groups) {
        let html = '<div class="ai-shop-grouped-container">';
        groups.forEach(g => {
            html += `
                <div class="ai-shop-group-section">
                    <div class="ai-shop-group-header">${_escapeHtml(g.label)}</div>
                    ${_buildProductCards(g.products)}
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    function _buildProductCards(products) {
        let html = '<div class="ai-shop-product-cards">';
        products.forEach(p => {
            const price = _formatCurrency(p.price ?? 0);
            const rating = (p.rating ?? 5).toFixed(1);
            const stars = '★'.repeat(Math.round(p.rating ?? 5)) + '☆'.repeat(5 - Math.round(p.rating ?? 5));
            const shopName = _escapeHtml(p.shopName ?? 'Zynk Shop');
            const name = _escapeHtml(p.name ?? 'Sản phẩm');
            const imgUrl = p.featuredImageUrl ?? '';
            const id = p.id ?? '';

            const imgHtml = imgUrl
                ? `<img class="ai-shop-product-img" src="${_escapeHtml(imgUrl)}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const placeholderHtml = `<div class="ai-shop-product-img-placeholder" style="${imgUrl ? 'display:none' : ''}">🛍️</div>`;

            html += `
                <div class="ai-shop-product-card">
                    ${imgHtml}
                    ${placeholderHtml}
                    <div class="ai-shop-product-info">
                        <div class="ai-shop-product-name" title="${name}">${name}</div>
                        <div class="ai-shop-product-shop">
                            <i class="fa-solid fa-store"></i>${shopName}
                        </div>
                        <div class="ai-shop-product-meta">
                            <span class="ai-shop-product-price">${price}</span>
                            <span class="ai-shop-product-rating" title="${rating} sao">${stars} ${rating}</span>
                        </div>
                        <div class="ai-shop-product-actions">
                            <button class="ai-shop-product-btn view" onclick="openProductModal('${_escapeHtml(id)}')">
                                <i class="fa-regular fa-eye"></i> Xem
                            </button>
                            <button class="ai-shop-product-btn cart" onclick="addCartFromChat('${_escapeHtml(id)}','${name.replace(/'/g,"\\'")}',${p.price ?? 0},'${_escapeHtml(imgUrl)}','${shopName.replace(/'/g,"\\'")}')">
                                <i class="fa-solid fa-cart-plus"></i> Giỏ hàng
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

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
