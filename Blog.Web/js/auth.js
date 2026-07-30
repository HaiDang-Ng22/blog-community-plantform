// Zynk authentication interactions
const GOOGLE_CLIENT_ID = '202612503485-hd4eopni01gadqphfpb194b6ga93vb7f.apps.googleusercontent.com';

const loginForm = document.getElementById('form-login');
const registerForm = document.getElementById('form-register');
const forgotForm = document.getElementById('form-forgot');
const resetForm = document.getElementById('form-reset');
const otpForm = document.getElementById('form-otp');
const messageBox = document.getElementById('message-box');
const formTitle = document.getElementById('form-title');
const formSubtitle = document.getElementById('form-subtitle');

let pendingEmail = '';
let googleRendered = false;

const formCopy = {
    login: {
        title: 'Đăng nhập tài khoản',
        subtitle: 'Tiếp tục hành trình kết nối và khám phá của bạn.'
    },
    register: {
        title: 'Tạo tài khoản mới',
        subtitle: 'Tham gia cộng đồng Zynk chỉ trong vài bước đơn giản.'
    },
    forgot: {
        title: 'Bảo mật tài khoản',
        subtitle: 'Chúng tôi sẽ giúp bạn lấy lại quyền truy cập.'
    },
    reset: {
        title: 'Bảo mật tài khoản',
        subtitle: 'Tạo một mật khẩu mới đủ mạnh và dễ nhớ.'
    },
    otp: {
        title: 'Xác thực tài khoản',
        subtitle: 'Chỉ còn một bước để bắt đầu cùng Zynk.'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeGoogleButton();
    initializePasswordFeedback();
    initializeOtpInputs();
    initializeSceneParallax();
    handleAuthQuery();

    document.querySelectorAll('.auth-form input, .auth-form select').forEach((field) => {
        field.addEventListener('input', () => {
            if (!messageBox.classList.contains('hidden') && messageBox.classList.contains('error')) {
                hideMessage();
            }
        });
    });
});

window.addEventListener('load', initializeGoogleButton);

function initializeGoogleButton() {
    if (googleRendered || typeof google === 'undefined' || !document.getElementById('googleButton')) return;

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin
    });
    google.accounts.id.renderButton(document.getElementById('googleButton'), {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(390, document.getElementById('googleButton').clientWidth || 390)
    });

    googleRendered = true;
    document.getElementById('google-fallback')?.remove();
}

function switchTab(tab) {
    hideMessage();

    const forms = { login: loginForm, register: registerForm, forgot: forgotForm, reset: resetForm, otp: otpForm };
    Object.values(forms).forEach((form) => {
        form?.classList.add('hidden');
        form?.classList.remove('active');
    });

    const tabs = document.querySelector('.tabs');
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const isPrimaryTab = tab === 'login' || tab === 'register';

    tabs.hidden = !isPrimaryTab;
    tabs.classList.toggle('register-active', tab === 'register');
    loginTab.classList.toggle('active', tab === 'login');
    registerTab.classList.toggle('active', tab === 'register');
    loginTab.setAttribute('aria-selected', String(tab === 'login'));
    registerTab.setAttribute('aria-selected', String(tab === 'register'));

    const selectedForm = forms[tab] || loginForm;
    selectedForm.classList.remove('hidden');
    selectedForm.classList.add('active');

    const copy = formCopy[tab] || formCopy.login;
    formTitle.textContent = copy.title;
    formSubtitle.textContent = copy.subtitle;

    if (tab === 'otp' && pendingEmail) {
        document.getElementById('otp-email-display').textContent = pendingEmail;
    }

    const firstField = selectedForm.querySelector('input:not([type="checkbox"]), select');
    window.setTimeout(() => firstField?.focus({ preventScroll: true }), 120);
}

function validateForm(form) {
    if (form.checkValidity()) return true;
    form.reportValidity();
    const invalid = form.querySelector(':invalid');
    invalid?.focus();
    return false;
}

