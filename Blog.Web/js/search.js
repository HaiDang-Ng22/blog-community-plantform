// js/search.js v2.0
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const isAi = urlParams.get('ai') === 'true';
    
    const aiCheckbox = document.getElementById('ai-search-checkbox');
    if (aiCheckbox) {
        aiCheckbox.checked = isAi;
    }

    if (!query) {
        document.getElementById('search-title').textContent = 'Vui lòng nhập từ khóa tìm kiếm';
    } else {
        document.getElementById('search-title').textContent = `Kết quả tìm kiếm cho "${query}"`;
        await performSearch(query, isAi);
    }

    // Page search bar logic
    const pageInput = document.getElementById('page-search-input');
    const pageBtn = document.getElementById('page-search-btn');

    const doSearch = () => {
        if (!pageInput) return;
        const q = pageInput.value.trim();
        const useAi = aiCheckbox ? aiCheckbox.checked : false;
        if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}&ai=${useAi}`;
    };

    if (pageBtn) pageBtn.onclick = doSearch;
    if (pageInput) {
        if (query) pageInput.value = query;
        pageInput.onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
    }

    // Setup Chatbot Bubble Listener
    const bubble = document.getElementById('ai-assistant-widget');
    if (bubble) {
        bubble.addEventListener('click', toggleAiChat);
    }
});

async function performSearch(query, isAi = false) {
    const usersList = document.getElementById('users-results-list');
    const postsList = document.getElementById('posts-results-list');
    const productsList = document.getElementById('products-results-list');
    const productsSection = document.getElementById('products-search-section');

    const usersSection = usersList.closest('.search-section');
    const postsSection = postsList.closest('.search-section');

    // Reset visibility
    usersSection.classList.remove('hidden');
    postsSection.classList.remove('hidden');
    if (productsSection) productsSection.classList.add('hidden');

    usersList.innerHTML = '<div class="loading-spinner"></div>';
    postsList.innerHTML = '<div class="loading-spinner"></div>';
    if (productsList) productsList.innerHTML = '';

    try {
        if (isAi) {
            // Hide users section since AI search is currently designed for content/products semantic search
            usersSection.classList.add('hidden');
            postsList.innerHTML = '';
            
            const results = await window.api.get(`search/ai?q=${encodeURIComponent(query)}`);
            
            let postsCount = 0;
            let productsCount = 0;

            if (results && results.length > 0) {
                if (productsSection) productsSection.classList.remove('hidden');
                
                results.forEach(res => {
                    if (res.type === 'Post') {
                        postsCount++;
                        const container = createPostCardWithAi(res.item, res.explanation, res.score);
                        postsList.appendChild(container);
                    } else if (res.type === 'Product') {
                        productsCount++;
                        const container = createProductCard(res.item, res.explanation, res.score);
                        if (productsList) productsList.appendChild(container);
                    }
                });
            }

            if (postsCount === 0) postsSection.classList.add('hidden');
            if (productsCount === 0 && productsSection) productsSection.classList.add('hidden');

            if (postsCount === 0 && productsCount === 0) {
                showNoResults();
            }
        } else {
            // Traditional Search
            const results = await window.api.get(`search?q=${encodeURIComponent(query)}`);
            
            // Render Users
            if (results.users.length === 0) {
                usersSection.classList.add('hidden');
            } else {
                usersSection.classList.remove('hidden');
                usersList.innerHTML = '';
                results.users.forEach(user => {
                    const card = document.createElement('div');
                    card.className = 'user-result-card';
                    card.onclick = () => window.location.href = `profile.html?id=${user.id}`;
                    
                    const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;
                    
                    card.innerHTML = `
                        <img src="${avatar}" alt="Avatar">
                        <div class="user-result-info">
                            <h4>${user.fullName}</h4>
                            <p>@${user.username}</p>
                            ${user.bio ? `<p class="bio-preview">${user.bio.substring(0, 60)}...</p>` : ''}
                        </div>
                    `;
                    usersList.appendChild(card);
                });
            }

            // Render Posts
            if (results.posts.length === 0) {
                postsSection.classList.add('hidden');
            } else {
                postsSection.classList.remove('hidden');
                postsList.innerHTML = '';
                results.posts.forEach(post => {
                    postsList.appendChild(window.common.createPostCard(post));
                });
            }

            if (results.users.length === 0 && results.posts.length === 0) {
                showNoResults();
            }
        }
    } catch (error) {
        console.error('Search failed', error);
        const errorMsg = `Lỗi khi thực hiện tìm kiếm: ${error.message || 'Unknown error'}.`;
        postsList.innerHTML = `<p class="error">${errorMsg}</p>`;
    }
}

function showNoResults() {
    const container = document.querySelector('.search-results-container');
    container.innerHTML = `
        <div class="no-results">
            <i class="fa-solid fa-magnifying-glass"></i>
            Không tìm thấy kết quả phù hợp. Hãy thử từ khóa khác hoặc bật Tìm kiếm bằng AI ✨
        </div>
    `;
}

function createPostCardWithAi(post, explanation, score) {
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '6px';
    card.style.marginBottom = '20px';
    
    const aiBadgeHtml = explanation ? `
        <div class="ai-badge">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span><strong>Gợi ý từ AI (${Math.round(score * 100)}%):</strong> ${explanation}</span>
        </div>
    ` : '';

    const postCard = window.common.createPostCard(post);
    
    const badgeFragment = document.createRange().createContextualFragment(aiBadgeHtml);
    card.appendChild(badgeFragment);
    card.appendChild(postCard);
    return card;
}

function createProductCard(product, explanation, score) {
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '6px';
    card.style.marginBottom = '20px';
    
    const aiBadgeHtml = explanation ? `
        <div class="ai-badge">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span><strong>Gợi ý từ AI (${Math.round(score * 100)}%):</strong> ${explanation}</span>
        </div>
    ` : '';

    const image = product.featuredImageUrl || 'https://ui-avatars.com/api/?name=Product&background=random';
    const priceFormatted = window.common && window.common.formatCurrency 
        ? window.common.formatCurrency(product.price) 
        : product.price.toLocaleString('vi-VN') + ' đ';

    card.innerHTML = `
        ${aiBadgeHtml}
        <div class="product-result-card" onclick="window.location.href='marketplace.html?id=${product.id}'">
            <img src="${image}" alt="Product" class="product-result-img">
            <div class="product-result-info">
                <div>
                    <h4 class="product-result-title">${product.name}</h4>
                    <p class="product-result-desc">${product.description || 'Không có mô tả.'}</p>
                </div>
                <div class="product-result-footer">
                    <span class="product-result-price">${priceFormatted}</span>
                    <span class="product-result-shop"><i class="fa-solid fa-store"></i> ${product.shopName || 'Cửa hàng'}</span>
                </div>
            </div>
        </div>
    `;
    return card;
}

// Chatbot functions
window.toggleAiChat = function() {
    const windowEl = document.getElementById('ai-chat-window');
    if (windowEl) {
        windowEl.classList.toggle('hidden');
    }
};

window.handleAiChatKeyPress = function(e) {
    if (e.key === 'Enter') {
        sendAiChatMessage();
    }
};

window.sendAiChatMessage = async function() {
    const input = document.getElementById('ai-chat-input');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    appendChatMessage(text, 'user');
    
    const loadingId = appendChatLoading();
    
    try {
        const res = await window.api.get(`search/chat?q=${encodeURIComponent(text)}`);
        removeChatLoading(loadingId);
        appendChatMessage(res.response, 'bot');
    } catch (err) {
        removeChatLoading(loadingId);
        appendChatMessage('Lỗi kết nối. Không thể liên lạc được với Zynk AI.', 'bot');
        console.error('Chat error:', err);
    }
};

function appendChatMessage(text, sender) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;
    
    const message = document.createElement('div');
    message.className = `ai-message ${sender}`;
    message.textContent = text;
    
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendChatLoading() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return null;
    
    const id = 'ai-loading-' + Date.now();
    const message = document.createElement('div');
    message.className = 'ai-message bot';
    message.id = id;
    message.innerHTML = `
        <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeChatLoading(id) {
    if (!id) return;
    const loader = document.getElementById(id);
    if (loader) {
        loader.remove();
    }
}
