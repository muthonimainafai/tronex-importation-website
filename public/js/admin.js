// Admin Dashboard Script
let allCars = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Admin Dashboard loaded');
    setupEventListeners();
    loadDashboardStats();
});

// Setup event listeners
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Navigation links
    const navLinks = document.querySelectorAll('.admin-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === 'javascript:void(0)') {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (section) {
                    navigateToSection(section);
                }
            }
        });
    });
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        console.log('📊 Loading dashboard statistics...');
        const response = await fetch('/api/cars');
        const result = await response.json();

        if (result.success) {
            allCars = result.data;
            console.log('✅ Cars loaded:', allCars.length);

            // Update dashboard stats
            updateDashboardStats();
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Update dashboard statistics
function updateDashboardStats() {
    try {
        // Total Cars
        const totalCars = allCars.length;
        const totalCarsEl = document.getElementById('totalCars');
        if (totalCarsEl) {
            totalCarsEl.textContent = totalCars;
            console.log('📊 Total Cars:', totalCars);
        }

        // Featured Cars
        const featuredCars = allCars.filter(car => car.badge === 'Featured').length;
        const featuredCarsEl = document.getElementById('featuredCars');
        if (featuredCarsEl) {
            featuredCarsEl.textContent = featuredCars;
            console.log('⭐ Featured Cars:', featuredCars);
        }

        // New Arrivals
        const newArrivals = allCars.filter(car => car.badge === 'New Arrival').length;
        const newArrivalsEl = document.getElementById('newArrivals');
        if (newArrivalsEl) {
            newArrivalsEl.textContent = newArrivals;
            console.log('🔥 New Arrivals:', newArrivals);
        }
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

// Navigate to section
function navigateToSection(section) {
    console.log('📍 Navigating to section:', section);

    // Remove active class from all sections
    const allSections = document.querySelectorAll('.admin-section');
    allSections.forEach(sec => {
        sec.classList.remove('active');
    });

    // Add active class to target section
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update nav links
    const navLinks = document.querySelectorAll('.admin-nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === section) {
            link.classList.add('active');
        }
    });
}

// Handle logout
function handleLogout() {
    console.log('🚪 Logging out...');
    // Clear session/storage if needed
    sessionStorage.clear();
    // Redirect to login
    window.location.href = '/admin-login';
}

// Refresh dashboard stats periodically (every 30 seconds)
setInterval(loadDashboardStats, 30000);