// js/chat.js  – Zynk Realtime 1-1 Chat
'use strict';

// ── State ────────────────────────────────────────────────
let connection = null;
let currentConversationId = null;
let currentOtherUser = null;
let myUserId = null;
let myUserInfo = null;
let allConversations = { accepted: [], pending: [] };
let activeTab = 'inbox'; // 'inbox' | 'pending'
let searchTimer = null;
let typingTimer = null;
let isTyping = false;

const API = window.API_BASE_URL || '';

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    myUserInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    myUserId = myUserInfo.id || myUserInfo.Id;

    // Set my username in header
    const usernameEl = document.getElementById('inbox-my-username');
    if (usernameEl) usernameEl.textContent = myUserInfo.username || myUserInfo.Username || 'Tin nhắn';

    // Check if opening a specific conversation from URL
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get('with');

    await loadConversations();
    await connectSignalR();

    if (targetUserId) {
        await openOrCreateConversation(targetUserId);
    }
});

// ── SignalR Connection ────────────────────────────────────
async function connectSignalR() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API.replace('/api', '')}/hubs/chat`, {
            accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

    console.log('[Chat] Connecting to SignalR...');

    // ReceiveMessage: tin nhắn thông thường (mutual follow)
    connection.on('ReceiveMessage', (msg) => {
        handleIncomingMessage(msg, false);
        if (window.loadChatUnreadBadge) window.loadChatUnreadBadge();
    });

    // MessageRequest: tin nhắn từ người lạ → pending
    connection.on('MessageRequest', (msg) => {
        handleIncomingMessage(msg, true);
        if (window.loadChatUnreadBadge) window.loadChatUnreadBadge();
        showToast('Bạn có 1 tin nhắn đang chờ', 'info');
    });

    connection.onreconnecting(() => {
        showToast('Đang kết nối lại...', 'info');
    });

    connection.onreconnected(() => {
        showToast('Đã kết nối lại', 'success');
    });

    try {
        await connection.start();
        console.log('[Chat] SignalR connected');
    } catch (err) {
        console.error('[Chat] SignalR connection failed:', err);
    }
}

// ── Load Conversations ────────────────────────────────────
async function loadConversations() {
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`${API}/messages/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        allConversations = data;
        renderConvList();
    } catch (err) {
        console.error('[Chat] Load conversations error:', err);
        document.getElementById('conv-list').innerHTML =
            `<div class="inbox-empty"><i class="fa-solid fa-wifi-slash"></i><p>Không thể tải hội thoại</p></div>`;
    }
}

// ── Render Conversation List ──────────────────────────────
function renderConvList() {
    const list = allConversations[activeTab === 'inbox' ? 'accepted' : 'pending'] || [];
    const container = document.getElementById('conv-list');

    // Update badges
    const inboxBadge = document.getElementById('inbox-badge');
    const pendingBadge = document.getElementById('pending-badge');
    const inboxUnread = (allConversations.accepted || []).reduce((s, c) => s + (c.unreadCount || 0), 0);
    const pendingUnread = (allConversations.pending || []).length;

    if (inboxBadge) {
        inboxBadge.textContent = inboxUnread;
        inboxBadge.classList.toggle('hidden', inboxUnread === 0);
    }
    if (pendingBadge) {
        pendingBadge.textContent = pendingUnread;
        pendingBadge.classList.toggle('hidden', pendingUnread === 0);
    }

    if (list.length === 0) {
        const emptyMsg = activeTab === 'inbox'
            ? '<i class="fa-regular fa-comment-dots"></i><p>Chưa có tin nhắn nào.<br>Hãy bắt đầu trò chuyện!</p>'
            : '<i class="fa-regular fa-clock"></i><p>Không có tin nhắn chờ nào.</p>';
        container.innerHTML = `<div class="inbox-empty">${emptyMsg}</div>`;
        return;
    }

    container.innerHTML = list.map(c => renderConvItem(c)).join('');

    // Attach click handlers
    container.querySelectorAll('.conv-item').forEach(el => {
        el.addEventListener('click', () => {
            const convId = el.dataset.convId;
            const conv = findConvById(convId);
            if (conv) openConversation(conv);
        });
    });
}

