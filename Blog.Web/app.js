// URL gốc trỏ về Backend API
const API_URL = 'http://localhost:7000/api/auth';

// CHÚ Ý: ĐIỀN GOOGLE CLIENT ID CỦA BẠN VÀO ĐÂY ĐỂ ĐĂNG NHẬP BẰNG GOOGLE HOẠT ĐỘNG
const GOOGLE_CLIENT_ID = 'THAY_CLIENT_ID_CUA_BAN_VAO_DAY.apps.googleusercontent.com';

const loginForm = document.getElementById('form-login');
const registerForm = document.getElementById('form-register');
const messageBox = document.getElementById('message-box');
const userDashboard = document.getElementById('user-dashboard');
const welcomeText = document.getElementById('welcome-text');
const userAvatar = document.getElementById('user-avatar');

// Hàm khởi tạo Load cho Google Button
window.onload = function() {
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin
    });
    google.accounts.id.renderButton(
        document.getElementById("googleButton"),
        { theme: "filled_blue", size: "large", shape: "pill", text: "signin_with", width: 280 }
    );
};

// Chuyển đổi giữa 2 tab Đăng Nhập / Đăng Ký
function switchTab(tab) {
    messageBox.classList.add('hidden');
    
    if (tab === 'login') {
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
        loginForm.classList.add('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.remove('active');
        registerForm.classList.add('hidden');
    } else {
        document.getElementById('tab-register').classList.add('active');
        document.getElementById('tab-login').classList.remove('active');
        registerForm.classList.add('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.remove('active');
        loginForm.classList.add('hidden');
    }
}

// Bắt lỗi submit của Đăng ký
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('reg-fullname').value;
    const gender = document.getElementById('reg-gender').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName, gender })
        });

        const data = await response.json();
        if (response.ok) {
            showMessage(data.message || 'Đăng ký thành công! Hãy đăng nhập.', 'success');
            setTimeout(() => switchTab('login'), 2000);
        } else {
            showMessage(data.message || 'Đăng ký thất bại.', 'error');
        }
    } catch (error) {
        showMessage('Không thể kết nối đến Server.', 'error');
    }
});

// Bắt lỗi submit của Đăng nhập truyền thống
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            handleLoginSuccess(data);
        } else {
            showMessage(data.message || 'Sai Email hoặc Mật khẩu.', 'error');
        }
    } catch (error) {
        showMessage('Không thể kết nối đến Server.', 'error');
    }
});

// Hàm Callback sau khi người dùng ấn Đăng Nhập Google
async function handleGoogleLogin(response) {
    const idToken = response.credential;
    
    try {
        // Gửi token này lên backend API /auth/google
        const res = await fetch(`${API_URL}/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });

        const data = await res.json();
        if (res.ok) {
            handleLoginSuccess(data);
        } else {
            showMessage(data.message || 'Lỗi khi xác thực bằng Google.', 'error');
        }
    } catch (error) {
        showMessage('Không thể gọi Server để xác nhận token.', 'error');
    }
}

// Hàm Tiện ích hiển thị bảng thông báo
function showMessage(msg, type) {
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove('hidden');
}

// Xử lý Giao diện sau khi Auth OK
function handleLoginSuccess(user) {
    // Ẩn form, hiện màn hình chào mừng
    document.querySelector('.tabs').classList.add('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    messageBox.classList.add('hidden');
    
    userDashboard.classList.remove('hidden');
    welcomeText.textContent = `Xin chào ${user.fullName} (${user.email})`;
    
    if (user.avatarUrl) {
        userAvatar.src = user.avatarUrl;
        userAvatar.classList.remove('hidden');
    }
    
    // Lưu Token vào LocalStorage (thực tế)
    localStorage.setItem('auth_token', user.token);
}

// Đăng xuất
function logout() {
    localStorage.removeItem('auth_token');
    window.location.reload();
}
