let allCars = [];
let filteredCars = [];
let selectedMake = null;

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

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') {
        return fallback;
    }
    return text;
}

function toNumericValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? '').replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatKsh(value) {
    return `KSH ${toNumericValue(value).toLocaleString()}`;
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
    const total = Math.max(0, itemizedTotal + dutyPayable - discount);
    return total;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateAuthNav();
    loadCars();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search form
    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    // Sort
    document.getElementById('sortBy').addEventListener('change', applySorting);

    // Reset buttons
    document.querySelectorAll('.btn-reset-search').forEach(btn => {
        btn.addEventListener('click', resetAllFilters);
    });

    // Modal close
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById('carModal').addEventListener('click', (e) => {
        if (e.target.id === 'carModal') closeModal();
    });
}

// Load cars from server
async function loadCars() {
    try {
        const response = await fetch('/api/cars');
        const result = await response.json();

        if (result.success) {
            allCars = result.data;
            filteredCars = [...allCars];
            populateYears();
            populateMakes();
            populateMakesDropdown();
            displayCars();
            updateResultsCount();
        }
    } catch (error) {
        console.error('Error loading cars:', error);
    }
}

//populate makes dropdown in search bar
function populateMakesDropdown() {
    const makeSelect = document.getElementById('make');
    const makeCounts = getUniqueMakes();

    // Clear existing options except the first one
    while (makeSelect.options.length > 1) {
        makeSelect.remove(1);
    }

    // Add each make as an option
    Object.keys(makeCounts)
        .sort()
        .forEach(make => {
            const option = document.createElement('option');
            option.value = make;
            option.textContent = `${make} (${makeCounts[make]})`;
            makeSelect.appendChild(option);
        });
}

// Populate years dropdown
function populateYears() {
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('yearFrom');
    
    for (let year = currentYear; year >= 2019; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Get unique makes with counts
function getUniqueMakes() {
    const makeCounts = {};
    allCars.forEach(car => {
        makeCounts[car.make] = (makeCounts[car.make] || 0) + 1;
    });
    return makeCounts;
}

// Populate makes in sidebar
function populateMakes() {
    const makesList = document.getElementById('makesList');
    const makeCounts = getUniqueMakes();

    makesList.innerHTML = Object.keys(makeCounts)
        .sort()
        .map(make => `
            <div class="make-item" onclick="selectMake('${make}')">
                <div class="make-logo-container">
                    <div class="make-logo-placeholder">
                        ${make.substring(0, 2).toUpperCase()}
                    </div>
                </div>
                <div class="make-info">
                    <div class="make-name">${make}</div>
                    <div class="make-count">${makeCounts[make]} cars</div>
                </div>
            </div>
        `)
        .join('');
}

// Select make from sidebar
function selectMake(make) {
    if (selectedMake === make) {
        selectedMake = null;
        document.getElementById('make').value = '';
    } else {
        selectedMake = make;
        document.getElementById('make').value = make;
    }

    // Update active state
    document.querySelectorAll('.make-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent.includes(make) && selectedMake === make) {
            item.classList.add('active');
        }
    });

    performSearch();
}

// Perform search
function performSearch() {
    const make = document.getElementById('make').value;
    const model = document.getElementById('model').value;
    const yearFrom = parseInt(document.getElementById('yearFrom').value) || 0;

    filteredCars = allCars.filter(car => {
        const matchesMake = !make || car.make === make;
        const matchesModel = !model || car.model.toLowerCase().includes(model.toLowerCase());
        const matchesYear = !yearFrom || car.year >= yearFrom;

        return matchesMake && matchesModel && matchesYear;
    });

    applySorting();
}

