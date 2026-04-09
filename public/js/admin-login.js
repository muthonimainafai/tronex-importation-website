function safeNextPath(raw) {
    if (!raw || typeof raw !== 'string') return '/admin-dashboard';
    const trimmed = raw.split('#')[0];
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/admin-dashboard';
    return trimmed;
}

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
                window.location.href = next;
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
