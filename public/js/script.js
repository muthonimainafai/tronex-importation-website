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

// Open cart sidebar
cartIcon.addEventListener('click', (e) => {
    e.preventDefault();
    cartSidebar.classList.add('open');
    cartOverlay.classList.add('open');
});

// Close cart sidebar
closeCartBtn.addEventListener('click', () => {
    closeCart();
});

cartOverlay.addEventListener('click', () => {
    closeCart();
});

function closeCart() {
    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('open');
}

// Continue shopping
continueShopping.addEventListener('click', () => {
    closeCart();
});

// Add to cart functionality
document.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const price = parseFloat(this.getAttribute('data-price'));
        const name = this.getAttribute('data-name');
        const carCard = this.closest('.car-card');
        const carId = carCard.getAttribute('data-car-id');

        // Check if item already in cart
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

        // Visual feedback
        this.classList.add('added');
        this.innerHTML = '<i class="fas fa-check"></i> Added!';
        setTimeout(() => {
            this.classList.remove('added');
            this.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
        }, 2000);

        saveCart();
        updateCartUI();
        
        // Show cart sidebar briefly
        cartSidebar.classList.add('open');
        cartOverlay.classList.add('open');
    });
});

// Update cart UI
function updateCartUI() {
    cartCount.textContent = cart.length;

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
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return;
    
    const cartData = JSON.stringify(cart, null, 2);
    alert(`Proceeding to checkout with ${cart.length} vehicle(s)!\n\nCart Details:\n${cartData}\n\nTotal: ${totalAmountEl.textContent}`);
    // TODO: Redirect to checkout page or process payment
});

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

// ==================== View Details ====================
document.querySelectorAll('.btn-details').forEach(btn => {
    btn.addEventListener('click', function() {
        const carCard = this.closest('.car-card');
        const carName = carCard.querySelector('.car-details h3').textContent;
        alert(`Viewing details for: ${carName}\n\nThis will be a full details page on the Stock List section.`);
        // TODO: Redirect to stock-list page with car details
    });
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
console.log('✅ Tronex Car Importers - Landing Page Loaded Successfully!');
// Add this function to display cars with availability
function displayFeaturedCars(cars) {
    const carsGrid = document.querySelector('.cars-grid');
    
    carsGrid.innerHTML = cars.map(car => {
        let availabilityClass = 'status-available';
        let availabilityText = '✓ Available';
        let buyDisabled = '';
        
        if (car.availability === 'Reserved') {
            availabilityClass = 'status-reserved';
            availabilityText = '⏳ Reserved';
            buyDisabled = 'disabled';
        } else if (car.availability === 'Sold') {
            availabilityClass = 'status-sold';
            availabilityText = '✕ Sold';
            buyDisabled = 'disabled';
        }

        return `
            <div class="car-card">
                <div class="car-image">
                    <div class="car-placeholder" style="background: ${car.gradientColor};">
                        <i class="fas fa-car-side"></i>
                    </div>
                    <span class="car-badge-featured">${car.badge}</span>
                    <span class="availability-badge ${availabilityClass}">${availabilityText}</span>
                    <span class="car-price">$${car.price.toLocaleString()}</span>
                </div>
                <div class="car-details">
                    <h3>${car.name}</h3>
                    <p class="car-subtitle">${car.type} • ${car.color}</p>
                    <div class="car-specs">
                        <div class="spec">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${car.year}</span>
                        </div>
                        <div class="spec">
                            <i class="fas fa-tachometer-alt"></i>
                            <span>${car.mileage.toLocaleString()} km</span>
                        </div>
                        <div class="spec">
                            <i class="fas fa-gas-pump"></i>
                            <span>${car.transmission}</span>
                        </div>
                    </div>
                    <div class="car-description">
                        ${car.description}
                    </div>
                    <div class="car-actions">
                        <button class="btn-details">View Details</button>
                        <button class="btn-add-to-cart" ${buyDisabled} onclick="addToCart('${car.name}', ${car.price})">
                            <i class="fas fa-shopping-cart"></i> ${car.availability === 'Sold' ? 'Sold Out' : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}