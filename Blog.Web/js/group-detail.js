// js/group-detail.js

const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('id');
let currentGroup = null;
let isMember = false;

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    
    if (!groupId) {
        alert("Không tìm thấy ID nhóm");
        window.location.href = "groups.html";
        return;
    }

    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const avatarImg = document.getElementById('quick-post-avatar');
    if(avatarImg && userInfo.avatarUrl) {
        avatarImg.src = userInfo.avatarUrl;
    }

    await loadGroupDetails();

    // Setup report other text toggle
    const reportOtherRadio = document.getElementById('reason-group-other-radio');
    const reportOtherText = document.getElementById('report-group-other-text');
    if (reportOtherRadio && reportOtherText) {
        document.querySelectorAll('input[name="report-group-reason"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (reportOtherRadio.checked) {
                    reportOtherText.classList.remove('hidden');
                    reportOtherText.required = true;
                } else {
                    reportOtherText.classList.add('hidden');
                    reportOtherText.required = false;
                }
            });
        });
    }

    document.getElementById('report-group-form').addEventListener('submit', handleReportGroup);
});

async function loadGroupDetails() {
    try {
        currentGroup = await window.api.get(`groups/${groupId}`);
        
        // Cập nhật Banner
        document.getElementById('gd-cover').src = currentGroup.coverImageUrl || 'https://via.placeholder.com/1200x400?text=Group+Cover';
        document.getElementById('gd-name').textContent = currentGroup.name;
        document.getElementById('gd-desc').textContent = currentGroup.description || 'Chưa có mô tả.';
        document.getElementById('gd-members').textContent = `${currentGroup.memberCount || 0} thành viên`;
        
        // isMember comes directly from DTO
        isMember = currentGroup.isMember === true;
        
        const privacyEl = document.getElementById('gd-privacy');
        if (currentGroup.isPrivate) {
            privacyEl.innerHTML = '<i class="fa-solid fa-lock"></i> Riêng tư';
        } else {
            privacyEl.innerHTML = '<i class="fa-solid fa-globe"></i> Công khai';
        }

        // Action buttons
        const btnJoin = document.getElementById('gd-btn-join');
        const btnLeave = document.getElementById('gd-btn-leave');
        if (isMember) {
            btnJoin.classList.add('hidden');
            btnLeave.classList.remove('hidden');
        } else {
            btnJoin.classList.remove('hidden');
            btnLeave.classList.add('hidden');
        }

        // Logic for viewing posts
        const postsGrid = document.getElementById('posts-grid');
        const noPosts = document.getElementById('no-posts');
        const lockMsg = document.getElementById('private-lock-msg');
        const quickPost = document.getElementById('group-quick-post');

        if (currentGroup.isPrivate && !isMember) {
            lockMsg.classList.remove('hidden');
            postsGrid.classList.add('hidden');
            noPosts.classList.add('hidden');
            quickPost.style.display = 'none';
        } else {
            lockMsg.classList.add('hidden');
            postsGrid.classList.remove('hidden');
            if (isMember) quickPost.style.display = 'flex';
            
            await loadGroupPosts();
        }

    } catch (err) {
        console.error(err);
        alert("Không thể tải thông tin nhóm. Có thể nhóm đã bị xóa hoặc không tồn tại.");
        window.location.href = "groups.html";
    }
}

async function loadGroupPosts() {
    const grid = document.getElementById('posts-grid');
    const noPosts = document.getElementById('no-posts');
    
    grid.innerHTML = '<div class="post-card skeleton"></div>';
    
    try {
        const posts = await window.api.get(`groups/${groupId}/posts`);
        
        if (!posts || posts.length === 0) {
            grid.innerHTML = '';
            noPosts.classList.remove('hidden');
            return;
        }
        
        noPosts.classList.add('hidden');
        
        let html = '';
        posts.forEach(p => {
            // Add to cache for modal
            if(!window._postCache) window._postCache = {};
            window._postCache[p.id] = p;
            
            if (window.postActions && window.postActions.renderPostCard) {
                html += window.postActions.renderPostCard(p); 
            }
        });
        grid.innerHTML = html || '<p style="text-align:center;color:#8e8e8e;">Chưa có bài viết nào.</p>';
        
        // Tích hợp logic xem thêm (nếu bài dài)
        if (window.postActions && window.postActions.setupReadMore) {
            window.postActions.setupReadMore();
        }
        
    } catch (err) {
        if (err.status === 404 || err.message?.includes('404')) {
            grid.innerHTML = '';
            noPosts.classList.remove('hidden');
        } else {
            grid.innerHTML = '<p style="text-align:center; color:red;">Lỗi tải bài viết.</p>';
        }
    }
}

async function toggleJoinGroup() {
    try {
        if (isMember) {
            if(!confirm("Bạn có chắc muốn rời nhóm này?")) return;
            await window.api.post(`groups/${groupId}/leave`);
            isMember = false;
        } else {
            await window.api.post(`groups/${groupId}/join`);
            isMember = true;
        }
        await loadGroupDetails();
    } catch(err) {
        alert(err.message || "Đã xảy ra lỗi");
    }
}

function openReportGroupModal() {
    document.getElementById('report-group-modal').classList.remove('hidden');
}

function closeReportGroupModal() {
    document.getElementById('report-group-modal').classList.add('hidden');
}

async function handleReportGroup(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Đang gửi...';
    btn.disabled = true;

    const radios = document.getElementsByName('report-group-reason');
    let reason = '';
    for (const r of radios) {
        if (r.checked) {
            reason = r.value;
            break;
        }
    }
    if (reason === 'Khác') {
        reason = document.getElementById('report-group-other-text').value.trim();
    }

    try {
        await window.api.post(`groups/${groupId}/report`, { reason });
        alert("Đã gửi báo cáo cho Quản trị viên xử lý.");
        closeReportGroupModal();
    } catch (err) {
        alert(err.message || 'Lỗi khi báo cáo');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function goToCreateGroupPost() {
    window.location.href = `create-post.html?groupId=${groupId}`;
}
