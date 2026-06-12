const ADMIN_BASE = window.TRONEX_ADMIN_BASE || '/admin...';
const ADMIN_DEFAULT_PATH = window.TRONEX_ADMIN_DASHBOARD || '/admin.../dashboard';

function mapLegacyAdminPath(path) {
    const legacy = {
        '/admin-login': ADMIN_BASE,
        '/admin/login': ADMIN_BASE,
        '/admin': ADMIN_BASE,
        '/admin/': ADMIN_BASE,
        '/admin-dashboard': ADMIN_DEFAULT_PATH,
        '/admin/dashboard': ADMIN_DEFAULT_PATH,
        '/manage-cars': window.TRONEX_ADMIN_MANAGE_CARS || '/admin.../manage-cars',
        '/admin/manage-cars': window.TRONEX_ADMIN_MANAGE_CARS || '/admin.../manage-cars',
    };
    if (legacy[path]) {
        return legacy[path];
    }
    if (path.indexOf('/admin-login?') === 0) {
        return ADMIN_BASE;
    }
    return path;
}

function isAllowedAdminNextPath(path) {
    return path === ADMIN_BASE || path.startsWith(ADMIN_BASE + '/');
}

function safeNextPath(raw) {
    if (!raw || typeof raw !== 'string') return ADMIN_DEFAULT_PATH;
    var trimmed = raw.split('#')[0];
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return ADMIN_DEFAULT_PATH;

    var base = typeof tronexBase === 'function' ? tronexBase() : '';
    if (base && trimmed.indexOf(base + '/') === 0) {
        trimmed = trimmed.slice(base.length) || ADMIN_DEFAULT_PATH;
    } else if (trimmed === base) {
        trimmed = ADMIN_DEFAULT_PATH;
    }

    trimmed = mapLegacyAdminPath(trimmed);

    if (trimmed === ADMIN_BASE || trimmed === ADMIN_BASE + '/') {
        return ADMIN_DEFAULT_PATH;
    }
    if (!isAllowedAdminNextPath(trimmed)) {
        return ADMIN_DEFAULT_PATH;
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

function persistAdminSession(token) {
    localStorage.setItem('adminToken', token);
    try {
        var maxAge = 60 * 60 * 8;
        document.cookie = 'tronex_admin_token=' + encodeURIComponent(token) + '; Max-Age=' + maxAge + '; Path=/; SameSite=Lax';
    } catch (_) {}
}

function clearAdminSession() {
    localStorage.removeItem('adminToken');
    try {
        document.cookie = 'tronex_admin_token=; Max-Age=0; Path=/; SameSite=Lax';
    } catch (_) {}
}

(function redirectIfAlreadyLoggedIn() {
    var token = normalizeToken(localStorage.getItem('adminToken'));
    if (!isAdminToken(token)) return;
    persistAdminSession(token);
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
            persistAdminSession(result.token);

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
