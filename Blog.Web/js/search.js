// js/search.js
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (!query) {
        document.getElementById('search-title').textContent = 'Vui lòng nhập từ khóa tìm kiếm';
    } else {
        document.getElementById('search-title').textContent = `Kết quả tìm kiếm cho "${query}"`;
        await performSearch(query);
    }

    // Page search bar logic
    const pageInput = document.getElementById('page-search-input');
    const pageBtn = document.getElementById('page-search-btn');

    const doSearch = () => {
        if (!pageInput) return;
        const q = pageInput.value.trim();
        if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    };

    if (pageBtn) pageBtn.onclick = doSearch;
    if (pageInput) {
        if (query) pageInput.value = query;
        pageInput.onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
    }
});

async function performSearch(query) {
    const usersList = document.getElementById('users-results-list');
    const postsList = document.getElementById('posts-results-list');

    try {
        const results = await window.api.get(`search?q=${encodeURIComponent(query)}`);
        
        // Render Users
        const usersSection = usersList.closest('.search-section');
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
        const postsSection = postsList.closest('.search-section');
        if (results.posts.length === 0) {
            postsSection.classList.add('hidden');
        } else {
            postsSection.classList.remove('hidden');
            postsList.innerHTML = '';
            results.posts.forEach(post => {
                postsList.appendChild(window.common.createPostCard(post));
            });
        }

        // Final check: if both hidden, show "No results found" for everything
        if (results.users.length === 0 && results.posts.length === 0) {
            const container = document.querySelector('.search-results-container');
            container.innerHTML = `
                <div class="no-results">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    ${window.t('no_results_found')}
                </div>
            `;
        }

    } catch (error) {
        console.error('Search failed', error);
        const errorMsg = `Lỗi khi thực hiện tìm kiếm: ${error.message || 'Unknown error'}. 
            Vui lòng kiểm tra console hoặc đảm bảo Server đang chạy tại :7000`;
        usersList.innerHTML = `<p class="error">${errorMsg}</p>`;
        postsList.innerHTML = `<p class="error">${errorMsg}</p>`;
    }
}

function timeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " năm trước";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " tháng trước";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " ngày trước";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " giờ trước";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " phút trước";
    return "vừa xong";
}
