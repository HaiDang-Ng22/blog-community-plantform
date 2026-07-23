// js/post-actions.js

window.postActions = {
    async toggleLike(postId, btnElement) {
        if (!localStorage.getItem('auth_token')) {
            window.location.href = 'auth.html';
            return;
        }

        try {
            const result = await window.api.post(`posts/${postId}/like`);
            // Target specific modal IDs if they exist
            const modalIcon = document.getElementById('modal-like-icon');
            const modalCount = document.getElementById('modal-like-count');
            
            // 1. Update Modal specifically if the interaction happened there or modal is open
            if (modalIcon) {
                if (result.isLiked) {
                    modalIcon.classList.replace('fa-regular', 'fa-solid');
                    modalIcon.style.color = '#EF4444';
                } else {
                    modalIcon.classList.replace('fa-solid', 'fa-regular');
                    modalIcon.style.color = '';
                }
                if (modalCount) modalCount.textContent = `${result.likeCount} lượt thích`;
            }

            // 2. Update button state directly if provided (e.g. on Reels)
            if (btnElement) {
                const icon = btnElement.querySelector('i');
                const span = btnElement.querySelector('span');
                if (icon) {
                    if (result.isLiked) {
                        icon.className = 'fa-solid fa-heart';
                        icon.style.color = '#EF4444';
                        btnElement.classList.add('liked');
                    } else {
                        icon.className = 'fa-regular fa-heart';
                        icon.style.color = '';
                        btnElement.classList.remove('liked');
                    }
                }
                if (span) {
                    span.textContent = result.likeCount;
                }
            }

            // 3. Update feed card (if it exists on the page)
            const card = document.getElementById(`post-${postId}`) || (btnElement && btnElement.closest('.zynk-post-card'));
            if (card) {
                const icon = card.querySelector('.fa-heart');
                if (icon) {
                    if (result.isLiked) {
                        icon.classList.replace('fa-regular', 'fa-solid');
                        icon.style.color = '#EF4444';
                    } else {
                        icon.classList.replace('fa-solid', 'fa-regular');
                        icon.style.color = '';
                    }
                }
                const countDiv = card.querySelector('.zynk-stats');
                if (countDiv) countDiv.textContent = `${result.likeCount} lượt thích`;
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    },

    toggleComments(postId, cardElement) {
        let commentSection = cardElement.querySelector('.comment-section');
        if (!commentSection) {
            commentSection = this.createCommentSection(postId);
            // Append to the end of the card or body
            const body = cardElement.querySelector('.zynk-body') || cardElement.querySelector('.post-content-area') || cardElement;
            body.appendChild(commentSection);
            this.loadComments(postId, commentSection);
        } else {
            commentSection.classList.toggle('hidden');
        }
    },

    createCommentSection(postId) {
        const section = document.createElement('div');
        section.className = 'comment-section';
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        const userAvatar = userInfo.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.fullName || 'User')}`;
        
        section.innerHTML = `
            <div class="comment-input-area">
                <img src="${userAvatar}" class="mini-avatar" style="width: 32px; height: 32px; border-radius: 50%;">
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
                    list.appendChild(window.postActions.renderCommentItem(c, postId));
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
            <img src="${comment.authorAvatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(comment.authorName)}" class="mini-avatar">
            <div class="comment-content-box">
                <div class="comment-text" style="word-break: break-word;">
                    <a href="profile.html?id=${comment.authorId}" class="comment-author">${comment.authorName}</a>
                    ${window.common.autoLink(comment.content)}
                </div>
                <div class="comment-actions">
                    <span class="comment-time">${window.common.formatDate(comment.createdAt)}</span>
                    <button class="action-link" onclick="window.postActions.showReplyInput('${postId}', '${comment.id}', this)">Trả lời</button>
                    ${isMyComment ? `<button class="action-link delete" onclick="window.postActions.deleteComment('${postId}', '${comment.id}')">Xóa</button>` : ''}
                </div>
                <div class="replies-container" id="replies-${comment.id}" style="margin-top: 10px;">
                    ${(comment.replies || []).map(r => window.postActions.renderCommentItem(r, postId).outerHTML).join('')}
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
            list.prepend(window.postActions.renderCommentItem(comment, postId));
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
            repliesList.innerHTML += window.postActions.renderCommentItem(reply, postId).outerHTML;
            btn.closest(`.reply-area-${parentId}`).classList.add('hidden');
        } catch (error) {
            alert('Lỗi khi gửi phản hồi');
        } finally {
            btn.disabled = false;
        }
    },

    async deleteComment(postId, commentId) {
        const confirmed = await window.common.zynkModal.confirm('Bạn có chắc chắn muốn xóa bình luận này không?');
        if (!confirmed) return;
        
        console.log(`Deleting comment ${commentId} from post ${postId}`);
        try {
            await window.api.delete(`posts/${postId}/comments/${commentId}`);
            console.log('Comment deleted successfully');
            const el = document.getElementById(`comment-${commentId}`);
            if (el) el.remove();
        } catch (error) {
            window.common.zynkModal.alert('Lỗi: ' + error.message);
        }
    },

    async deletePost(postId) {
        const confirmed = await window.common.zynkModal.confirm('Bạn có chắc chắn muốn xóa BÀI VIẾT này vĩnh viễn không? Thao tác này không thể hoàn tác!');
        if (!confirmed) return;
        
        try {
            const card = document.getElementById(`post-${postId}`) || 
                         document.querySelector(`.zynk-post-card[data-id="${postId}"]`) || 
                         document.querySelector(`.post-card[data-id="${postId}"]`);
                         
            const btnDelete = card ? card.querySelector('.delete') : null;
            if (btnDelete) btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Xóa...';
            
            await window.api.delete(`posts/${postId}`);
            
            window.common.showToast('Xóa bài viết thành công!', 'success');
            
            if (card) {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => card.remove(), 400);
            } else {
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (error) {
            window.common.showToast('Lỗi khi xóa bài viết: ' + error.message, 'error');
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
                    window.common.zynkModal.alert('Vui lòng chọn một lý do.');
                    return;
                }
                
                const selectedReason = selectedReasonEl.value;
                let finalReason = selectedReason;
                
                if (selectedReason === 'Khác') {
                    const detail = otherText ? otherText.value.trim() : '';
                    if (!detail) {
                        window.common.zynkModal.alert('Vui lòng nhập lý do cụ thể.');
                        return;
                    }
                    finalReason = `Khác: ${detail}`;
                }

                try {
                    const result = await window.api.post('reports', { postId, reason: finalReason });
                    window.postActions.closeReportModal();
                    
                    // Block Suggestion
                    if (authorId && authorId !== 'undefined' && authorId !== 'null') {
                        setTimeout(async () => {
                            const blockConfirmed = await window.common.zynkModal.confirm(`${result.message}\n\nBạn có muốn chặn người dùng này để không bao giờ thấy bài viết của họ nữa không?`, 'Báo cáo thành công');
                            if (blockConfirmed) {
                                window.postActions.blockUser(authorId);
                            }
                        }, 500);
                    } else {
                        window.common.zynkModal.alert(result.message, 'Thành công');
                    }
                } catch (error) {
                    window.common.zynkModal.alert('Lỗi gửi báo cáo: ' + error.message);
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
            window.common.zynkModal.alert(result.message, 'Thành công');
        } catch (error) {
            window.common.zynkModal.alert('Lỗi: ' + error.message);
        }
    },

    async blockUser(authorId) {
        if (!authorId || authorId === 'undefined') return;
        try {
            const result = await window.api.post(`users/${authorId}/block`);
            window.common.zynkModal.alert(result.message, 'Đã chặn');
            window.location.reload();
        } catch (error) {
            window.common.zynkModal.alert('Lỗi khi chặn người dùng: ' + error.message);
        }
    },

    injectReportModal() {
        if (document.getElementById('report-modal')) return;

        const modalHtml = `
            <div id="report-modal" class="modal-overlay hidden">
                <div class="modal-content report-modal-content">
                    <div class="modal-header" style="margin-bottom: 20px;">
                        <h3 style="font-size: 1.25rem; font-weight: 700;">Báo cáo vi phạm</h3>
                        <button class="close-btn" onclick="closeReportModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">
                            Chúng tôi sẽ xem xét bài viết này dựa trên lý do bạn cung cấp. Hành động của bạn giúp cộng đồng Zynk an toàn hơn.
                        </p>
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

                            <textarea id="report-other-text" class="hidden" placeholder="Vui lòng cung cấp thêm thông tin chi tiết..." rows="3" style="width: 100%; margin-top: 10px; padding: 12px; border-radius: 12px; border: 1px solid var(--input-border); background: var(--input-bg); font-family: inherit; font-size: 0.9rem;"></textarea>
                            
                            <div style="margin-top: 2rem; display: flex; gap: 12px;">
                                <button type="button" class="btn secondary-btn" style="flex: 1; height: 48px; border-radius: 12px;" onclick="closeReportModal()">Hủy</button>
                                <button type="submit" class="btn primary-btn" style="flex: 2; height: 48px; border-radius: 12px; background: var(--primary-gradient);" id="submit-report-btn">Gửi báo cáo</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },
    async loadCommentsForModal(postId, container) {
        if (!postId || !container) return;
        
        // Watchdog timer: if nothing happens in 6s, clear the spinner
        const watchdog = setTimeout(() => {
            if (container.innerHTML.includes('fa-spinner') || container.innerHTML.includes('Đang tải')) {
                container.innerHTML = `
                    <div style="text-align:center; padding:20px;">
                        <p style="color:#8e8e8e; font-size:0.9rem;">Máy chủ phản hồi chậm...</p>
                        <button onclick="window.postActions.loadCommentsForModal('${postId}', document.getElementById('modal-comments-list'))" style="margin-top:10px; border:none; background:none; color:#0095f6; font-weight:600; cursor:pointer;">Thử lại</button>
                    </div>
                `;
            }
        }, 6000);

        // Cache usage
        const cached = window._postCache && window._postCache[postId];
        if (cached && cached.comments && Array.isArray(cached.comments) && cached.comments.length > 0) {
            container.innerHTML = '';
            cached.comments.forEach(c => {
                try { container.appendChild(window.postActions.renderCommentItem(c, postId)); } catch(e) {}
            });
        }

        try {
            const comments = await window.api.get(`posts/${postId}/comments`);
            clearTimeout(watchdog);
            
            container.innerHTML = '';
            if (comments && comments.length > 0) {
                comments.forEach(c => {
                    try { container.appendChild(window.postActions.renderCommentItem(c, postId)); } catch (e) {}
                });
            } else {
                container.innerHTML = '<p style="color:#8e8e8e; text-align:center; padding:20px;">Chưa có bình luận nào.</p>';
            }
        } catch (error) {
            clearTimeout(watchdog);
            console.warn("Modal comments fetch issues:", error.message);
            if (!container.children.length || container.innerHTML.includes('Đang tải')) {
                container.innerHTML = '<p style="color:#8e8e8e; text-align:center; padding:20px;">Không thể tải bình luận lúc này.</p>';
            }
        }
    },

    async toggleSave(postId, btnElement) {
        if (!localStorage.getItem('auth_token')) {
            window.location.href = 'auth.html';
            return;
        }

        try {
            const result = await window.api.post(`SavedPosts/${postId}`);
            
            // 1. Update Modal icon if it exists
            const modalSaveIcon = document.getElementById('modal-save-icon');
            if (modalSaveIcon) {
                if (result.saved) {
                    modalSaveIcon.classList.replace('fa-regular', 'fa-solid');
                    modalSaveIcon.style.color = '#2563EB';
                } else {
                    modalSaveIcon.classList.replace('fa-solid', 'fa-regular');
                    modalSaveIcon.style.color = '';
                }
            }

            // 2. Update all card icons for this post on the page
            const btns = document.querySelectorAll(`.save-btn[data-post-id="${postId}"]`);
            btns.forEach(btn => {
                const icon = btn.querySelector('i');
                if (icon) {
                    if (result.saved) {
                        icon.classList.replace('fa-regular', 'fa-solid');
                        btn.classList.add('saved');
                    } else {
                        icon.classList.replace('fa-solid', 'fa-regular');
                        btn.classList.remove('saved');
                    }
                }
            });
            
            // Specific button passed to function
            if (btnElement) {
                const icon = btnElement.querySelector('i');
                if (icon) {
                    if (result.saved) {
                        icon.classList.replace('fa-regular', 'fa-solid');
                        btnElement.classList.add('saved');
                    } else {
                        icon.classList.replace('fa-solid', 'fa-regular');
                        btnElement.classList.remove('saved');
                    }
                }
            }

            // If we are on the "Saved" page, we might want to remove the card if unsaved
            if (!result.saved && window.location.pathname.includes('saved.html')) {
                const card = document.getElementById(`post-${postId}`) || btnElement?.closest('.zynk-post-card');
                if (card) card.remove();
            }

        } catch (error) {
            console.error('Save error:', error);
        }
    },

    async votePoll(pollId, optionId, el) {
        if (!localStorage.getItem('auth_token')) {
            window.location.href = 'auth.html';
            return;
        }

        const container = el.closest('.zynk-poll-container');
        if (container.classList.contains('voting')) return;
        
        // Basic optimistic UI
        const isVoted = el.classList.contains('selected');
        
        container.classList.add('voting');

        try {
            const result = await window.api.post(`Polls/${pollId}/vote/${optionId}`);
            
            // Re-render logic or simple update
            // For now, let's update the bars and text
            const options = container.querySelectorAll('.poll-option');
            options.forEach(opt => {
                const optId = opt.dataset.optionId;
                const optData = result.options.find(o => o.id === optId);
                
                opt.classList.add('voted');
                opt.classList.toggle('selected', result.selectedOptionId === optId);
                
                const bar = opt.querySelector('.poll-bar');
                const percent = opt.querySelector('.poll-percent');
                
                if (bar) bar.style.width = `${optData.percentage}%`;
                if (percent) percent.textContent = `${Math.round(optData.percentage)}%`;
            });
            
            const meta = container.querySelector('.poll-meta span');
            if (meta) meta.textContent = `${result.totalVotes} bình chọn`;

        } catch (error) {
            alert(error.message || 'Lỗi khi bình chọn');
        } finally {
            container.classList.remove('voting');
        }
    }
};

// Global helpers for modal
window.closeReportModal = () => postActions.closeReportModal();
