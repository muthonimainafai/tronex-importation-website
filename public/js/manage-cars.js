let allCars = [];
let filteredCars = [];
let currentEditId = null;
let carToDelete = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCars();
    setupEventListeners();
    addDummyData();
});

// Setup event listeners
function setupEventListeners() {
    // Add new car button
    document.getElementById('addNewBtn').addEventListener('click', openAddModal);

    // Form submit
    document.getElementById('carForm').addEventListener('submit', saveCar);

    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    document.getElementById('cancelBtn').addEventListener('click', closeModals);

    // Delete modal buttons
    document.querySelector('.btn-delete-confirm').addEventListener('click', confirmDelete);
    document.querySelector('.btn-cancel-delete').addEventListener('click', closeModals);

    // Search and filter
    document.getElementById('searchInput').addEventListener('keyup', filterCars);
    document.getElementById('statusFilter').addEventListener('change', filterCars);

    // Close modal when clicking outside
    document.getElementById('carModal').addEventListener('click', (e) => {
        if (e.target.id === 'carModal') closeModals();
    });

    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeModals();
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
            displayCars();
            updateStats();
        }
    } catch (error) {
        console.error('Error loading cars:', error);
        showToast('Error loading cars', 'error');
    }
}

// Add dummy data (only if no cars exist)
async function addDummyData() {
    if (allCars.length === 0) {
        const dummyCars = [
            {
                name: 'Toyota Camry Hybrid',
                make: 'Toyota',
                model: 'Camry',
                year: 2024,
                price: 28500,
                type: 'Sedan',
                mileage: 15000,
                transmission: 'Automatic',
                color: 'Silver',
                badge: 'New Arrival',
                availability: 'Available',
                description: 'Premium hybrid sedan with excellent fuel efficiency and modern technology.'
            },
            {
                name: 'Honda CR-V SUV',
                make: 'Honda',
                model: 'CR-V',
                year: 2023,
                price: 32000,
                type: 'SUV',
                mileage: 35000,
                transmission: 'Automatic',
                color: 'Black',
                badge: 'Featured',
                availability: 'Available',
                description: 'Spacious SUV perfect for families with great safety features.'
            },
            {
                name: 'Ford F-150 Pickup',
                make: 'Ford',
                model: 'F-150',
                year: 2023,
                price: 38000,
                type: 'Truck',
                mileage: 45000,
                transmission: 'Automatic',
                color: 'Red',
                badge: 'Hot Deal',
                availability: 'Reserved',
                description: 'Powerful pickup truck with towing capacity and comfortable cabin.'
            },
            {
                name: 'BMW 3 Series',
                make: 'BMW',
                model: '3 Series',
                year: 2022,
                price: 35000,
                type: 'Sedan',
                mileage: 55000,
                transmission: 'Automatic',
                color: 'White',
                badge: 'Featured',
                availability: 'Available',
                description: 'Luxury sedan with premium features and smooth performance.'
            },
            {
                name: 'Mazda CX-5',
                make: 'Mazda',
                model: 'CX-5',
                year: 2024,
                price: 30000,
                type: 'SUV',
                mileage: 12000,
                transmission: 'Automatic',
                color: 'Blue',
                badge: 'New Arrival',
                availability: 'Sold',
                description: 'Modern SUV with agile handling and advanced safety systems.'
            },
            {
                name: 'Nissan Altima',
                make: 'Nissan',
                model: 'Altima',
                year: 2023,
                price: 26000,
                type: 'Sedan',
                mileage: 28000,
                transmission: 'Automatic',
                color: 'Gray',
                badge: 'Featured',
                availability: 'Available',
                description: 'Reliable sedan with smooth ride and good fuel economy.'
            }
        ];

        for (const car of dummyCars) {
            try {
                await fetch('/api/admin/cars', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(car)
                });
            } catch (error) {
                console.error('Error adding dummy car:', error);
            }
        }

        await loadCars();
        showToast('Sample vehicles loaded', 'success');
    }
}

