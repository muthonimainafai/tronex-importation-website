// ==================== Auth Nav (Public Site) ====================
function updateAuthNav() {
    const token = localStorage.getItem('tronex_token');
    const elRegister = document.getElementById('authNavRegister');
    const elLogin = document.getElementById('authNavLogin');
    const elProfile = document.getElementById('authNavProfile');
    const elLogout = document.getElementById('authNavLogout');

    if (!elRegister || !elLogin || !elProfile || !elLogout) return;

    if (token) {
        elRegister.style.display = 'none';
        elLogin.style.display = 'none';
        elProfile.style.display = 'list-item';
        elLogout.style.display = 'list-item';
    } else {
        elRegister.style.display = 'list-item';
        elLogin.style.display = 'list-item';
        elProfile.style.display = 'none';
        elLogout.style.display = 'none';
    }

    const logoutLink = elLogout.querySelector('a');
    if (logoutLink) {
        logoutLink.onclick = () => {
            localStorage.removeItem('tronex_token');
            localStorage.removeItem('tronex_user');
            try {
                document.cookie = 'tronex_token=; Max-Age=0; Path=/; SameSite=Lax';
            } catch (_) {}
            updateAuthNav();
            window.location.href = '/';
        };
    }
}

// Run on load
updateAuthNav();
let landingCars = [];

function setupCarsGridListeners() {
    const carsGrid = document.getElementById('carsGrid');
    if (!carsGrid) return;

    carsGrid.addEventListener('click', (event) => {
        const detailsBtn = event.target.closest('.btn-details');
        if (detailsBtn) {
            event.preventDefault();
            const carCard = detailsBtn.closest('.car-card');
            const carId = carCard ? carCard.getAttribute('data-car-id') : '';
            if (carId) {
                window.location.href = `/car/${carId}`;
            }
        }
    });
}

// ==================== Search Form ====================
const searchForm = document.getElementById('searchForm');
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const make = String(document.getElementById('make').value || '').trim();
        const model = String(document.getElementById('model').value || '').trim();
        const year = Number(document.getElementById('year').value);

        if (!make || !model || !year) return;
        if (!Array.isArray(landingCars) || landingCars.length === 0) {
            setSearchFeedback('Vehicle list is still loading. Please try again in a moment.', 'info');
            return;
        }

        const query = {
            make: make.toLowerCase(),
            model: model.toLowerCase(),
            year
        };

        const exactMatches = landingCars.filter((car) => {
            const carMake = String(car.make || '').toLowerCase();
            const carModel = String(car.model || '').toLowerCase();
            const carYear = Number(car.year);
            return carMake === query.make && carModel.includes(query.model) && carYear === query.year;
        });
        const exactAvailable = exactMatches.filter(isAvailableCar);

        document.querySelector('#stock-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (exactAvailable.length > 0) {
            const summary = `${exactAvailable.length} vehicle(s) available for ${year} ${make} ${model}.`;
            setSearchFeedback(summary, 'success');
            renderVehiclesInStock(exactAvailable, { limit: 8 });
            return;
        }

        const similarCars = getSimilarCars(landingCars, query, exactMatches.map((car) => String(car._id))).slice(0, 8);
        const unavailableMsg = 'Car Not Available at the moment.';
        if (similarCars.length > 0) {
            setSearchFeedback(`${unavailableMsg} Here are similar cars you may like.`, 'warning');
            renderVehiclesInStock(similarCars, { limit: 8 });
        } else {
            setSearchFeedback(`${unavailableMsg} We currently have no close alternatives.`, 'warning');
            renderVehiclesInStock([], { emptyMessage: unavailableMsg });
        }
    });
}

// ==================== CTA Button ====================
const ctaButton = document.querySelector('.cta-button');
if (ctaButton) {
    ctaButton.addEventListener('click', () => {
        document.querySelector('#stock-list').scrollIntoView({ behavior: 'smooth' });
    });
}

// ==================== Mobile Menu ====================
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
}

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-container')) {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    }
});

// ==================== Scroll Animations ====================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.car-card, .feature-card, .stat-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
});

// ==================== Initialize ====================
setupCarsGridListeners();
loadLandingVehicles();
console.log('✅ Tronex Car Importers - Landing Page Loaded Successfully!');

async function loadLandingVehicles() {
    const carsGrid = document.getElementById('carsGrid');
    if (!carsGrid) return;

    try {
        const response = await fetch('/api/cars');
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
            throw new Error('Invalid cars response');
        }

        landingCars = result.data;
        renderVehiclesInStock(landingCars);
        setSearchFeedback('', '');
    } catch (error) {
        console.error('Failed to load vehicles for landing page:', error);
        carsGrid.innerHTML = '<p class="section-subtitle">Unable to load vehicles right now. Please visit the stock list page.</p>';
        setSearchFeedback('Unable to search right now. Please try again later.', 'warning');
    }
}

function toNumericValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? '').replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getInvoiceTotalFromCosts(invoiceCosts) {
    if (!invoiceCosts || typeof invoiceCosts !== 'object') return null;

    const itemizedKeys = [
        'cif',
        'portCfsCharges',
        'shippingLineDo',
        'radiation',
        'mssLevy',
        'clearingServiceCharge',
        'kgPlate',
        'ntsaSticker',
        'handlingCosts'
    ];

    const hasAnyInvoiceValue = itemizedKeys.some((key) => toNumericValue(invoiceCosts[key]) > 0)
        || toNumericValue(invoiceCosts.dutyPayable) > 0
        || toNumericValue(invoiceCosts.discount) > 0;

    if (!hasAnyInvoiceValue) return null;

    const itemizedTotal = itemizedKeys.reduce((sum, key) => sum + toNumericValue(invoiceCosts[key]), 0);
    const dutyPayable = toNumericValue(invoiceCosts.dutyPayable);
    const discount = toNumericValue(invoiceCosts.discount);
    return Math.max(0, itemizedTotal + dutyPayable - discount);
}

function formatKsh(value) {
    return `KSH ${toNumericValue(value).toLocaleString()}`;
}

function isAvailableCar(car) {
    const status = String(car?.availability || 'available').toLowerCase();
    return status !== 'sold' && status !== 'reserved';
}

function getSimilarCars(cars, query, excludedIds = []) {
    const excluded = new Set((excludedIds || []).map((id) => String(id)));
    const modelQuery = query.model;

    return cars
        .filter((car) => !excluded.has(String(car._id)))
        .filter(isAvailableCar)
        .map((car) => {
            const carMake = String(car.make || '').toLowerCase();
            const carModel = String(car.model || '').toLowerCase();
            const carYear = Number(car.year);
            const yearDiff = Number.isFinite(carYear) ? Math.abs(carYear - query.year) : 99;
            let score = 0;

            if (carMake === query.make) score += 5;
            if (modelQuery && (carModel.includes(modelQuery) || modelQuery.includes(carModel))) score += 4;
            if (yearDiff <= 1) score += 3;
            else if (yearDiff <= 3) score += 1;
            if (carMake.startsWith(query.make.slice(0, 2))) score += 1;

            return { car, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return new Date(b.car.createdAt) - new Date(a.car.createdAt);
        })
        .map((entry) => entry.car);
}

function setSearchFeedback(message, tone) {
    const el = document.getElementById('searchFeedback');
    if (!el) return;
    if (!message) {
        el.className = 'search-feedback';
        el.textContent = '';
        el.style.display = 'none';
        return;
    }
    el.className = `search-feedback ${tone || 'info'}`;
    el.textContent = message;
    el.style.display = 'block';
}

function renderVehiclesInStock(cars, options = {}) {
    const carsGrid = document.getElementById('carsGrid');
    if (!carsGrid) return;
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 8;
    const emptyMessage = options.emptyMessage || 'No vehicles available at the moment.';

    const sortedCars = [...cars].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const visibleCars = sortedCars.slice(0, limit);
    if (visibleCars.length === 0) {
        carsGrid.innerHTML = `<p class="section-subtitle">${emptyMessage}</p>`;
        return;
    }

    carsGrid.innerHTML = visibleCars.map((car) => {
        const invoiceTotal = getInvoiceTotalFromCosts(car.invoiceCosts);
        const displayPrice = invoiceTotal !== null ? invoiceTotal : toNumericValue(car.price);
        const thumbSrc = car.mainImage || (Array.isArray(car.images) && car.images[0]) || '';
        const safeThumb = String(thumbSrc).replace(/"/g, '&quot;');
        const carName = car.name || `${car.make || ''} ${car.model || ''}`.trim();
        const safeCarName = String(carName).replace(/"/g, '&quot;');

        return `
            <div class="car-card" data-car-id="${car._id}">
                <div class="car-image">
                    ${thumbSrc
                        ? `<img src="${safeThumb}" alt="${safeCarName}" loading="lazy" onerror="this.onerror=null;this.src='/images/placeholder-car.svg'">`
                        : `<div class="car-placeholder" style="background: ${car.gradientColor || '#2d2d2d'};"><i class="fas fa-car-side"></i></div>`}
                    <span class="car-badge-featured">${car.badge || 'In Stock'}</span>
                </div>
                <div class="car-details">
                    <div class="car-title-price">
                        <h3>${carName}</h3>
                        <span class="car-inline-price">${formatKsh(displayPrice)}</span>
                    </div>
                    <p class="car-subtitle">${car.type || 'Vehicle'} • ${car.color || 'N/A'}</p>
                    <div class="car-specs">
                        <div class="spec"><i class="fas fa-calendar-alt"></i><span>${car.year || 'N/A'}</span></div>
                        <div class="spec"><i class="fas fa-tachometer-alt"></i><span>${Number(car.mileage || 0).toLocaleString()} km</span></div>
                        <div class="spec"><i class="fas fa-gas-pump"></i><span>${car.transmission || 'N/A'}</span></div>
                    </div>
                    <div class="car-description">${car.description || 'View this vehicle on the stock list for full details.'}</div>
                    <div class="car-actions">
                        <button class="btn-details">View Details</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}