// js/post-actions.js

window.postActions = {
    async toggleLike(postId, btnElement) {
        if (!localStorage.getItem('auth_token')) {
            window.location.href = 'auth.html';
            return;
        }

        try {
            const result = await window.api.post(`posts/${postId}/like`);
            const heartIcon = btnElement.querySelector('i');
            
            const card = btnElement.closest('.post-card');
            if (card) {
                const countDiv = card.querySelector('.post-likes-count');
                if (countDiv) countDiv.textContent = `${result.likeCount} lượt thích`;
            } else {
                const likeCountSpan = btnElement.querySelector('span');
                if (likeCountSpan) likeCountSpan.textContent = result.likeCount;
            }

            if (result.isLiked) {
                heartIcon.classList.remove('fa-regular');
                heartIcon.classList.add('fa-solid');
                heartIcon.style.color = '#EF4444';
                btnElement.classList.add('liked');
            } else {
                heartIcon.classList.remove('fa-solid');
                heartIcon.classList.add('fa-regular');
                heartIcon.style.color = '';
                btnElement.classList.remove('liked');
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    },

    toggleComments(postId, cardElement) {
        let commentSection = cardElement.querySelector('.comment-section');
        if (!commentSection) {
            commentSection = this.createCommentSection(postId);
            const contentArea = cardElement.querySelector('.post-content-area') || cardElement.querySelector('.post-main-col') || cardElement;
            contentArea.appendChild(commentSection);
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
        if (!confirm('Bạn có chắc chắn muốn xóa BÀI VIẾT này vĩnh viễn khỏi SQL không? Thao tác này không thể hoàn tác!')) return;
        try {
            const btnDelete = document.querySelector(`.post-card[data-id="${postId}"] .options-menu .delete`);
            if (btnDelete) btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Xóa...';
            
            await window.api.delete(`posts/${postId}`);
            
            const card = document.querySelector(`.post-card[data-id="${postId}"]`);
            if (card) {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => card.remove(), 400);
            } else {
                window.location.reload();
            }
        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    },

    async reportPost(postId, authorId) {
        console.log('reportPost called for:', postId, authorId);
        
        if (!postId) {
            console.error('Missing postId');
            return;
        }

        this.injectReportModal();
        const modal = document.getElementById('report-modal');
        
        if (!modal) {
            console.warn('Report modal not found, using prompt fallback');
            const reason = prompt('Lý do báo cáo:');
            if (reason) this._submitReport(postId, reason);
            return;
        }

        const postIdInput = document.getElementById('report-post-id');
        const authorIdInput = document.getElementById('report-author-id');
        
        if (postIdInput) postIdInput.value = postId;
        if (authorIdInput) authorIdInput.value = authorId || '';
        
        modal.classList.remove('hidden');

        // Reset form
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.reset();
            const otherText = document.getElementById('report-other-text');
            if (otherText) otherText.classList.add('hidden');

            // Setup "Other" listener
            const otherRadio = document.getElementById('reason-other-radio');
            
            document.querySelectorAll('input[name="report-reason"]').forEach(radio => {
                radio.onchange = () => {
                    if (otherRadio && otherRadio.checked) {
                        if (otherText) otherText.classList.remove('hidden');
                    } else {
                        if (otherText) otherText.classList.add('hidden');
                    }
                };
            });

            // Form submit - using window.postActions to be safe with 'this'
            reportForm.onsubmit = async (e) => {
                e.preventDefault();
                const selectedReasonEl = reportForm.querySelector('input[name="report-reason"]:checked');
                if (!selectedReasonEl) {
                    alert('Vui lòng chọn một lý do.');
                    return;
                }
                
                const selectedReason = selectedReasonEl.value;
                let finalReason = selectedReason;
                
                if (selectedReason === 'Khác') {
                    const detail = otherText ? otherText.value.trim() : '';
                    if (!detail) {
                        alert('Vui lòng nhập lý do cụ thể.');
                        return;
                    }
                    finalReason = `Khác: ${detail}`;
                }

                try {
                    const result = await window.api.post('reports', { postId, reason: finalReason });
                    window.postActions.closeReportModal();
                    
                    // Block Suggestion
                    if (authorId && authorId !== 'undefined' && authorId !== 'null') {
                        setTimeout(() => {
                            if (confirm(`${result.message}\n\nBạn có muốn chặn người dùng này để không bao giờ thấy bài viết của họ nữa không?`)) {
                                window.postActions.blockUser(authorId);
                            }
                        }, 500);
                    } else {
                        alert(result.message);
                    }
                } catch (error) {
                    alert('Lỗi gửi báo cáo: ' + error.message);
                }
            };
        }
    },

    closeReportModal() {
        const modal = document.getElementById('report-modal');
        if (modal) modal.classList.add('hidden');
    },

    async _submitReport(postId, reason) {
        try {
            const result = await window.api.post('reports', { postId, reason });
            alert(result.message);
        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    },

    async blockUser(authorId) {
        if (!authorId || authorId === 'undefined') return;
        try {
            const result = await window.api.post(`users/${authorId}/block`);
            alert(result.message);
            window.location.reload();
        } catch (error) {
            alert('Lỗi khi chặn người dùng: ' + error.message);
        }
    },

    injectReportModal() {
        if (document.getElementById('report-modal')) return;

        const modalHtml = `
            <div id="report-modal" class="modal-overlay hidden">
                <div class="modal-content report-modal-content">
                    <div class="modal-header">
                        <h3>Báo cáo vi phạm</h3>
                        <button class="close-btn" onclick="closeReportModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-secondary);">Chúng tôi sẽ xem xét bài viết này dựa trên lý do bạn cung cấp.</p>
                        <form id="report-form">
                            <input type="hidden" id="report-post-id">
                            <input type="hidden" id="report-author-id">
                            
                            <div class="report-options">
                                <label class="report-opt">
                                    <input type="radio" name="report-reason" value="Tôi không thích nội dung này" checked>
                                    <span>Tôi không thích nội dung này</span>
                                </label>
                                <label class="report-opt">
                                    <input type="radio" name="report-reason" value="Vấn đề nhạy cảm/khiêu dâm">
                                    <span>Vấn đề nhạy cảm/khiêu dâm</span>
                                </label>
                                <label class="report-opt">
                                    <input type="radio" name="report-reason" value="Bạo lực">
                                    <span>Bạo lực</span>
                                </label>
                                <label class="report-opt">
                                    <input type="radio" name="report-reason" value="Phản động">
                                    <span>Phản động</span>
                                </label>
                                <label class="report-opt">
                                    <input type="radio" name="report-reason" value="Khác" id="reason-other-radio">
                                    <span>Khác...</span>
                                </label>
                            </div>

                            <textarea id="report-other-text" class="hidden" placeholder="Vui lòng cung cấp thêm thông tin..." rows="3" style="width: 100%; margin-top: 10px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);"></textarea>
                            
                            <div style="margin-top: 1.5rem; display: flex; gap: 10px;">
                                <button type="button" class="btn secondary-btn" style="width: 100%;" onclick="closeReportModal()">Hủy</button>
                                <button type="submit" class="btn primary-btn" style="width: 100%;" id="submit-report-btn">Gửi báo cáo</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
};

// Global helpers for modal
window.closeReportModal = () => postActions.closeReportModal();
