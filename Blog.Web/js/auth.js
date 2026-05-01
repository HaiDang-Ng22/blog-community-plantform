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
    
    // Chuyển hướng về trang yêu cầu trước đó (nếu có)
    setTimeout(() => {
        let target = 'index.html';
        try {
            const saved = sessionStorage.getItem('zynk_return_to');
            if (saved) {
                sessionStorage.removeItem('zynk_return_to');
                target = saved;
            }
        } catch { /* ignore */ }
        window.location.href = target;
    }, 1000);
}

// Tính năng ẩn/hiện mật khẩu
function togglePassword(inputId, button) {
    const passwordInput = document.getElementById(inputId);
    const eyeIcon = button.querySelector('.eye-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        // Đổi icon sang "eye-off" (thêm gạch chéo)
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        passwordInput.type = 'password';
        // Đổi icon lại thành "eye" bình thường
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}