function renderConvItem(c) {
    const other = c.otherUser;
    const avatar = other.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(other.fullName)}&background=6366f1&color=fff`;
    const lastMsg = c.lastMessage;
    const isUnread = c.unreadCount > 0;
    const isMe = lastMsg && lastMsg.senderId === myUserId;
    const preview = lastMsg
        ? (lastMsg.imageUrl ? (isMe ? 'Bạn đã gửi 1 ảnh' : 'Đã gửi 1 ảnh') : (isMe ? `Bạn: ${lastMsg.content}` : lastMsg.content))
        : 'Bắt đầu trò chuyện';
    const timeAgo = lastMsg ? formatRelativeTime(lastMsg.createdAt) : '';
    const isActive = c.conversationId === currentConversationId;

    return `
    <div class="conv-item ${isActive ? 'active' : ''}" data-conv-id="${c.conversationId}">
        <div class="conv-avatar-wrap">
            <img class="conv-avatar" src="${avatar}" alt="${other.fullName}"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(other.fullName)}&background=6366f1&color=fff'">
        </div>
        <div class="conv-info">
            <div class="conv-name">${escHtml(other.fullName)}</div>
            <div class="conv-last-msg ${isUnread ? 'unread' : ''}">${escHtml(preview.substring(0, 50))}</div>
        </div>
        <div class="conv-meta">
            <span class="conv-time">${timeAgo}</span>
            ${isUnread ? `<span class="conv-unread-badge">${c.unreadCount}</span>` : ''}
        </div>
    </div>`;
}

function closeChatPanelMobile() {
    const panel = document.getElementById('chat-panel');
    if (panel) {
        panel.classList.remove('mobile-open');
        // Clear active state in list to allow re-selection
        document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
        currentConversationId = null;
    }
}
window.closeChatPanelMobile = closeChatPanelMobile;

function findConvById(convId) {
    return [...allConversations.accepted, ...allConversations.pending]
        .find(c => c.conversationId === convId);
}

// ── Switch Tabs ───────────────────────────────────────────
function switchInboxTab(tab) {
    activeTab = tab;
    document.getElementById('tab-inbox').classList.toggle('active', tab === 'inbox');
    document.getElementById('tab-pending').classList.toggle('active', tab === 'pending');
    renderConvList();
}
window.switchInboxTab = switchInboxTab;

// ── Open Conversation ─────────────────────────────────────
async function openConversation(conv) {
    currentConversationId = conv.conversationId;
    currentOtherUser = conv.otherUser;

    // Mark active in list
    document.querySelectorAll('.conv-item').forEach(el => {
        el.classList.toggle('active', el.dataset.convId === conv.conversationId);
    });

    // Build chat panel
    buildChatPanel(conv);

    // Load messages
    await loadMessages(conv.conversationId);

    // Mobile: slide chat panel in
    document.getElementById('chat-panel')?.classList.add('mobile-open');

    // Update conv unread count in state
    const found = findConvById(conv.conversationId);
    if (found) found.unreadCount = 0;
    renderConvList();
}

async function openOrCreateConversation(targetUserId) {
    if (!targetUserId) return;
    const uid = targetUserId.toString();
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`${API}/messages/conversations/${uid}/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        // Add to accepted list if not present
        const existing = findConvById(data.conversationId);
        if (!existing) {
            allConversations.accepted.unshift({
                conversationId: data.conversationId,
                otherUser: data.otherUser,
                lastMessage: null,
                unreadCount: 0,
                isMutual: true
            });
            renderConvList();
        }
        openConversation({ conversationId: data.conversationId, otherUser: data.otherUser, isMutual: true });
    } catch (err) {
        showToast('Không thể mở cuộc trò chuyện', 'error');
    }
}

