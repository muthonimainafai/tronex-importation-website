let cars = [];
let currentEditId = null;

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    const loginTime = localStorage.getItem('adminLoginTime');
    
    if (!token || !loginTime) {
        console.log('❌ No token found, redirecting to login');
        window.location.href = '/admin-login';
        return false;
    }

    // Optional: Check if session expired (24 hours)
    const currentTime = new Date().getTime();
    const tokenAge = currentTime - parseInt(loginTime);
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (tokenAge > twentyFourHours) {
        console.log('❌ Session expired, redirecting to login');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminLoginTime');
        window.location.href = '/admin-login';
        return false;
    }

    console.log('✅ Admin authenticated');
    return true;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin page loading...');
    if (!checkAuth()) {
        console.log('Authentication failed, redirecting to login');
        window.location.href = '/admin-login';
        return;
    }

    console.log('Authentication successful');
    loadCars();
    setupNavigation();
    setupForm();
    setupLogout();
});

// Setup logout
function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminLoginTime');
            window.location.href = '/';
        }
    });
}