// js/search.js
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (!query) {
        document.getElementById('search-title').textContent = window.t('search_query_empty');
        return;
    }

    document.getElementById('search-title').textContent = `${window.t('search_results_for')} "${query}"`;
    await performSearch(query);
});

async function performSearch(query) {
    const usersList = document.getElementById('users-results-list');
    const postsList = document.getElementById('posts-results-list');

    try {
        const results = await window.api.get(`search?q=${encodeURIComponent(query)}`);
        
        // Render Users
        usersList.innerHTML = '';
        if (results.users.length === 0) {
            usersList.innerHTML = `<div class="no-results"><i class="fa-solid fa-user-slash"></i> ${window.t('no_users_found')}</div>`;
        } else {
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
        postsList.innerHTML = '';
        if (results.posts.length === 0) {
            postsList.innerHTML = `<div class="no-results"><i class="fa-solid fa-file-circle-xmark"></i> ${window.t('no_posts_found')}</div>`;
        } else {
            results.posts.forEach(post => {
                const card = document.createElement('div');
                card.className = 'user-result-card'; // Reusing style for simplicity or create post-card
                card.onclick = () => window.location.href = `index.html`; // Should go to post detail if exists
                
                card.innerHTML = `
                    <div class="user-result-info">
                        <h4>${post.title}</h4>
                        <p>${window.t('by_author')} ${post.authorName} • ${new Date(post.createdAt).toLocaleDateString()}</p>
                        ${post.summary ? `<p>${post.summary}</p>` : ''}
                    </div>
                `;
                postsList.appendChild(card);
            });
        }

    } catch (error) {
        console.error('Search failed', error);
        const errorMsg = `Lỗi khi thực hiện tìm kiếm: ${error.message || 'Unknown error'}. 
            Vui lòng kiểm tra console hoặc đảm bảo Server đang chạy tại :7000`;
        usersList.innerHTML = `<p class="error">${errorMsg}</p>`;
        postsList.innerHTML = `<p class="error">${errorMsg}</p>`;
    }
}