// ── Build Chat Panel HTML ─────────────────────────────────
function buildChatPanel(conv) {
    const other = conv.otherUser;
    const avatar = other.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(other.fullName)}&background=6366f1&color=fff`;
    const isPending = !conv.isMutual;

    const panel = document.getElementById('chat-panel');
    panel.classList.remove('empty-state');

    const requestBanner = isPending ? `
    <div class="message-request-banner" id="request-banner">
        <i class="fa-solid fa-envelope-open-text"></i>
        <span><strong>${escHtml(other.fullName)}</strong> muốn nhắn tin với bạn.</span>
        <div class="request-actions">
            <button class="btn-accept" onclick="acceptMessageRequest()">Chấp nhận</button>
            <button class="btn-decline" onclick="declineMessageRequest()">Từ chối</button>
        </div>
    </div>` : '';

    panel.innerHTML = `
    <div class="chat-header">
        <button class="chat-icon-btn back-btn" onclick="closeChatPanelMobile()">
            <i class="fa-solid fa-arrow-left"></i>
        </button>
        <img class="chat-header-avatar" src="${avatar}" alt="${other.fullName}"
             onclick="window.location.href='profile.html?id=${other.id}'"
             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(other.fullName)}&background=6366f1&color=fff'">
        <div class="chat-header-info">
            <a href="profile.html?id=${other.id}" class="chat-header-name">${escHtml(other.fullName)}</a>
            <div class="chat-header-status">@${escHtml(other.username || '')}</div>
        </div>
        <div class="chat-header-actions">
            <button class="chat-icon-btn" title="Trang cá nhân" onclick="window.location.href='profile.html?id=${other.id}'">
                <i class="fa-solid fa-circle-info"></i>
            </button>
        </div>
    </div>
    ${requestBanner}
    <div class="messages-area" id="messages-area">
        <div class="inbox-empty">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem;opacity:0.4;"></i>
        </div>
    </div>
    <div class="chat-input-area">
        <div class="chat-input-wrap">
            <button class="chat-icon-btn" onclick="document.getElementById('chat-img-input').click()" title="Gửi ảnh">
                <i class="fa-regular fa-image"></i>
            </button>
            <input type="file" id="chat-img-input" hidden accept="image/*" onchange="uploadMessageImage(this)">
            <textarea
                id="chat-text-input"
                placeholder="Nhắn tin..."
                rows="1"
                oninput="autoResizeTextarea(this); handleTyping()"
                onkeydown="handleChatKeydown(event)"
            ></textarea>
            <button class="chat-send-btn" id="chat-send-btn" onclick="sendMessage()" disabled title="Gửi">
                <i class="fa-solid fa-paper-plane"></i>
            </button>
        </div>
    </div>
    `;

    // Enable/disable send button based on input
    const input = document.getElementById('chat-text-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (input && sendBtn) {
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim();
        });
    }
}

// ── Load Messages ─────────────────────────────────────────
async function loadMessages(conversationId, page = 1) {
    const token = localStorage.getItem('auth_token');
    const area = document.getElementById('messages-area');
    if (!area) return;

    try {
        const res = await fetch(`${API}/messages/conversations/${conversationId}/messages?page=${page}&pageSize=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed');
        const messages = await res.json();

        area.innerHTML = '';
        if (messages.length === 0) {
            area.innerHTML = `<div class="inbox-empty"><i class="fa-regular fa-comment-dots"></i><p>Hãy bắt đầu cuộc trò chuyện!</p></div>`;
            return;
        }

        let lastDate = null;
        let lastSenderId = null;
        messages.forEach((msg, idx) => {
            const msgDate = new Date(msg.createdAt).toDateString();
            if (msgDate !== lastDate) {
                area.appendChild(createDateSeparator(msg.createdAt));
                lastDate = msgDate;
                lastSenderId = null;
            }
            const isConsecutive = lastSenderId === msg.senderId;
            area.appendChild(createMessageEl(msg, isConsecutive));
            lastSenderId = msg.senderId;
        });

        area.scrollTop = area.scrollHeight;
    } catch (err) {
        console.error('[Chat] Load messages error:', err);
        if (area) area.innerHTML = `<div class="inbox-empty"><i class="fa-solid fa-wifi-slash"></i><p>Không thể tải tin nhắn</p></div>`;
    }
}

