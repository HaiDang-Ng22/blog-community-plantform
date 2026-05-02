// js/api.js

// Cấu hình URL của Backend API.
// Khi chạy ở localhost, gọi đến server .NET (cổng 5142).
// Khi deploy Frontend lên Render, thay 'YOUR_BACKEND_URL' bằng URL thực tế của Backend (ví dụ: 'https://api.ten-ban.onrender.com')
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 👇👇👇 NẾU BẠN DEPLOY BACKEND Ở ĐÂU, HÃY ĐIỀN URL VÀO ĐÂY 👇👇👇
const PRODUCTION_BACKEND_URL = 'https://blog-community-plantform.onrender.com';

// Xác định API_BASE_URL
const API_BASE_URL = IS_LOCAL
    ? 'http://localhost:7000/api'
    : (PRODUCTION_BACKEND_URL !== 'https://blog-community-plantform.onrender.com'
        ? `${PRODUCTION_BACKEND_URL}/api`
        : `${window.location.origin}/api`); // Mặc định về origin nếu chưa cấu hình

window.API_BASE_URL = API_BASE_URL;


/**
 * Helper function for making API requests
 * @param {string} endpoint - The API endpoint (e.g., 'auth/login', 'posts')
 * @param {object} options - Fetch options (method, headers, body)
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}/${endpoint}`;

    // Auto-add Content-Type and Authorization header if available
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        // Handle non-JSON response (e.g., 500 error page or 404 text)
        const contentType = response.headers.get("content-type");
        let data;
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text || `Error ${response.status}: ${response.statusText}` };
        }

        if (!response.ok) {
            // Auto redirect to login on 401 Unauthorized
            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                // Only redirect if not already on auth.html
                if (!window.location.pathname.includes('auth.html')) {
                    window.location.href = 'auth.html?message=session_expired';
                }
            }
            throw { status: response.status, message: data.message || 'Có lỗi xảy ra' };
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// Export functions to global scope (since we are not using modules for simplicity in basic HTML)
window.api = {
    get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
    post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    patch: (endpoint, body) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
    uploadImage: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('auth_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            let errorMsg = `Lỗi ${response.status}: Không thể tải ảnh lên.`;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } else {
                    const textData = await response.text();
                    console.error("Upload error response:", textData);
                }
            } catch (e) {
                console.error("Could not parse error response", e);
            }
            throw new Error(errorMsg);
        }
        return await response.json();
    }
};
