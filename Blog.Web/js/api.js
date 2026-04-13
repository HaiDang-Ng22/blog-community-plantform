// js/api.js
const API_BASE_URL = window.location.origin + '/api';

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
            const errorData = await response.json();
            throw new Error(errorData.message || 'Lỗi khi tải ảnh lên');
        }
        return await response.json();
    }
};
