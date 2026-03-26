// ==================== Cart Functionality ====================
let cart = [];

const cartIcon = document.getElementById('cartIcon');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const closeCartBtn = document.getElementById('closeCart');
const cartItemsContainer = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const subtotalEl = document.getElementById('subtotal');
const taxAmountEl = document.getElementById('taxAmount');
const totalAmountEl = document.getElementById('totalAmount');
const checkoutBtn = document.getElementById('checkoutBtn');
const continueShopping = document.getElementById('continueShopping');

// ==================== Auth Nav (Public Site) ====================
function updateAuthNav() {
    const token = localStorage.getItem('tronex_token');
    const elRegister = document.getElementById('authNavRegister');
    const elLogin = document.getElementById('authNavLogin');
    const elLogout = document.getElementById('authNavLogout');

    if (!elRegister || !elLogin || !elLogout) return;

    if (token) {
        elRegister.style.display = 'none';
        elLogin.style.display = 'none';
        elLogout.style.display = 'list-item';
    } else {
        elRegister.style.display = 'list-item';
        elLogin.style.display = 'list-item';
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

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('tronexCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('tronexCart', JSON.stringify(cart));
}

// Run on load
updateAuthNav();

// Open cart sidebar
if (cartIcon && cartSidebar && cartOverlay) {
    cartIcon.addEventListener('click', (e) => {
        e.preventDefault();
        cartSidebar.classList.add('open');
        cartOverlay.classList.add('open');
    });
}

// Close cart sidebar
if (closeCartBtn) {
    closeCartBtn.addEventListener('click', () => {
        closeCart();
    });
}

if (cartOverlay) {
    cartOverlay.addEventListener('click', () => {
        closeCart();
    });
}

function closeCart() {
    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('open');
}

// Continue shopping
if (continueShopping) {
    continueShopping.addEventListener('click', () => {
        closeCart();
    });
}

// Add to cart functionality
function handleAddToCart(button) {
    const price = parseFloat(button.getAttribute('data-price'));
    const name = button.getAttribute('data-name');
    const carCard = button.closest('.car-card');
    const carId = carCard ? carCard.getAttribute('data-car-id') : null;

    if (!carId || Number.isNaN(price) || !name) return;

    const existingItem = cart.find(item => item.id === carId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: carId,
            name: name,
            price: price,
            quantity: 1
        });
    }

    button.classList.add('added');
    button.innerHTML = '<i class="fas fa-check"></i> Added!';
    setTimeout(() => {
        button.classList.remove('added');
        button.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
    }, 2000);

    saveCart();
    updateCartUI();
    cartSidebar.classList.add('open');
    cartOverlay.classList.add('open');
}

function setupCarsGridListeners() {
    const carsGrid = document.getElementById('carsGrid');
    if (!carsGrid) return;

    carsGrid.addEventListener('click', (event) => {
        const addToCartBtn = event.target.closest('.btn-add-to-cart');
        if (addToCartBtn && !addToCartBtn.disabled) {
            event.preventDefault();
            handleAddToCart(addToCartBtn);
            return;
        }

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

// Update cart UI
function updateCartUI() {
    if (!cartItemsContainer || !checkoutBtn || !subtotalEl || !taxAmountEl || !totalAmountEl) return;
    if (cartCount) {
        cartCount.textContent = cart.length;
    }

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-message">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        checkoutBtn.disabled = true;
        subtotalEl.textContent = '$0.00';
        taxAmountEl.textContent = '$0.00';
        totalAmountEl.textContent = '$0.00';
        return;
    }

    checkoutBtn.disabled = false;

    // Render cart items
    cartItemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-image">
                <i class="fas fa-car-side"></i>
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${item.price.toLocaleString()}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="decreaseQuantity(${index})">-</button>
                    <input type="number" class="quantity-input" value="${item.quantity}" readonly>
                    <button class="quantity-btn" onclick="increaseQuantity(${index})">+</button>
                </div>
            </div>
            <button class="remove-from-cart" onclick="removeFromCart(${index})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    subtotalEl.textContent = `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    taxAmountEl.textContent = `$${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalAmountEl.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Increase quantity
function increaseQuantity(index) {
    cart[index].quantity += 1;
    saveCart();
    updateCartUI();
}

// Decrease quantity
function decreaseQuantity(index) {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
    } else {
        removeFromCart(index);
        return;
    }
    saveCart();
    updateCartUI();
}

// Remove from cart
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

// Checkout functionality
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) return;
        
        const cartData = JSON.stringify(cart, null, 2);
        alert(`Proceeding to checkout with ${cart.length} vehicle(s)!\n\nCart Details:\n${cartData}\n\nTotal: ${totalAmountEl.textContent}`);
        // TODO: Redirect to checkout page or process payment
    });
}

// ==================== Search Form ====================
const searchForm = document.getElementById('searchForm');
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const make = document.getElementById('make').value;
        const model = document.getElementById('model').value;
        const year = document.getElementById('year').value;
        
        if (make && model && year) {
            alert(`Searching for: ${year} ${make} ${model}\n\nRedirecting to filtered stock list...`);
            // TODO: Redirect to stock-list page with filters
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
loadCart();
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

        renderVehiclesInStock(result.data);
    } catch (error) {
        console.error('Failed to load vehicles for landing page:', error);
        carsGrid.innerHTML = '<p class="section-subtitle">Unable to load vehicles right now. Please visit the stock list page.</p>';
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

function renderVehiclesInStock(cars) {
    const carsGrid = document.getElementById('carsGrid');
    if (!carsGrid) return;

    const sortedCars = [...cars].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const visibleCars = sortedCars.slice(0, 8);
    if (visibleCars.length === 0) {
        carsGrid.innerHTML = '<p class="section-subtitle">No vehicles available at the moment.</p>';
        return;
    }

    carsGrid.innerHTML = visibleCars.map((car) => {
        const invoiceTotal = getInvoiceTotalFromCosts(car.invoiceCosts);
        const displayPrice = invoiceTotal !== null ? invoiceTotal : toNumericValue(car.price);
        const statusText = car.availability || 'Available';
        const disabled = statusText === 'Sold' ? 'disabled' : '';
        const buttonLabel = statusText === 'Sold' ? 'Sold Out' : 'Add to Cart';
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
                        <button class="btn-add-to-cart" ${disabled} data-price="${displayPrice}" data-name="${safeCarName}">
                            <i class="fas fa-shopping-cart"></i> ${buttonLabel}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}