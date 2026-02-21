let allCars = [];
let filteredCars = [];
let selectedMake = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
            displayCars();
            updateResultsCount();
        }
    } catch (error) {
        console.error('Error loading cars:', error);
    }
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
    const makesGrid = document.getElementById('makesGrid');
    const makeCounts = getUniqueMakes();

    makesGrid.innerHTML = Object.keys(makeCounts)
        .sort()
        .map(make => `
            <div class="make-box" onclick="selectMake('${make}')">
                <div class="make-logo">${make.substring(0, 2).toUpperCase()}</div>
                <div class="make-name">${make}</div>
                <div class="make-count">${makeCounts[make]}</div>
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
    document.querySelectorAll('.make-box').forEach(box => {
        box.classList.remove('active');
        if (box.textContent.includes(make) && selectedMake === make) {
            box.classList.add('active');
        }
    });

    performSearch();
}

// Perform search
function performSearch() {
    const make = document.getElementById('make').value;
    const model = document.getElementById('model').value;
    const type = document.getElementById('type').value;
    const yearFrom = parseInt(document.getElementById('yearFrom').value) || 0;

    filteredCars = allCars.filter(car => {
        const matchesMake = !make || car.make === make;
        const matchesModel = !model || car.model.toLowerCase().includes(model.toLowerCase());
        const matchesType = !type || car.type === type;
        const matchesYear = !yearFrom || car.year >= yearFrom;

        return matchesMake && matchesModel && matchesType && matchesYear;
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
        let statusClass = 'available';
        let statusText = '✓ Available';

        if (car.availability === 'Reserved') {
            statusClass = 'reserved';
            statusText = '⏳ Reserved';
        } else if (car.availability === 'Sold') {
            statusClass = 'sold';
            statusText = '✕ Sold';
        }

        return `
            <div class="car-card">
                <div class="car-image-container" style="background: ${car.gradientColor}">
                    <i class="fas fa-car-side"></i>
                    <span class="badge">${car.badge}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="car-details">
                    <h3 class="car-title">${car.name}</h3>
                    <p class="car-make-model">${car.make} ${car.model}</p>
                    <span class="car-price">$${car.price.toLocaleString()}</span>
                    <div class="car-specs-row">
                        <div class="spec-item">
                            <div class="spec-icon"><i class="fas fa-calendar-alt"></i></div>
                            <div class="spec-label">Year</div>
                            <div class="spec-value">${car.year}</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-icon"><i class="fas fa-tachometer-alt"></i></div>
                            <div class="spec-label">Mileage</div>
                            <div class="spec-value">${(car.mileage / 1000).toFixed(0)}k km</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-icon"><i class="fas fa-gas-pump"></i></div>
                            <div class="spec-label">Trans</div>
                            <div class="spec-value">${car.transmission}</div>
                        </div>
                    </div>
                    <p class="car-desc">${car.description}</p>
                    <button class="btn-view-details" onclick="openCarModal('${car._id}')">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Open car modal
function openCarModal(carId) {
    const car = allCars.find(c => c._id === carId);
    if (!car) return;

    let statusClass = 'available';
    let statusText = '✓ Available';

    if (car.availability === 'Reserved') {
        statusClass = 'reserved';
        statusText = '⏳ Reserved';
    } else if (car.availability === 'Sold') {
        statusClass = 'sold';
        statusText = '✕ Sold';
    }

    document.getElementById('carImagePlaceholder').style.background = car.gradientColor;
    document.getElementById('carBadge').textContent = car.badge;
    document.getElementById('carStatus').className = `status-badge ${statusClass}`;
    document.getElementById('carStatus').textContent = statusText;

    document.getElementById('modalCarName').textContent = car.name;
    document.getElementById('modalCarSubtitle').textContent = `${car.make} ${car.model} • ${car.type}`;
    document.getElementById('modalCarPrice').textContent = `$${car.price.toLocaleString()}`;

    document.getElementById('modalYear').textContent = car.year;
    document.getElementById('modalMileage').textContent = `${car.mileage.toLocaleString()} km`;
    document.getElementById('modalTransmission').textContent = car.transmission;
    document.getElementById('modalColor').textContent = car.color;
    document.getElementById('modalType').textContent = car.type;
    document.getElementById('modalAvailability').textContent = car.availability;
    document.getElementById('modalStatusText').textContent = statusText;
    document.getElementById('modalDescription').textContent = car.description;

    document.getElementById('carModal').classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('carModal').classList.remove('show');
}

// Update results count
function updateResultsCount() {
    document.getElementById('resultCount').textContent = filteredCars.length;
    document.getElementById('totalCount').textContent = allCars.length;
}

// Reset all filters
function resetAllFilters() {
    document.getElementById('searchForm').reset();
    selectedMake = null;
    document.querySelectorAll('.make-box').forEach(box => {
        box.classList.remove('active');
    });
    filteredCars = [...allCars];
    applySorting();
}