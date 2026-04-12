// js/post-actions.js

window.postActions = {
    async toggleLike(postId, btnElement) {
        if (!localStorage.getItem('auth_token')) {
            window.location.href = 'auth.html';
            return;
        }

        try {
            const result = await window.api.post(`posts/${postId}/like`);
            const likeCountSpan = btnElement.querySelector('span');
            const heartIcon = btnElement.querySelector('i');
            
            likeCountSpan.textContent = result.likeCount;
            if (result.isLiked) {
                heartIcon.classList.remove('fa-regular');
                heartIcon.classList.add('fa-solid');
                heartIcon.style.color = '#EF4444';
            } else {
                heartIcon.classList.remove('fa-solid');
                heartIcon.classList.add('fa-regular');
                heartIcon.style.color = '';
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    },

    toggleComments(postId, cardElement) {
        let commentSection = cardElement.querySelector('.comment-section');
        if (!commentSection) {
            commentSection = this.createCommentSection(postId);
            cardElement.querySelector('.post-main-col').appendChild(commentSection);
            this.loadComments(postId, commentSection);
        } else {
            commentSection.classList.toggle('hidden');
        }
    },

    createCommentSection(postId) {
        const section = document.createElement('div');
        section.className = 'comment-section';
        section.innerHTML = `
            <div class="comment-input-area">
                <input type="text" placeholder="Viết bình luận..." class="reply-input">
                <button onclick="postActions.sendComment('${postId}', this)">Gửi</button>
            </div>
            <div class="comments-list">
                <div class="loader-small">Đang tải bình luận...</div>
            </div>
        `;
        return section;
    },

    async loadComments(postId, section) {
        const list = section.querySelector('.comments-list');
        try {
            const comments = await window.api.get(`posts/${postId}/comments`);
            list.innerHTML = '';
            if (comments.length === 0) {
                list.innerHTML = '<p class="no-comments">Chưa có bình luận nào.</p>';
            } else {
                comments.forEach(c => {
                    list.appendChild(this.renderCommentItem(c, postId));
                });
            }
        } catch (error) {
            list.innerHTML = '<p class="error">Lỗi khi tải bình luận.</p>';
        }
    },

    renderCommentItem(comment, postId) {
        const div = document.createElement('div');
        div.className = 'comment-item';
        div.id = `comment-${comment.id}`;
        
        const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
        const token = localStorage.getItem('auth_token');
        
        // Find if user has permission to delete: either they wrote it OR they own the post
        // (Post ownership is harder to check here without post info, but I'll add the button if it's my post author ID)
        // For simplicity, I'll pass postAuthorId or let the backend handle the check.
        // I'll show Delete if it's the current user's comment for now. 
        // Backend already handles post-owner deletion.
        const isMyComment = currentUser.id === comment.authorId;
        
        div.innerHTML = `
            <img src="${comment.authorAvatarUrl || 'https://ui-avatars.com/api/?name=' + comment.authorName}" class="mini-avatar">
            <div class="comment-content-box">
                <div class="comment-header-row">
                    <span class="comment-author">${comment.authorName}</span>
                    <span class="comment-time">${formatDate(comment.createdAt)}</span>
                </div>
                <p class="comment-text">${comment.content}</p>
                <div class="comment-actions">
                    <button class="action-link" onclick="window.postActions.showReplyInput('${postId}', '${comment.id}', this)">Trả lời</button>
                    ${isMyComment ? `<button class="action-link delete" onclick="window.postActions.deleteComment('${postId}', '${comment.id}')">Xóa</button>` : ''}
                </div>
                <div class="replies-container" id="replies-${comment.id}">
                    ${(comment.replies || []).map(r => this.renderCommentItem(r, postId).outerHTML).join('')}
                </div>
            </div>
        `;
        return div;
    },

    async sendComment(postId, btn) {
        const input = btn.previousElementSibling;
        const content = input.value.trim();
        if (!content) return;

        if (!localStorage.getItem('auth_token')) {
            window.location.href = 'auth.html';
            return;
        }

        btn.disabled = true;
        try {
            const comment = await window.api.post(`posts/${postId}/comments`, { content });
            input.value = '';
            const list = btn.closest('.comment-section').querySelector('.comments-list');
            const noRes = list.querySelector('.no-comments');
            if (noRes) noRes.remove();
            list.prepend(this.renderCommentItem(comment));
        } catch (error) {
            alert('Lỗi khi gửi bình luận');
        } finally {
            btn.disabled = false;
        }
    },

    showReplyInput(postId, parentId, btn) {
        const container = btn.closest('.comment-content-box');
        let replyArea = container.querySelector(`.reply-area-${parentId}`);
        if (replyArea) {
            replyArea.classList.toggle('hidden');
            return;
        }

        replyArea = document.createElement('div');
        replyArea.className = `comment-input-area reply-area-${parentId}`;
        replyArea.style.marginTop = '10px';
        replyArea.innerHTML = `
            <input type="text" placeholder="Trả lời bình luận..." class="reply-input">
            <button onclick="window.postActions.sendReply('${postId}', '${parentId}', this)">Gửi</button>
        `;
        container.appendChild(replyArea);
    },

    async sendReply(postId, parentId, btn) {
        const input = btn.previousElementSibling;
        const content = input.value.trim();
        if (!content) return;

        console.log(`Sending reply to post ${postId}, parent ${parentId}: "${content}"`);
        btn.disabled = true;
        try {
            const reply = await window.api.post(`posts/${postId}/comments`, { content, parentCommentId: parentId });
            console.log('Reply saved:', reply);
            input.value = '';
            const repliesList = document.getElementById(`replies-${parentId}`);
            repliesList.innerHTML += this.renderCommentItem(reply, postId).outerHTML;
            btn.closest(`.reply-area-${parentId}`).classList.add('hidden');
        } catch (error) {
            alert('Lỗi khi gửi phản hồi');
        } finally {
            btn.disabled = false;
        }
    },

    async deleteComment(postId, commentId) {
        if (!confirm('Bạn có chắc chắn muốn xóa bình luận này không?')) return;
        console.log(`Deleting comment ${commentId} from post ${postId}`);
        try {
            await window.api.delete(`posts/${postId}/comments/${commentId}`);
            console.log('Comment deleted successfully');
            const el = document.getElementById(`comment-${commentId}`);
            if (el) el.remove();
        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    },

    async deletePost(postId) {
        if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
        try {
            await window.api.delete(`posts/${postId}`);
            window.location.reload();
        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    }
};
