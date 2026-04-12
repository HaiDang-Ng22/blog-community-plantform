// js/auth.js

// GOOGLE CLIENT ID
const GOOGLE_CLIENT_ID = 'THAY_CLIENT_ID_CUA_BAN_VAO_DAY.apps.googleusercontent.com';

const loginForm = document.getElementById('form-login');
const registerForm = document.getElementById('form-register');
const messageBox = document.getElementById('message-box');

// Khởi tạo Google Login
window.onload = function() {
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleLogin
        });
        google.accounts.id.renderButton(
            document.getElementById("googleButton"),
            { theme: "filled_blue", size: "large", shape: "pill", text: "signin_with", width: 280 }
        );
    }
};

// Chuyển đổi tab
function switchTab(tab) {
    if (messageBox) messageBox.classList.add('hidden');
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.add('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.remove('active');
        registerForm.classList.add('hidden');
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.add('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.remove('active');
        loginForm.classList.add('hidden');
    }
}

// Xử lý Đăng ký
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-fullname').value;
        const gender = document.getElementById('reg-gender').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        // Validation logic
        if (password !== confirmPassword) {
            showMessage('Mật khẩu nhập lại không khớp.', 'error');
            return;
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            showMessage('Mật khẩu phải tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 ký tự đặc biệt.', 'error');
            return;
        }

        try {
            const data = await window.api.post('auth/register', { email, password, fullName, gender });
            showMessage(data.message || 'Đăng ký thành công! Hãy đăng nhập.', 'success');
            setTimeout(() => switchTab('login'), 2000);
        } catch (error) {
            showMessage(error.message || 'Đăng ký thất bại.', 'error');
        }
    });
}

// Xử lý Đăng nhập
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const data = await window.api.post('auth/login', { email, password });
            handleLoginSuccess(data);
        } catch (error) {
            showMessage(error.message || 'Sai Email hoặc Mật khẩu.', 'error');
        }
    });
}

// Xác thực Google
async function handleGoogleLogin(response) {
    const idToken = response.credential;
    try {
        const data = await window.api.post('auth/google', { idToken });
        handleLoginSuccess(data);
    } catch (error) {
        showMessage(error.message || 'Lỗi xác thực Google.', 'error');
    }
}

function showMessage(msg, type) {
    if (!messageBox) return;
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove('hidden');
}

function handleLoginSuccess(user) {
    localStorage.setItem('auth_token', user.token);
    localStorage.setItem('user_info', JSON.stringify(user));
    
    showMessage('Đăng nhập thành công! Đang chuyển hướng...', 'success');
    
    // Chuyển hướng về trang chủ
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}
