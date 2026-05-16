/**
 * Client gate for admin HTML pages. API calls still enforce auth server-side.
 */
(function adminGuard() {
    function basePath() {
        if (typeof tronexBase === 'function') {
            return tronexBase();
        }
        var m = document.querySelector('meta[name="tronex-base"]');
        return m ? (m.getAttribute('content') || '').replace(/\/$/, '') : '';
    }

    function appRelativePath() {
        var path = window.location.pathname || '/';
        var search = window.location.search || '';
        var base = basePath();
        if (base && path.indexOf(base) === 0) {
            path = path.slice(base.length) || '/';
        }
        return path + search;
    }

    function loginUrl(next) {
        var base = basePath();
        var url = (base || '') + '/admin-login';
        if (next) {
            url += '?next=' + encodeURIComponent(next);
        }
        return url;
    }

    function normalizeToken(raw) {
        if (!raw || typeof raw !== 'string') {
            return '';
        }
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
        if (!token || token === 'authenticated') {
            return false;
        }
        var parts = token.split('.');
        if (parts.length !== 3) {
            return false;
        }
        try {
            var payload = decodeJwtPayload(parts[1]);
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                return false;
            }
            return payload.typ === 'admin' || payload.role === 'admin';
        } catch (e) {
            return false;
        }
    }

    function redirectToLogin() {
        localStorage.removeItem('adminToken');
        var target = typeof tronexUrl === 'function'
            ? tronexUrl('/admin-login?next=' + encodeURIComponent(appRelativePath()))
            : loginUrl(appRelativePath());
        window.location.replace(target);
    }

    var token = normalizeToken(localStorage.getItem('adminToken'));
    if (!isAdminToken(token)) {
        redirectToLogin();
    }
})();