// Apply sorting
function applySorting() {
    const sortBy = document.getElementById('sortBy').value;

    switch (sortBy) {
        case 'price-low':
            filteredCars.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredCars.sort((a, b) => b.price - a.price);
            break;
        case 'name':
            filteredCars.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'newest':
        default:
            filteredCars.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    displayCars();
    updateResultsCount();
}

// Display cars
function displayCars() {
    const carsGrid = document.getElementById('carsGrid');
    const noResults = document.getElementById('noResults');

    if (filteredCars.length === 0) {
        carsGrid.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }

    carsGrid.style.display = 'grid';
    noResults.style.display = 'none';

    carsGrid.innerHTML = filteredCars.map(car => {
        const carName = sanitizeText(
            car.name,
            [sanitizeText(car.make), sanitizeText(car.model)].filter(Boolean).join(' ') || 'Unnamed Vehicle'
        );
        const invoiceTotal = getInvoiceTotalFromCosts(car.invoiceCosts);
        const displayPrice = invoiceTotal !== null ? invoiceTotal : toNumericValue(car.price);
        const stockId = sanitizeText(car.internalStockNumber, 'N/A');
        const mileage = toNumericValue(car.mileage);
        const transmission = sanitizeText(car.transmission, 'N/A');
        const description = sanitizeText(car.description, 'No description available');

        let statusClass = 'available';
        let statusText = '✓ Available';

        if (car.availability === 'Reserved') {
            statusClass = 'reserved';
            statusText = '⏳ Reserved';
        } else if (car.availability === 'Sold') {
            statusClass = 'sold';
            statusText = '✕ Sold';
        }

        const thumbSrc = car.mainImage || (Array.isArray(car.images) && car.images[0]) || '';
        const safeThumb = String(thumbSrc).replace(/"/g, '&quot;');

        return `
            <div class="car-card">
                <div class="car-image-container" style="background: ${car.gradientColor}">
                    ${thumbSrc
                        ? `<img src="${safeThumb}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/images/placeholder-car.svg'">`
                        : '<i class="fas fa-car-side"></i>'}
                    <span class="badge">${car.badge}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="car-details">
                    <h3 class="car-title">${carName}</h3>
                    <p class="car-make-model"><strong>StockID:</strong> ${stockId}</p>
                    <span class="car-price">${formatKsh(displayPrice)}</span>
                    <div class="car-specs-row">
                        <div class="spec-item">
                            <div class="spec-icon"><i class="fas fa-calendar-alt"></i></div>
                            <div class="spec-label">Year</div>
                            <div class="spec-value">${sanitizeText(car.year, 'N/A')}</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-icon"><i class="fas fa-tachometer-alt"></i></div>
                            <div class="spec-label">Mileage</div>
                            <div class="spec-value">${(mileage / 1000).toFixed(0)}k km</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-icon"><i class="fas fa-gas-pump"></i></div>
                            <div class="spec-label">Trans</div>
                            <div class="spec-value">${transmission}</div>
                        </div>
                    </div>
                    <p class="car-desc">${description}</p>
                    <div class="car-actions">
                        <button class="btn-view-details" onclick="viewCarDetails('${car._id}')">
                            <i class="fas fa-eye"></i> View Full Details
                        </button>
                        <button class="btn-inquire" onclick="openCarModal('${car._id}')">
                            <i class="fas fa-envelope"></i> Quick View
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Store current car ID for modal operations
let currentModalCarId = null;

// Open car modal
function openCarModal(carId) {
    const car = allCars.find(c => c._id === carId);
    if (!car) return;

    currentModalCarId = carId;

    let statusClass = 'available';
    let statusText = '✓ Available';

    if (car.availability === 'Reserved') {
        statusClass = 'reserved';
        statusText = '⏳ Reserved';
    } else if (car.availability === 'Sold') {
        statusClass = 'sold';
        statusText = '✕ Sold';
    }

    // Set image
    const modalImage = document.getElementById('modalCarImage');
    if (modalImage) {
        modalImage.src = car.mainImage || car.images?.[0] || '';
        modalImage.style.display = 'block';
        modalImage.onerror = function() {
            this.style.display = 'none';
            document.getElementById('carImagePlaceholder').style.background = car.gradientColor;
        };
    }

    document.getElementById('carImagePlaceholder').style.background = car.gradientColor;
    document.getElementById('carBadge').textContent = car.badge || 'Featured';
    document.getElementById('carStatus').className = `status-badge ${statusClass}`;
    document.getElementById('carStatus').textContent = statusText;

    const modalName = sanitizeText(
        car.name,
        [sanitizeText(car.make), sanitizeText(car.model)].filter(Boolean).join(' ') || 'Unnamed Vehicle'
    );
    const modalMakeModel = [sanitizeText(car.make), sanitizeText(car.model)].filter(Boolean).join(' ');
    const modalType = sanitizeText(car.type);
    const subtitleParts = [modalMakeModel, modalType].filter(Boolean);

    document.getElementById('modalCarName').textContent = modalName;
    document.getElementById('modalCarSubtitle').textContent = subtitleParts.length ? subtitleParts.join(' • ') : 'Vehicle details';
    const modalInvoiceTotal = getInvoiceTotalFromCosts(car.invoiceCosts);
    const modalDisplayPrice = modalInvoiceTotal !== null ? modalInvoiceTotal : toNumericValue(car.price);
    document.getElementById('modalCarPrice').textContent = formatKsh(modalDisplayPrice);

    document.getElementById('modalYear').textContent = car.year;
    document.getElementById('modalMileage').textContent = `${car.mileage.toLocaleString()} km`;
    document.getElementById('modalTransmission').textContent = car.transmission || 'N/A';
    document.getElementById('modalStockId').textContent = car.internalStockNumber || 'N/A';
    
    document.getElementById('modalType').textContent = car.type || 'N/A';
    document.getElementById('modalBodyType').textContent = car.bodyType || 'N/A';
    document.getElementById('modalColor').textContent = car.color || 'N/A';
    document.getElementById('modalInteriorColor').textContent = car.interiorColor || 'N/A';
    document.getElementById('modalTransmissionSpec').textContent = car.transmission || 'N/A';
    document.getElementById('modalFuel').textContent = car.fuel || 'N/A';
    document.getElementById('modalDrive').textContent = car.drive || 'N/A';
    document.getElementById('modalEngineCapacity').textContent = car.engineCapacity || 'N/A';
    document.getElementById('modalDoors').textContent = car.doors || 'N/A';
    document.getElementById('modalSeats').textContent = car.seats || 'N/A';
    document.getElementById('modalAvailability').textContent = car.availability;
    document.getElementById('modalStatusText').textContent = statusText;
    document.getElementById('modalStatusText').className = `status-label ${statusClass}`;
    document.getElementById('modalDescription').textContent = car.description || 'No description available';

    document.getElementById('carModal').classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

// Close modal
function closeModal() {
    document.getElementById('carModal').classList.remove('show');
    document.body.style.overflow = 'auto'; // Re-enable background scroll
}

// View full car details
function openFullDetails() {
    if (currentModalCarId) {
        closeModal();
        viewCarDetails(currentModalCarId);
    }
}

// View car details in full page
function viewCarDetails(carId) {
    console.log('👁️ Viewing car details:', carId);
    window.location.href = `/car/${carId}`;
}

// Close modal when pressing Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
    




// Update results count
function updateResultsCount() {
    document.getElementById('resultCount').textContent = filteredCars.length;
    document.getElementById('totalCount').textContent = allCars.length;
}

// Reset all filters
function resetAllFilters() {
    document.getElementById('searchForm').reset();
    selectedMake = null;
    document.querySelectorAll('.make-item').forEach(item => {
        item.classList.remove('active');
    });
    filteredCars = [...allCars];
    applySorting();
}