// ── Create Message Element ────────────────────────────────
function createMessageEl(msg, isConsecutive = false) {
    const isSent = msg.senderId === myUserId;
    const otherAvatar = currentOtherUser?.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentOtherUser?.fullName || 'U')}&background=6366f1&color=fff`;

    const row = document.createElement('div');
    row.className = `msg-row ${isSent ? 'sent' : 'received'} ${isConsecutive ? 'consecutive' : ''}`;
    row.dataset.msgId = msg.id;

    const time = formatMsgTime(msg.createdAt);

    const msgContent = msg.imageUrl 
        ? `<img src="${msg.imageUrl}" class="msg-img" onclick="window.open('${msg.imageUrl}', '_blank')">`
        : escHtml(msg.content);

    if (isSent) {
        row.innerHTML = `
        <div class="msg-bubble-wrap">
            <div class="msg-bubble ${msg.imageUrl ? 'is-img' : ''}" title="${time}">${msgContent}</div>
            <span class="msg-time">${isConsecutive ? '' : time}</span>
        </div>`;
    } else {
        row.innerHTML = `
        <img class="msg-avatar-sm" src="${otherAvatar}" alt="Avatar"
             onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'">
        <div class="msg-bubble-wrap">
            <div class="msg-bubble ${msg.imageUrl ? 'is-img' : ''}" title="${time}">${msgContent}</div>
            <span class="msg-time">${isConsecutive ? '' : time}</span>
        </div>`;
    }
    return row;
}

function createDateSeparator(dateStr) {
    const div = document.createElement('div');
    div.className = 'msg-date-sep';
    div.textContent = formatDateLabel(dateStr);
    return div;
}

// ── Send Message ──────────────────────────────────────────
async function sendMessage(imageUrl = null) {
    const input = document.getElementById('chat-text-input');
    const content = input?.value?.trim() || "";
    if (!imageUrl && !content && !currentOtherUser) return;
    if (!connection) return;

    if (!imageUrl) {
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('chat-send-btn').disabled = true;
    }

    try {
        await connection.invoke('SendMessage', currentOtherUser.id, content, imageUrl);
    } catch (err) {
        console.error('[Chat] Send error:', err);
        showToast('Lỗi gửi tin nhắn', 'error');
    }
}
window.sendMessage = sendMessage;

async function uploadMessageImage(input) {
    const file = input.files[0];
    if (!file) return;
    
    showToast('Đang tải ảnh...', 'info');
    try {
        const data = await window.api.uploadImage(file);
        if (data && data.url) {
            await sendMessage(data.url);
        }
    } catch (err) {
        showToast('Lỗi tải ảnh', 'error');
    } finally {
        input.value = '';
    }
}
window.uploadMessageImage = uploadMessageImage;

// ── Handle Incoming Message (realtime) ───────────────────
function handleIncomingMessage(msg, isPending) {
    const isForCurrentConv =
        msg.conversationId === currentConversationId ||
        (msg.senderId === currentOtherUser?.id || msg.recipientId === currentOtherUser?.id);

    if (isForCurrentConv && document.getElementById('messages-area')) {
        const area = document.getElementById('messages-area');
        // Remove empty state if present
        const emptyEl = area.querySelector('.inbox-empty');
        if (emptyEl) emptyEl.remove();

        // Check consecutive
        const lastRow = area.querySelector('.msg-row:last-child');
        const lastSenderId = lastRow?.dataset?.senderId;
        const isConsecutive = lastSenderId === msg.senderId;

        const el = createMessageEl({
            id: msg.id,
            senderId: msg.senderId,
            content: msg.content,
            createdAt: msg.createdAt,
            isRead: msg.isRead
        }, isConsecutive);
        el.dataset.senderId = msg.senderId;
        area.appendChild(el);
        area.scrollTop = area.scrollHeight;

        // Mark read via hub
        if (msg.senderId !== myUserId && connection) {
            connection.invoke('MarkRead', msg.conversationId).catch(() => {});
        }
    }

    // Update conversation list
    updateConvInList(msg, isPending);
}

function updateConvInList(msg, isPending) {
    let conv = allConversations.accepted.find(c => c.conversationId === msg.conversationId);
    let listName = 'accepted';

    if (!conv) {
        conv = allConversations.pending.find(c => c.conversationId === msg.conversationId);
        listName = 'pending';
    }

    if (!conv) {
        loadConversations();
        return;
    }

    conv.lastMessage = {
        content: msg.content,
        senderId: msg.senderId,
        createdAt: msg.createdAt,
        isRead: false,
        imageUrl: msg.imageUrl
    };
    
    if (msg.senderId !== myUserId && msg.conversationId !== currentConversationId) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
    }

    // If accepted a previously pending user (e.g., they responded)
    if (listName === 'pending' && !isPending) {
        allConversations.pending = allConversations.pending.filter(c => c.conversationId !== msg.conversationId);
        conv.isMutual = true;
        allConversations.accepted.unshift(conv);
    } else {
        const currentList = allConversations[listName];
        const idx = currentList.indexOf(conv);
        currentList.splice(idx, 1);
        currentList.unshift(conv);
    }

    renderConvList();
}

// ── Accept / Decline Request ──────────────────────────────
async function acceptMessageRequest() {
    // Follow the sender → triggers mutual follow logic
    const token = localStorage.getItem('auth_token');
    if (!currentOtherUser) return;
    try {
        await fetch(`${API}/users/${currentOtherUser.id}/follow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Move conv from pending → accepted
        const idx = allConversations.pending.findIndex(c => c.conversationId === currentConversationId);
        if (idx !== -1) {
            const [conv] = allConversations.pending.splice(idx, 1);
            conv.isMutual = true;
            allConversations.accepted.unshift(conv);
        }
        document.getElementById('request-banner')?.remove();
        await loadConversations(); // Reload from API to get correct groups
        showToast('Đã chấp nhận tin nhắn', 'success');
    } catch { showToast('Lỗi xảy ra', 'error'); }
}
window.acceptMessageRequest = acceptMessageRequest;