function setFormLoading(form, isLoading, loadingText = 'Đang xử lý...') {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    const label = button.querySelector('[data-button-label]');
    if (!button.dataset.defaultLabel && label) button.dataset.defaultLabel = label.textContent;
    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);
    button.setAttribute('aria-busy', String(isLoading));
    if (label) label.textContent = isLoading ? loadingText : button.dataset.defaultLabel;
}

registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(registerForm)) return;

    const fullName = document.getElementById('reg-fullname').value.trim();
    const gender = document.getElementById('reg-gender').value;
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
        showMessage('Mật khẩu xác nhận chưa trùng khớp.', 'error');
        document.getElementById('reg-confirm-password').focus();
        return;
    }

    if (!isStrongPassword(password)) {
        showMessage('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa và ký tự đặc biệt.', 'error');
        document.getElementById('reg-password').focus();
        return;
    }

    setFormLoading(registerForm, true, 'Đang gửi mã...');
    try {
        const data = await window.api.post('auth/register', { email, password, fullName, gender });
        pendingEmail = email;
        showMessage(data.message || 'Mã xác thực đã được gửi đến email của bạn.', 'success');
        window.setTimeout(() => switchTab('otp'), 900);
    } catch (error) {
        showMessage(error.message || 'Đăng ký chưa thành công. Vui lòng thử lại.', 'error');
    } finally {
        setFormLoading(registerForm, false);
    }
});

otpForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(otpForm)) return;

    const otp = document.getElementById('otp-code').value.trim();
    if (!/^\d{6}$/.test(otp)) {
        showMessage('Vui lòng nhập đúng mã OTP gồm 6 chữ số.', 'error');
        return;
    }

    setFormLoading(otpForm, true, 'Đang xác minh...');
    try {
        const data = await window.api.post('auth/verify-otp', { email: pendingEmail, otp });
        showMessage(data.message || 'Xác minh thành công! Bạn có thể đăng nhập.', 'success');
        window.setTimeout(() => {
            switchTab('login');
            document.getElementById('login-email').value = pendingEmail;
        }, 1100);
    } catch (error) {
        showMessage(error.message || 'Mã xác thực không đúng hoặc đã hết hạn.', 'error');
    } finally {
        setFormLoading(otpForm, false);
    }
});

forgotForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(forgotForm)) return;

    const email = document.getElementById('forgot-email').value.trim();
    setFormLoading(forgotForm, true, 'Đang gửi mã...');
    try {
        const data = await window.api.post('auth/forgot-password', { email });
        pendingEmail = email;
        showMessage(data.message || 'Mã khôi phục đã được gửi đến email của bạn.', 'success');
        window.setTimeout(() => switchTab('reset'), 900);
    } catch (error) {
        showMessage(error.message || 'Không thể gửi mã khôi phục. Vui lòng thử lại.', 'error');
    } finally {
        setFormLoading(forgotForm, false);
    }
});

resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(resetForm)) return;

    const otp = document.getElementById('reset-otp').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;
    if (!/^\d{6}$/.test(otp)) {
        showMessage('Vui lòng nhập đúng mã OTP gồm 6 chữ số.', 'error');
        return;
    }
    if (!isStrongPassword(newPassword)) {
        showMessage('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa và ký tự đặc biệt.', 'error');
        return;
    }

    setFormLoading(resetForm, true, 'Đang cập nhật...');
    try {
        const data = await window.api.post('auth/reset-password', { email: pendingEmail, otp, newPassword });
        showMessage(data.message || 'Đổi mật khẩu thành công. Bạn có thể đăng nhập.', 'success');
        window.setTimeout(() => switchTab('login'), 1100);
    } catch (error) {
        showMessage(error.message || 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra mã OTP.', 'error');
    } finally {
        setFormLoading(resetForm, false);
    }
});

loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(loginForm)) return;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    setFormLoading(loginForm, true, 'Đang đăng nhập...');
    try {
        const data = await window.api.post('auth/login', { email, password });
        handleLoginSuccess(data);
    } catch (error) {
        showMessage(error.message || 'Email hoặc mật khẩu chưa chính xác.', 'error');
        setFormLoading(loginForm, false);
    }
});

