function safeNextPath(raw) {
    if (!raw || typeof raw !== 'string') return '/admin-dashboard';
    var trimmed = raw.split('#')[0];
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/admin-dashboard';

    var base = typeof tronexBase === 'function' ? tronexBase() : '';
    if (base && trimmed.indexOf(base + '/') === 0) {
        trimmed = trimmed.slice(base.length) || '/admin-dashboard';
    } else if (trimmed === base) {
        trimmed = '/admin-dashboard';
    }

    if (trimmed === '/admin-login' || trimmed.indexOf('/admin-login?') === 0) {
        return '/admin-dashboard';
    }
    return trimmed;
}

function normalizeToken(raw) {
    if (!raw || typeof raw !== 'string') return '';
    var token = raw.trim();
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.slice(7).trim();
    }
    return token;
}

function decodeJwtPayload(segment) {
    var base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return JSON.parse(atob(base64));
}

function isAdminToken(token) {
    if (!token || token === 'authenticated') return false;
    var parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
        var payload = decodeJwtPayload(parts[1]);
        if (payload.exp && payload.exp * 1000 < Date.now()) return false;
        return payload.typ === 'admin' || payload.role === 'admin';
    } catch (e) {
        return false;
    }
}

(function redirectIfAlreadyLoggedIn() {
    var token = normalizeToken(localStorage.getItem('adminToken'));
    if (!isAdminToken(token)) return;
    var next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    var base = typeof tronexBase === 'function' ? tronexBase() : '';
    var target = typeof tronexUrl === 'function' ? tronexUrl(next) : (base + next);
    window.location.replace(target);
})();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const button = e.target.querySelector('button');

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    button.disabled = true;
    button.textContent = 'Logging in...';

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success && result.token) {
            localStorage.setItem('adminToken', result.token);

            const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
            successMessage.textContent = '✅ Login successful! Redirecting...';
            successMessage.style.display = 'block';

            setTimeout(() => {
                window.location.href = typeof tronexUrl === 'function' ? tronexUrl(next) : next;
            }, 600);
        } else {
            errorMessage.textContent = '❌ ' + (result.message || 'Invalid password');
            errorMessage.style.display = 'block';
            button.disabled = false;
            button.textContent = 'Login to Admin Panel';
            document.getElementById('password').value = '';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = '❌ Error logging in. Please try again.';
        errorMessage.style.display = 'block';
        button.disabled = false;
        button.textContent = 'Login to Admin Panel';
    }
});