async function declineMessageRequest() {
    if (!currentConversationId) return;
    // Remove from pending list locally
    allConversations.pending = allConversations.pending.filter(c => c.conversationId !== currentConversationId);
    currentConversationId = null;
    currentOtherUser = null;
    const panel = document.getElementById('chat-panel');
    panel.className = 'chat-panel empty-state';
    panel.innerHTML = `<div class="chat-empty-state">
        <div class="chat-empty-icon"><i class="fa-regular fa-paper-plane"></i></div>
        <h3>Tin nhắn của bạn</h3>
        <p>Chọn một cuộc trò chuyện để bắt đầu.</p>
    </div>`;
    renderConvList();
    showToast('Đã từ chối tin nhắn', 'info');
}
window.declineMessageRequest = declineMessageRequest;

// ── New Chat Modal ────────────────────────────────────────
function openNewChatModal() {
    document.getElementById('new-chat-overlay')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('new-chat-search')?.focus(), 100);
}
window.openNewChatModal = openNewChatModal;

function closeNewChatModal() {
    document.getElementById('new-chat-overlay')?.classList.add('hidden');
    const input = document.getElementById('new-chat-search');
    if (input) input.value = '';
    document.getElementById('new-chat-results').innerHTML =
        `<div class="inbox-empty"><i class="fa-solid fa-magnifying-glass"></i><p>Nhập tên để tìm người dùng</p></div>`;
}
window.closeNewChatModal = closeNewChatModal;

async function searchUsersForChat(query) {
    clearTimeout(searchTimer);
    const results = document.getElementById('new-chat-results');
    if (!query || query.trim().length < 1) {
        results.innerHTML = `<div class="inbox-empty"><i class="fa-solid fa-magnifying-glass"></i><p>Nhập tên để tìm người dùng</p></div>`;
        return;
    }
    results.innerHTML = `<div class="inbox-empty"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    searchTimer = setTimeout(async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API}/search?q=${encodeURIComponent(query.trim())}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const users = (data.users || []).filter(u => u.id !== myUserId);
            if (users.length === 0) {
                results.innerHTML = `<div class="inbox-empty"><i class="fa-regular fa-face-frown"></i><p>Không tìm thấy người dùng</p></div>`;
                return;
            }
            results.innerHTML = users.map(u => {
                const av = u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName)}&background=6366f1&color=fff`;
                return `<div class="new-chat-user-item" onclick="startChatWithUser('${u.id}')">
                    <img src="${av}" alt="${escHtml(u.fullName)}"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName)}&background=6366f1&color=fff'">
                    <div class="new-chat-user-info">
                        <div class="new-chat-name">${escHtml(u.fullName)}</div>
                        <div class="new-chat-username">@${escHtml(u.username)}</div>
                    </div>
                </div>`;
            }).join('');
        } catch {
            results.innerHTML = `<div class="inbox-empty"><i class="fa-solid fa-wifi-slash"></i><p>Lỗi tìm kiếm</p></div>`;
        }
    }, 350);
}
window.searchUsersForChat = searchUsersForChat;

async function startChatWithUser(userId) {
    closeNewChatModal();
    await openOrCreateConversation(userId);
}
window.startChatWithUser = startChatWithUser;

// ── Input Helpers ─────────────────────────────────────────
function handleChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}
window.handleChatKeydown = handleChatKeydown;

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
window.autoResizeTextarea = autoResizeTextarea;

function handleTyping() {
    // Could invoke hub typing indicator if desired
}
window.handleTyping = handleTyping;

function closeChatPanelMobile() {
    document.getElementById('chat-panel')?.classList.remove('mobile-open');
}
window.closeChatPanelMobile = closeChatPanelMobile;

// ── Close modal on overlay click ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('new-chat-overlay')?.addEventListener('click', function(e) {
        if (e.target === this) closeNewChatModal();
    });
});

// ── Utility ───────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày`;
    return date.toLocaleDateString('vi-VN');
}

function formatMsgTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 86400000);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Hôm qua';
    return date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });
}
