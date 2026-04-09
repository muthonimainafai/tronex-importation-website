/**
 * Client gate for admin HTML pages. API calls still enforce auth server-side.
 */
(function adminGuard() {
    var token = localStorage.getItem('adminToken');
    var path = window.location.pathname || '';
    var qs = window.location.search || '';

    function redirectToLogin() {
        localStorage.removeItem('adminToken');
        window.location.replace('/admin-login?next=' + encodeURIComponent(path + qs));
    }

    if (!token || token === 'authenticated') {
        redirectToLogin();
        return;
    }

    try {
        var parts = token.split('.');
        if (parts.length !== 3) throw new Error('invalid');
        var payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        var pad = payloadB64.length % 4;
        if (pad) payloadB64 += new Array(5 - pad).join('=');
        var payload = JSON.parse(atob(payloadB64));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            redirectToLogin();
        }
    } catch (e) {
        redirectToLogin();
    }
})();
