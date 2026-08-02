(() => {
    const API = window.api;
    const mode = document.body.dataset.chatMode || 'buyer';
    const isSeller = mode === 'seller';
    const queryParams = new URLSearchParams(location.search);
    const state = { conversations: [], activeId: null, active: null, targetShopId: queryParams.get('shopId'), targetConversationId: queryParams.get('conversationId'), busy: false, timer: null, hub: null };
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    const money = value => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
    const avatar = (url, name) => url || `https://ui-avatars.com/api/?background=6d5dfc&color=fff&name=${encodeURIComponent(name || 'Zynk')}`;
    const statusLabel = status => ({PendingPayment:'Chờ thanh toán',AwaitingBankVerification:'Chờ xác nhận chuyển khoản',Paid:'Đã thanh toán',Confirmed:'Đã xác nhận',Packing:'Đang đóng gói',Shipping:'Đang giao',Delivered:'Đã giao',Completed:'Hoàn thành',Cancelled:'Đã hủy',ReturnRequested:'Yêu cầu hoàn trả',Returned:'Đã hoàn tiền',ReturnRejected:'Từ chối hoàn trả'}[status] || status);

    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('beforeunload', () => clearInterval(state.timer));

    async function init() {
        bindStaticEvents();
        await loadConversations(true);
        if (state.targetConversationId && state.conversations.some(c => c.id.toLowerCase() === state.targetConversationId.toLowerCase())) {
            await openConversation(state.conversations.find(c => c.id.toLowerCase() === state.targetConversationId.toLowerCase()).id);
        } else if (state.targetShopId) {
            const existing = state.conversations.find(c => c.shopId.toLowerCase() === state.targetShopId.toLowerCase());
            if (existing) await openConversation(existing.id);
            else renderNewConversation();
        }
        if (isSeller) initSellerNotificationHub();
        state.timer = setInterval(refresh, 4000);
    }

    function bindStaticEvents() {
        $('commerce-chat-search')?.addEventListener('input', renderConversationList);
        document.querySelector('.commerce-chat-header')?.addEventListener('click', event => {
            if (innerWidth <= 640 && event.clientX < 55) $('commerce-chat-shell')?.classList.remove('chat-open');
        });
    }

    async function refresh() {
        if (document.hidden || state.busy) return;
        await loadConversations(false);
        if (state.activeId) await loadMessages(state.activeId, true);
    }

    async function loadConversations(showLoading) {
        const list = $('commerce-chat-list');
        if (showLoading) list.innerHTML = loadingState('Đang tải hội thoại');
        try {
            state.conversations = await API.get('shopchat/conversations');
            state.active = state.conversations.find(c => c.id === state.activeId) || state.active;
            renderConversationList();
        } catch (error) { list.innerHTML = emptyState('Không thể tải hội thoại', error.message); }
    }

    function renderConversationList() {
        const list = $('commerce-chat-list');
        const query = ($('commerce-chat-search')?.value || '').trim().toLowerCase();
        const items = state.conversations.filter(c => displayName(c).toLowerCase().includes(query));
        if (!items.length) { list.innerHTML = emptyState(query ? 'Không tìm thấy hội thoại' : 'Chưa có cuộc trò chuyện', isSeller ? 'Khách hàng nhắn Shop sẽ xuất hiện tại đây.' : 'Hãy mở một sản phẩm và nhắn tin cho Shop.'); return; }
        list.innerHTML = items.map(c => `
            <button type="button" class="commerce-chat-item ${c.id === state.activeId ? 'active' : ''}" data-id="${c.id}">
                <img class="commerce-chat-avatar" src="${esc(avatar(displayAvatar(c), displayName(c)))}" alt="">
                <span><span class="commerce-chat-item-name">${esc(displayName(c))}</span><span class="commerce-chat-item-preview">${esc(c.lastMessage || 'Bắt đầu cuộc trò chuyện')}</span></span>
                ${c.unreadCount ? `<span class="commerce-chat-unread">${Math.min(c.unreadCount,99)}</span>` : ''}
            </button>`).join('');
        list.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => openConversation(el.dataset.id)));
    }

    function displayName(c) { return isSeller ? c.buyerName : c.shopName; }
    function displayAvatar(c) { return isSeller ? c.buyerAvatar : c.shopLogo; }

    async function openConversation(id) {
        state.activeId = id;
        state.active = state.conversations.find(c => c.id === id);
        $('commerce-chat-shell').classList.add('chat-open');
        renderConversationList();
        renderChatFrame();
        await loadMessages(id, false);
    }

    function renderNewConversation() {
        state.activeId = null;
        state.active = { shopId: state.targetShopId, shopName: new URLSearchParams(location.search).get('shopName') || 'Cửa hàng Zynk', shopLogo: null };
        $('commerce-chat-shell').classList.add('chat-open');
        renderChatFrame(true);
        $('commerce-chat-messages').innerHTML = emptyState('Hãy bắt đầu cuộc trò chuyện', 'Bạn có thể hỏi về sản phẩm, vận chuyển hoặc chính sách của Shop.');
    }

    function renderChatFrame(isNew = false) {
        const main = $('commerce-chat-main');
        const name = isSeller ? state.active?.buyerName : state.active?.shopName;
        const photo = isSeller ? state.active?.buyerAvatar : state.active?.shopLogo;
        main.innerHTML = `
            <header class="commerce-chat-header">
                <div class="commerce-chat-person"><img src="${esc(avatar(photo,name))}" alt=""><div><strong>${esc(name || 'Hỗ trợ Shop')}</strong><span>${isSeller ? 'Khách hàng cần tư vấn' : 'Kênh hỗ trợ chính thức của Shop'}</span></div></div>
                <div class="commerce-chat-tools">
                    ${isSeller ? `<button class="commerce-tool-btn" data-action="products" ${isNew?'disabled':''}><i class="fa-solid fa-bag-shopping"></i><span>Gợi ý sản phẩm</span></button>` : ''}
                    <button class="commerce-tool-btn" data-action="orders" ${isNew?'disabled':''}><i class="fa-solid fa-box"></i><span>Đơn hàng</span></button>
                    ${!isSeller ? `<button class="commerce-tool-btn danger" data-action="complaint" ${isNew?'disabled':''}><i class="fa-solid fa-shield-halved"></i><span>Khiếu nại</span></button>` : ''}
                </div>
            </header>
            <div class="commerce-quick-actions">
                ${(isSeller ? ['Shop có thể tư vấn thêm cho bạn không?','Bạn muốn xem sản phẩm tương tự?','Shop đang kiểm tra đơn hàng cho bạn.'] : ['Tư vấn giúp tôi sản phẩm phù hợp','Kiểm tra giúp tôi tình trạng đơn hàng','Sản phẩm này còn hàng không?']).map(x => `<button class="commerce-quick-chip">${esc(x)}</button>`).join('')}
            </div>
            <div class="commerce-chat-messages" id="commerce-chat-messages">${loadingState('Đang tải tin nhắn')}</div>
            <footer class="commerce-chat-composer"><div class="commerce-chat-composer-row"><textarea id="commerce-chat-input" class="commerce-chat-input" rows="1" maxlength="2000" placeholder="${isSeller ? 'Tư vấn và hỗ trợ khách hàng…' : 'Hỏi Shop về sản phẩm hoặc đơn hàng…'}"></textarea><button class="commerce-send-btn" id="commerce-send-btn"><i class="fa-solid fa-paper-plane"></i></button></div><div class="commerce-composer-note">Enter để gửi · Shift + Enter để xuống dòng · Không chia sẻ mã OTP hoặc mật khẩu</div></footer>`;
        main.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => ({products:openProductPicker,orders:openOrderPicker,complaint:openComplaintDialog}[btn.dataset.action])()));
        main.querySelectorAll('.commerce-quick-chip').forEach(btn => btn.addEventListener('click', () => {
            const input = $('commerce-chat-input');
            input.value = btn.textContent;
            resizeComposer(input);
            input.focus();
        }));
        $('commerce-send-btn').addEventListener('click', sendText);
        const input = $('commerce-chat-input');
        input.addEventListener('input', () => resizeComposer(input));
        input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendText(); } });
    }

    function resizeComposer(input) {
        if (!input) return;
        input.style.height = '44px';
        input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
        input.style.overflowY = input.scrollHeight > 110 ? 'auto' : 'hidden';
    }

    async function loadMessages(id, silent) {
        try {
            const messages = await API.get(`shopchat/messages/${id}`);
            const box = $('commerce-chat-messages');
            if (!box) return;
            const signature = messages.map(m => m.id).join(',');
            if (silent && box.dataset.signature === signature) return;
            box.dataset.signature = signature;
            box.innerHTML = messages.length ? messages.map(renderMessage).join('') : emptyState('Chưa có tin nhắn', 'Hãy gửi lời chào để bắt đầu.');
            box.scrollTop = box.scrollHeight;
        } catch (error) { if (!silent) $('commerce-chat-messages').innerHTML = emptyState('Không thể tải tin nhắn', error.message); }
    }

    function renderMessage(m) {
        let card = '';
        if (m.kind === 'product' && m.product) card = `<div class="commerce-message-card"><div class="commerce-product-card"><img src="${esc(avatar(m.product.imageUrl,m.product.name))}" alt=""><div><span class="commerce-card-kicker">Seller gợi ý</span><h4>${esc(m.product.name)}</h4><div class="commerce-card-price">${money(m.product.price)}</div><div class="commerce-card-meta">★ ${Number(m.product.rating||0).toFixed(1)} · ${m.product.stock > 0 ? `Còn ${m.product.stock} sản phẩm` : 'Tạm hết hàng'}</div></div></div><a class="commerce-card-action" href="${isSeller?'../marketplace.html':'marketplace.html'}?product=${m.product.id}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem sản phẩm</a></div>`;
        if (m.kind === 'order' && m.order) card = `<div class="commerce-message-card"><div class="commerce-order-card"><div class="commerce-order-head"><span class="commerce-card-kicker">Đơn #${esc(m.order.code)}</span><span class="commerce-order-status">${esc(statusLabel(m.order.status))}</span></div><h4>${money(m.order.totalAmount)}</h4><div class="commerce-card-meta">Đặt lúc ${new Date(m.order.createdAt).toLocaleString('vi-VN')}</div></div><a class="commerce-card-action" href="${isSeller?'../seller-order-detail.html':'order-detail.html'}?id=${m.order.id}"><i class="fa-solid fa-receipt"></i> Xem chi tiết đơn</a></div>`;
        if (m.kind === 'complaint') card = `<div class="commerce-message-card commerce-complaint-card"><strong><i class="fa-solid fa-shield-halved"></i> Đã gửi khiếu nại đến Admin</strong><p>Mã yêu cầu: #${esc(String(m.complaintId||'').slice(0,8).toUpperCase())}. Admin sẽ xem xét nội dung và đơn hàng liên quan.</p></div>`;
        const text = m.content ? `<div class="commerce-message-bubble">${esc(m.content)}</div>` : '';
        return `<div class="commerce-message ${m.isMe?'me':'other'}"><div class="commerce-message-inner">${card}${text}<div class="commerce-message-time">${new Date(m.createdAt).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</div></div></div>`;
    }

    async function sendText(extra = {}) {
        if (state.busy) return;
        const input = $('commerce-chat-input');
        const content = (input?.value || '').trim();
        if (!content && !extra.productId && !extra.orderId) return;
        state.busy = true; if ($('commerce-send-btn')) $('commerce-send-btn').disabled = true;
        try {
            const payload = state.activeId ? { conversationId: state.activeId, content, ...extra } : { shopId: state.targetShopId, content, ...extra };
            const message = await API.post('shopchat/send', payload);
            if (!state.activeId) { state.activeId = message.conversationId; await loadConversations(false); state.active = state.conversations.find(c => c.id === state.activeId) || state.active; renderChatFrame(); }
            if (input) { input.value = ''; resizeComposer(input); }
            await loadMessages(state.activeId, false); await loadConversations(false); closeDialog();
        } catch (error) { showToast(error.message || 'Không thể gửi tin nhắn', 'error'); }
        finally { state.busy = false; if ($('commerce-send-btn')) $('commerce-send-btn').disabled = false; }
    }

    async function openProductPicker() {
        openDialog('Gợi ý sản phẩm của Shop', loadingState('Đang tải sản phẩm'));
        try {
            const products = await API.get('shopchat/products');
            setDialogBody(products.length ? `<div class="commerce-picker-list">${products.map(p => `<button class="commerce-picker-item" data-product="${p.id}"><img src="${esc(avatar(p.imageUrl,p.name))}" alt=""><span><strong>${esc(p.name)}</strong><span>${money(p.price)} · ${p.stock > 0 ? `Còn ${p.stock}` : 'Hết hàng'}</span></span><i class="fa-solid fa-paper-plane"></i></button>`).join('')}</div>` : emptyState('Chưa có sản phẩm đang bán','Hãy thêm hoặc kích hoạt sản phẩm trước.'));
            document.querySelectorAll('[data-product]').forEach(btn => btn.addEventListener('click', () => sendText({productId:btn.dataset.product})));
        } catch (e) { setDialogBody(emptyState('Không thể tải sản phẩm',e.message)); }
    }

    async function getOrders() { return state.activeId ? API.get(`shopchat/orders/${state.activeId}`) : []; }
    async function openOrderPicker() {
        openDialog('Chọn đơn hàng cần trao đổi', loadingState('Đang tải đơn hàng'));
        try {
            const orders = await getOrders();
            setDialogBody(orders.length ? `<div class="commerce-picker-list">${orders.map(o => `<button class="commerce-picker-item" data-order="${o.id}"><span style="display:grid;width:54px;height:54px;place-items:center;border-radius:14px;background:#f0edff;color:#6d5dfc;font-size:20px"><i class="fa-solid fa-box"></i></span><span><strong>Đơn #${esc(o.code)}</strong><span>${money(o.totalAmount)} · ${esc(statusLabel(o.status))}</span></span><i class="fa-solid fa-paper-plane"></i></button>`).join('')}</div>` : emptyState('Chưa có đơn hàng với Shop','Đơn hàng của cuộc trò chuyện này sẽ xuất hiện tại đây.'));
            document.querySelectorAll('[data-order]').forEach(btn => btn.addEventListener('click', () => sendText({orderId:btn.dataset.order})));
        } catch (e) { setDialogBody(emptyState('Không thể tải đơn hàng',e.message)); }
    }

    async function openComplaintDialog() {
        openDialog('Khiếu nại Seller về đơn hàng', loadingState('Đang tải đơn hàng'));
        try {
            const orders = await getOrders();
            if (!orders.length) { setDialogBody(emptyState('Không có đơn hàng để khiếu nại','Chỉ có thể khiếu nại Seller về đơn hàng thực tế của bạn.')); return; }
            setDialogBody(`<form id="commerce-complaint-form"><div class="commerce-form-group"><label>Đơn hàng liên quan</label><select id="complaint-order" required>${orders.map(o=>`<option value="${o.id}">#${esc(o.code)} · ${money(o.totalAmount)} · ${esc(statusLabel(o.status))}</option>`).join('')}</select></div><div class="commerce-form-group"><label>Nội dung khiếu nại</label><textarea id="complaint-reason" minlength="10" maxlength="1000" required placeholder="Mô tả rõ vấn đề, thời điểm và mong muốn xử lý…"></textarea></div><button class="commerce-dialog-submit" type="submit"><i class="fa-solid fa-shield-halved"></i> Gửi khiếu nại đến Admin</button></form>`);
            $('commerce-complaint-form').addEventListener('submit', submitComplaint);
        } catch (e) { setDialogBody(emptyState('Không thể tải dữ liệu',e.message)); }
    }

    async function submitComplaint(event) {
        event.preventDefault();
        try {
            await API.post('shopchat/complaints',{conversationId:state.activeId,orderId:$('complaint-order').value,reason:$('complaint-reason').value.trim()});
            closeDialog(); showToast('Đã gửi khiếu nại đến Admin','success'); await loadMessages(state.activeId,false);
        } catch(e) { showToast(e.message || 'Không thể gửi khiếu nại','error'); }
    }

    function openDialog(title, body) { closeDialog(); document.body.insertAdjacentHTML('beforeend',`<div class="commerce-dialog-backdrop" id="commerce-dialog"><section class="commerce-dialog"><header class="commerce-dialog-head"><h3>${esc(title)}</h3><button class="commerce-dialog-close" type="button"><i class="fa-solid fa-xmark"></i></button></header><div class="commerce-dialog-body" id="commerce-dialog-body">${body}</div></section></div>`); $('commerce-dialog').addEventListener('click',e=>{if(e.target.id==='commerce-dialog')closeDialog();}); document.querySelector('.commerce-dialog-close').addEventListener('click',closeDialog); }
    function setDialogBody(html) { if ($('commerce-dialog-body')) $('commerce-dialog-body').innerHTML=html; }
    function closeDialog() { $('commerce-dialog')?.remove(); }
    function loadingState(text) { return `<div style="padding:42px;text-align:center;color:#8993aa"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:24px;color:#6d5dfc"></i><p>${esc(text)}</p></div>`; }
    function emptyState(title,detail) { return `<div style="padding:38px 20px;text-align:center;color:#8993aa"><i class="fa-regular fa-comments" style="font-size:31px;color:#b8c0d1"></i><strong style="display:block;margin:12px 0 5px;color:#4b556d">${esc(title)}</strong><span style="font-size:12px">${esc(detail||'')}</span></div>`; }
    function showToast(message,type) { if (window.common?.showToast) window.common.showToast(message,type); else alert(message); }

    async function initSellerNotificationHub() {
        if (typeof signalR === 'undefined' || state.hub) return;
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const base = (window.API_BASE_URL || 'http://localhost:5000/api').replace('/api','');
        state.hub = new signalR.HubConnectionBuilder()
            .withUrl(`${base}/hubs/notification`, { accessTokenFactory: () => token })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Error)
            .build();
        state.hub.on('ReceiveNotification', async noti => {
            if (noti.type !== 'ShopChatMessage') return;
            await loadConversations(false);
            if (noti.targetId === state.activeId) await loadMessages(state.activeId, true);
            showSellerChatToast(noti);
        });
        try { await state.hub.start(); } catch (error) { console.warn('Seller notification connection failed', error); }
    }

    function showSellerChatToast(noti) {
        const old = document.getElementById('seller-chat-notification');
        old?.remove();
        const toast = document.createElement('button');
        toast.id = 'seller-chat-notification';
        toast.type = 'button';
        toast.style.cssText = 'position:fixed;right:24px;top:24px;z-index:60000;display:flex;align-items:center;gap:11px;max-width:390px;padding:13px 16px;border:1px solid #ddd8ff;border-radius:16px;background:#fff;color:#252b3f;box-shadow:0 18px 55px rgba(31,37,64,.2);cursor:pointer;text-align:left;font:inherit';
        toast.innerHTML = `<img src="${esc(avatar(noti.actorAvatarUrl,noti.actorName))}" style="width:42px;height:42px;border-radius:12px;object-fit:cover"><span><strong style="display:block">${esc(noti.actorName || 'Khách hàng')}</strong><span style="display:block;margin-top:3px;color:#6f7890;font-size:12px">${esc(noti.message || 'đã gửi tin nhắn mới')}</span></span>`;
        toast.addEventListener('click', () => { const conv = state.conversations.find(c => c.id === noti.targetId); if (conv) openConversation(conv.id); toast.remove(); });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 7000);
    }
})();
