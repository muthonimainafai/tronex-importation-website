document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const button = e.target.querySelector('button');

    // Clear messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Disable button while logging in
    button.disabled = true;
    button.textContent = 'Logging in...';

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
            // Store auth token in localStorage with expiration
            localStorage.setItem('adminToken', 'authenticated');
            localStorage.setItem('adminLoginTime', new Date().getTime());

            successMessage.textContent = '✅ Login successful! Redirecting...';
            successMessage.style.display = 'block';
            
            // Redirect after 1.5 seconds to the actual admin dashboard page
            setTimeout(() => {
                window.location.href = '/admin-dashboard';
            }, 1500);
        } else {
            errorMessage.textContent = '❌ ' + (result.message || 'Invalid password');
            errorMessage.style.display = 'block';
            button.disabled = false;
            button.textContent = 'Login to Admin Panel';
            
            // Clear password field
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