// Display cars in table
function displayCars() {
    const tbody = document.getElementById('carsTableBody');

    if (filteredCars.length === 0) {
        tbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="8">No vehicles found. Try adjusting your filters or add a new vehicle.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredCars.map(car => `
        <tr>
            <td><strong>${car.name}</strong></td>
            <td>${car.make} ${car.model}</td>
            <td>${car.year}</td>
            <td>$${car.price.toLocaleString()}</td>
            <td>${car.mileage.toLocaleString()} km</td>
            <td>
                <span class="status-badge status-${car.availability.toLowerCase()}">
                    ${car.availability}
                </span>
            </td>
            <td>
                <span class="badge-featured">${car.badge}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="openEditModal('${car._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="openDeleteModal('${car._id}', '${car.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter cars
function filterCars() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    filteredCars = allCars.filter(car => {
        const matchesSearch = 
            car.name.toLowerCase().includes(searchTerm) ||
            car.make.toLowerCase().includes(searchTerm) ||
            car.model.toLowerCase().includes(searchTerm);

        const matchesStatus = statusFilter === '' || car.availability === statusFilter;

        return matchesSearch && matchesStatus;
    });

    displayCars();
}

// Update stats
function updateStats() {
    document.getElementById('totalCars').textContent = allCars.length;
    document.getElementById('availableCars').textContent = allCars.filter(c => c.availability === 'Available').length;
    document.getElementById('reservedCars').textContent = allCars.filter(c => c.availability === 'Reserved').length;
    document.getElementById('soldCars').textContent = allCars.filter(c => c.availability === 'Sold').length;
}

// Open add modal
function openAddModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Add New Vehicle';
    document.getElementById('carForm').reset();
    document.getElementById('carModal').classList.add('show');
}

// Open edit modal
function openEditModal(carId) {
    const car = allCars.find(c => c._id === carId);
    if (!car) return;

    currentEditId = carId;
    document.getElementById('modalTitle').textContent = 'Edit Vehicle';

    // Fill form
    document.getElementById('name').value = car.name;
    document.getElementById('make').value = car.make;
    document.getElementById('model').value = car.model;
    document.getElementById('year').value = car.year;
    document.getElementById('price').value = car.price;
    document.getElementById('mileage').value = car.mileage;
    document.getElementById('type').value = car.type;
    document.getElementById('transmission').value = car.transmission;
    document.getElementById('color').value = car.color;
    document.getElementById('availability').value = car.availability;
    document.getElementById('badge').value = car.badge;
    document.getElementById('description').value = car.description;

    document.getElementById('carModal').classList.add('show');
}

// Save car
async function saveCar(e) {
    e.preventDefault();

    const carData = {
        name: document.getElementById('name').value,
        make: document.getElementById('make').value,
        model: document.getElementById('model').value,
        year: parseInt(document.getElementById('year').value),
        price: parseFloat(document.getElementById('price').value),
        mileage: parseInt(document.getElementById('mileage').value),
        type: document.getElementById('type').value,
        transmission: document.getElementById('transmission').value,
        color: document.getElementById('color').value,
        availability: document.getElementById('availability').value,
        badge: document.getElementById('badge').value,
        description: document.getElementById('description').value,
        gradientColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    };

    try {
        let response;
        if (currentEditId) {
            response = await fetch(`/api/admin/cars/${currentEditId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carData)
            });
        } else {
            response = await fetch('/api/admin/cars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carData)
            });
        }

        const result = await response.json();

        if (result.success) {
            showToast(currentEditId ? '✅ Car updated successfully!' : '✅ Car added successfully!', 'success');
            closeModals();
            await loadCars();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error saving car:', error);
        showToast('❌ Error saving car', 'error');
    }
}

// Open delete modal
function openDeleteModal(carId, carName) {
    carToDelete = carId;
    document.getElementById('deleteModal').classList.add('show');
}

// Confirm delete
async function confirmDelete() {
    if (!carToDelete) return;

    try {
        const response = await fetch(`/api/admin/cars/${carToDelete}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('✅ Car deleted successfully!', 'success');
            closeModals();
            await loadCars();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting car:', error);
        showToast('❌ Error deleting car', 'error');
    }
}

// Close modals
function closeModals() {
    document.getElementById('carModal').classList.remove('show');
    document.getElementById('deleteModal').classList.remove('show');
    document.getElementById('carForm').reset();
    currentEditId = null;
    carToDelete = null;
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}