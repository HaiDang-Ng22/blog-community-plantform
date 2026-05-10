// js/auth.js

const GOOGLE_CLIENT_ID = '202612503485-hd4eopni01gadqphfpb194b6ga93vb7f.apps.googleusercontent.com';

const loginForm = document.getElementById('form-login');
const registerForm = document.getElementById('form-register');
const forgotForm = document.getElementById('form-forgot');
const resetForm = document.getElementById('form-reset');
const otpForm = document.getElementById('form-otp');
const messageBox = document.getElementById('message-box');

// Biến toàn cục lưu email đang xử lý OTP
let pendingEmail = '';

window.onload = function () {
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

function switchTab(tab) {
    if (messageBox) messageBox.classList.add('hidden');

    const tabLoginBtn = document.getElementById('tab-login');
    const tabRegisterBtn = document.getElementById('tab-register');
    const tabsContainer = document.querySelector('.tabs');

    // Mặc định ẩn tất cả các form
    loginForm?.classList.add('hidden');
    registerForm?.classList.add('hidden');
    forgotForm?.classList.add('hidden');
    resetForm?.classList.add('hidden');
    otpForm?.classList.add('hidden');

    // Tắt class active
    loginForm?.classList.remove('active');
    registerForm?.classList.remove('active');
    forgotForm?.classList.remove('active');
    resetForm?.classList.remove('active');
    otpForm?.classList.remove('active');

    // Hiện lại phần tabs nếu ở Đăng nhập/Đăng ký
    if (tab === 'login' || tab === 'register') {
        tabsContainer.style.display = 'flex';
    } else {
        tabsContainer.style.display = 'none';
    }

    if (tab === 'login') {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        loginForm.classList.remove('hidden');
        loginForm.classList.add('active');
    } else if (tab === 'register') {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        registerForm.classList.remove('hidden');
        registerForm.classList.add('active');
    } else if (tab === 'forgot') {
        forgotForm.classList.remove('hidden');
        forgotForm.classList.add('active');
    } else if (tab === 'reset') {
        resetForm.classList.remove('hidden');
        resetForm.classList.add('active');
    } else if (tab === 'otp') {
        otpForm.classList.remove('hidden');
        otpForm.classList.add('active');
    }
}

// Xử lý Đăng ký (Gửi yêu cầu nhận OTP)
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-fullname').value;
        const gender = document.getElementById('reg-gender').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
            showMessage('Mật khẩu nhập lại không khớp.', 'error');
            return;
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            showMessage('Mật khẩu phải tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 ký tự đặc biệt.', 'error');
            return;
        }

        showMessage('Đang xử lý gửi mã OTP...', 'success');
        try {
            const data = await window.api.post('auth/register', { email, password, fullName, gender });
            pendingEmail = email;
            showMessage(data.message || 'Mã xác thực đã được gửi.', 'success');
            setTimeout(() => switchTab('otp'), 1500);
        } catch (error) {
            showMessage(error.message || 'Đăng ký thất bại.', 'error');
        }
    });
}

// Xử lý Xác thực OTP (Hoàn tất đăng ký)
if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = document.getElementById('otp-code').value;

        try {
            const data = await window.api.post('auth/verify-otp', { email: pendingEmail, otp: otp });
            showMessage(data.message || 'Xác minh thành công! Vui lòng đăng nhập.', 'success');
            setTimeout(() => switchTab('login'), 2000);
        } catch (error) {
            showMessage(error.message || 'Mã xác thực không hợp lệ.', 'error');
        }
    });
}

// Xử lý Quên mật khẩu
if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        showMessage('Đang gửi mã khôi phục...', 'success');

        try {
            const data = await window.api.post('auth/forgot-password', { email });
            pendingEmail = email;
            showMessage(data.message || 'Mã khôi phục đã được gửi!', 'success');
            setTimeout(() => switchTab('reset'), 1500);
        } catch (error) {
            showMessage(error.message || 'Có lỗi xảy ra.', 'error');
        }
    });
}

// Xử lý Đặt lại mật khẩu
if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('reset-new-password').value;

        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            showMessage('Mật khẩu phải tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 ký tự đặc biệt.', 'error');
            return;
        }

        try {
            const data = await window.api.post('auth/reset-password', { email: pendingEmail, otp, newPassword });
            showMessage(data.message || 'Đổi mật khẩu thành công.', 'success');
            setTimeout(() => switchTab('login'), 2000);
        } catch (error) {
            showMessage(error.message || 'Lỗi khi đặt lại mật khẩu.', 'error');
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

    setTimeout(() => {
        if (user.role === 'Admin') {
            window.location.href = 'admin/index.html';
            return;
        }

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

function togglePassword(inputId, button) {
    const passwordInput = document.getElementById(inputId);
    const eyeIcon = button.querySelector('.eye-icon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}