async function handleGoogleLogin(response) {
    setFormLoading(loginForm, true, 'Đang kết nối...');
    try {
        const data = await window.api.post('auth/google', { idToken: response.credential });
        handleLoginSuccess(data);
    } catch (error) {
        showMessage(error.message || 'Không thể xác thực với Google.', 'error');
        setFormLoading(loginForm, false);
    }
}

function showMessage(message, type) {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove('hidden');
    messageBox.setAttribute('role', type === 'error' ? 'alert' : 'status');
}

function hideMessage() {
    if (!messageBox) return;
    messageBox.className = 'message-box hidden';
    messageBox.textContent = '';
}

function handleLoginSuccess(user) {
    localStorage.setItem('auth_token', user.token);
    localStorage.setItem('user_info', JSON.stringify(user));
    showMessage('Đăng nhập thành công! Đang chuyển hướng...', 'success');

    window.setTimeout(() => {
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
        } catch { /* Storage may be unavailable in private mode. */ }
        window.location.href = target;
    }, 800);
}

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('.eye-icon');
    const shouldShow = input.type === 'password';
    input.type = shouldShow ? 'text' : 'password';
    button.setAttribute('aria-label', shouldShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    button.setAttribute('aria-pressed', String(shouldShow));

    icon.innerHTML = shouldShow
        ? '<path d="M4 4l16 16M10.6 10.7a2 2 0 002.7 2.7M9.5 6.3A10.7 10.7 0 0112 6c7 0 10 6 10 6a15 15 0 01-3 3.7M6.2 7.2A14.2 14.2 0 002 12s3 6 10 6a10.5 10.5 0 003-.4"/>'
        : '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.7"/>';
}

function isStrongPassword(password) {
    return /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(password);
}

function initializePasswordFeedback() {
    const password = document.getElementById('reg-password');
    const confirmation = document.getElementById('reg-confirm-password');
    const strength = document.querySelector('.password-strength');
    const strengthLabel = document.getElementById('strength-label');
    const matchLabel = document.getElementById('password-match');

    const updateStrength = () => {
        const value = password.value;
        let score = 0;
        if (value.length >= 8) score++;
        if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
        if (/\d/.test(value)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) score++;
        strength.dataset.score = value ? String(score) : '0';
        const labels = ['Dùng chữ hoa, chữ thường và ký tự đặc biệt', 'Mật khẩu yếu', 'Mật khẩu trung bình', 'Mật khẩu khá', 'Mật khẩu mạnh'];
        strengthLabel.textContent = labels[score];
    };

    const updateMatch = () => {
        if (!confirmation.value) {
            matchLabel.textContent = '';
            matchLabel.className = 'match-hint';
            return;
        }
        const matches = password.value === confirmation.value;
        matchLabel.textContent = matches ? '✓ Mật khẩu đã trùng khớp' : 'Mật khẩu chưa trùng khớp';
        matchLabel.className = `match-hint ${matches ? 'success' : 'error'}`;
    };

    password?.addEventListener('input', () => { updateStrength(); updateMatch(); });
    confirmation?.addEventListener('input', updateMatch);
}

function initializeOtpInputs() {
    ['otp-code', 'reset-otp'].forEach((id) => {
        const input = document.getElementById(id);
        input?.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, 6);
        });
    });
}

function initializeSceneParallax() {
    const scene = document.getElementById('auth-scene');
    const showcase = document.querySelector('.auth-showcase');
    if (!scene || !showcase || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    showcase.addEventListener('pointermove', (event) => {
        const bounds = showcase.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - .5;
        const y = (event.clientY - bounds.top) / bounds.height - .5;
        scene.style.setProperty('--ry', `${x * 8}deg`);
        scene.style.setProperty('--rx', `${y * -7}deg`);
    });
    showcase.addEventListener('pointerleave', () => {
        scene.style.setProperty('--ry', '0deg');
        scene.style.setProperty('--rx', '0deg');
    });
}

function handleAuthQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') switchTab('register');
    if (params.get('message') === 'session_expired') {
        showMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
    }
}
