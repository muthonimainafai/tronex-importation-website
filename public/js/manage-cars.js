let allCars = [];
let filteredCars = [];
let currentEditId = null;
let carToDelete = null;

// Image upload variables
let uploadedImages = [];
let mainImageUrl = '';

function normalizeLeadingLetter(value, mode = 'upper') {
    const text = String(value ?? '').replace(/^\s+/, '');
    if (!text) return '';
    const first = text.charAt(0);
    const rest = text.slice(1);
    return mode === 'lower' ? first.toLowerCase() + rest : first.toUpperCase() + rest;
}

function normalizeMakeModelInputs() {
    const makeInput = document.getElementById('make');
    const modelInput = document.getElementById('model');
    if (!makeInput || !modelInput) return;

    makeInput.value = normalizeLeadingLetter(makeInput.value, 'upper');
    modelInput.value = normalizeLeadingLetter(modelInput.value, 'lower');
}

// Invoice cost fields (per-car)
const INVOICE_FIELDS = [
    'cif',
    'portCfsCharges',
    'shippingLineDo',
    'radiation',
    'mssLevy',
    'clearingServiceCharge',
    'kgPlate',
    'ntsaSticker',
    'handlingCosts',
    'dutyPayable',
    'discount'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCars();
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

    // Auto-normalize make/model casing in add/edit form
    const makeInput = document.getElementById('make');
    const modelInput = document.getElementById('model');
    if (makeInput) {
        makeInput.addEventListener('input', () => {
            makeInput.value = normalizeLeadingLetter(makeInput.value, 'upper');
        });
        makeInput.addEventListener('blur', () => {
            makeInput.value = normalizeLeadingLetter(makeInput.value, 'upper');
        });
    }
    if (modelInput) {
        modelInput.addEventListener('input', () => {
            modelInput.value = normalizeLeadingLetter(modelInput.value, 'lower');
        });
        modelInput.addEventListener('blur', () => {
            modelInput.value = normalizeLeadingLetter(modelInput.value, 'lower');
        });
    }

    // Close modal when clicking outside
    document.getElementById('carModal').addEventListener('click', (e) => {
        if (e.target.id === 'carModal') closeModals();
    });

    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeModals();
    });

    // Initialize image upload
    initImageUpload();
    
    // Main image select change
    const mainImageSelect = document.getElementById('mainImageSelect');
    if (mainImageSelect) {
        mainImageSelect.addEventListener('change', (e) => {
            mainImageUrl = e.target.value;
            displayImagePreviews();
            saveImageData();
        });
    }

    // Invoice cost live totals
    INVOICE_FIELDS.forEach(f => {
        const el = document.getElementById(`inv_${f}`);
        if (el) el.addEventListener('input', recomputeInvoiceTotals);
    });

    // Generate invoice (from invoiceCosts) + email + show in admin invoice page
    const btnGenerateInvoice = document.getElementById('btnGenerateInvoice');
    if (btnGenerateInvoice) {
        btnGenerateInvoice.addEventListener('click', generateInvoiceAndEmail);
    }
}

function numOrNull(v) {
    if (v === undefined || v === null) return null;
    let s = String(v).trim();
    if (s === '') return null;

    // Allow inputs like "1,000.50" or "KES 1,000" by normalizing.
    // Keep digits, dot, minus sign only.
    s = s.replace(/,/g, '');
    s = s.replace(/[^0-9.\-]/g, '');

    if (s === '' || s === '.' || s === '-' || s === '-.') return null;

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function moneyKES(n) {
    const num = Number(n || 0);
    return `KES ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    return Math.max(0, itemizedTotal + dutyPayable - discount);
}

function recomputeInvoiceTotals() {
    const costs = {};
    INVOICE_FIELDS.forEach(f => {
        const el = document.getElementById(`inv_${f}`);
        costs[f] = el ? numOrNull(el.value) : null;
    });

    const itemizedSum = [
        'cif',
        'portCfsCharges',
        'shippingLineDo',
        'radiation',
        'mssLevy',
        'clearingServiceCharge',
        'kgPlate',
        'ntsaSticker',
        'handlingCosts'
    ].reduce((sum, k) => sum + (Number(costs[k]) || 0), 0);

    const duty = Number(costs.dutyPayable) || 0;
    const discount = Number(costs.discount) || 0;
    const total = Math.max(0, itemizedSum + duty - discount);

    const elNeed = document.getElementById('inv_itemizedNeedTotal');
    const elDuty = document.getElementById('inv_itemizedDutyTaxesTotal');
    const elTotal = document.getElementById('inv_totalCosts');
    if (elNeed) elNeed.value = moneyKES(itemizedSum);
    if (elDuty) elDuty.value = moneyKES(duty);
    if (elTotal) elTotal.value = moneyKES(total);
}

async function generateInvoiceAndEmail() {
    const btnGenerateInvoice = document.getElementById('btnGenerateInvoice');
    if (btnGenerateInvoice) btnGenerateInvoice.disabled = true;

    try {
        if (!currentEditId) {
            showToast('❌ Please save/edit the vehicle first to generate an invoice.', 'error');
            return;
        }

        // Build invoiceCosts payload from the current modal form values
        const invoiceCosts = { currency: 'KES' };
        INVOICE_FIELDS.forEach(f => {
            invoiceCosts[f] = numOrNull(document.getElementById(`inv_${f}`)?.value);
        });

        const expiryDays = 30;
        const payload = { invoiceCosts, expiryDays };

        const res = await fetch(`/api/admin/cars/${encodeURIComponent(currentEditId)}/generate-invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => ({}));
        if (!res.ok || result.success === false) {
            throw new Error(result.message || `Failed to generate invoice (${res.status})`);
        }

        const invoice = result.data?.invoice;
        const email = result.data?.email || {};
        if (email.sent) {
            showToast('✅ Invoice generated and emailed successfully.', 'success');
        } else {
            showToast('⚠️ Invoice created, but email was not sent: ' + (email.error || 'SMTP not configured.'), 'error');
        }

        // Close modal and open invoice builder preloaded with the new invoice
        closeModals();
        if (invoice?._id) {
            window.location.href = `/admin-invoices?invoiceId=${encodeURIComponent(invoice._id)}`;
        }
    } catch (err) {
        console.error('❌ [GENERATE INVOICE ERROR]:', err);
        showToast('❌ ' + (err.message || 'Error generating invoice'), 'error');
    } finally {
        if (btnGenerateInvoice) btnGenerateInvoice.disabled = false;
    }
}


// ==================== IMAGE UPLOAD FUNCTIONS ====================



// Initialize image upload
function initImageUpload() {
    const imageUpload = document.getElementById('imageUpload');
    const uploadWrapper = document.querySelector('.image-upload-wrapper');

    if (!imageUpload || !uploadWrapper) return;

    // Click to upload
    uploadWrapper.addEventListener('click', () => imageUpload.click());

    // File selection
    imageUpload.addEventListener('change', handleImageSelect);

    // Drag and drop
    uploadWrapper.addEventListener('dragover', handleDragOver);
    uploadWrapper.addEventListener('dragleave', handleDragLeave);
    uploadWrapper.addEventListener('drop', handleDrop);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector('.image-upload-wrapper').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector('.image-upload-wrapper').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelector('.image-upload-wrapper').classList.remove('dragover');

    const files = e.dataTransfer.files;
    uploadImages(files);
}

function handleImageSelect(e) {
    const files = e.target.files;
    uploadImages(files);
}

async function uploadImages(files) {
    if (files.length === 0) return;

    console.log('📸 [IMAGE UPLOAD] Starting upload of', files.length, 'files');

    // Check if adding more images exceeds limit
    if (uploadedImages.length + files.length > 10) {
        showToast('❌ Maximum 10 images allowed! Current: ' + uploadedImages.length, 'error');
        return;
    }

    const formData = new FormData();
    
    for (let file of files) {
        formData.append('images', file);
    }

    const progressDiv = document.querySelector('.image-upload-progress');
    const progressFill = document.querySelector('.progress-fill');
    const uploadStatus = document.getElementById('uploadStatus');

    if (progressDiv) {
        progressDiv.classList.add('active');
        progressFill.style.width = '0%';
        uploadStatus.textContent = 'Uploading...';
    }

    try {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && progressFill) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressFill.style.width = percentComplete + '%';
                uploadStatus.textContent = Math.round(percentComplete) + '% uploaded';
            }
        });

        // Upload completion
        xhr.addEventListener('load', async () => {
            if (xhr.status === 200) {
                const result = JSON.parse(xhr.responseText);
                
                if (result.success) {
                    console.log('✅ [UPLOAD SUCCESS]:', result.data);
                    
                    // Add to uploaded images
                    uploadedImages.push(...result.data);
                    
                    // Refresh preview
                    displayImagePreviews();
                    updateMainImageSelect();
                    
                    // Store in hidden field
                    saveImageData();
                    
                    showToast('✅ ' + result.data.length + ' image(s) uploaded successfully!', 'success');
                    uploadStatus.textContent = 'Upload complete!';
                } else {
                    showToast('❌ Upload failed: ' + result.message, 'error');
                    uploadStatus.textContent = 'Upload failed!';
                }
            } else {
                showToast('❌ Upload error: ' + xhr.statusText, 'error');
                uploadStatus.textContent = 'Upload error!';
            }
            
            if (progressDiv) {
                setTimeout(() => {
                    progressDiv.classList.remove('active');
                    progressFill.style.width = '0%';
                }, 2000);
            }
            document.getElementById('imageUpload').value = '';
        });

        xhr.addEventListener('error', () => {
            showToast('❌ Upload error: Network failure', 'error');
            uploadStatus.textContent = 'Network error!';
            if (progressDiv) {
                progressDiv.classList.remove('active');
            }
        });

        xhr.open('POST', '/api/upload/images');
        xhr.send(formData);

    } catch (error) {
        console.error('❌ Upload error:', error);
        showToast('❌ Error uploading images: ' + error.message, 'error');
        if (progressDiv) {
            progressDiv.classList.remove('active');
        }
    }
}

function displayImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    const imageCount = document.getElementById('imageCount');
    
    if (!container) return;

    imageCount.textContent = uploadedImages.length;

    if (uploadedImages.length === 0) {
        container.innerHTML = '<div class="image-preview-empty"><i class="fas fa-images"></i>No images uploaded yet</div>';
        return;
    }

    container.innerHTML = uploadedImages.map((img, index) => `
        <div class="image-preview-item ${img.url === mainImageUrl ? 'main-image' : ''}">
            <img src="${img.url}" alt="Car image ${index + 1}" onerror="this.src='/images/placeholder-car.svg'">
            <div class="image-preview-overlay">
                <div class="image-preview-actions">
                    <button type="button" class="btn-set-main" title="Set as main image" onclick="setMainImage('${img.url}')">
                        <i class="fas fa-star"></i> Main
                    </button>
                    <button type="button" class="btn-delete-image" title="Delete image" onclick="deleteImage('${img.filename}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
            <div class="image-info">${index + 1}/${uploadedImages.length}</div>
        </div>
    `).join('');
}

function setMainImage(imageUrl) {
    mainImageUrl = imageUrl;
    console.log('⭐ [MAIN IMAGE SET]:', imageUrl);
    displayImagePreviews();
    updateMainImageSelect();
    saveImageData();
    showToast('✅ Main image updated!', 'success');
}

function updateMainImageSelect() {
    const select = document.getElementById('mainImageSelect');
    
    if (!select) return;

    select.innerHTML = '<option value="">-- No main image selected --</option>' +
        uploadedImages.map((img, index) => `
            <option value="${img.url}" ${img.url === mainImageUrl ? 'selected' : ''}>
                Image ${index + 1} - ${img.filename}
            </option>
        `).join('');
}

function saveImageData() {
    const imagesInput = document.getElementById('carImages');
    const mainImageInput = document.getElementById('carMainImage');
    
    if (imagesInput) {
        imagesInput.value = JSON.stringify(uploadedImages.map(img => img.url));
    }
    if (mainImageInput) {
        mainImageInput.value = mainImageUrl;
    }
}

async function deleteImage(filename) {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
        console.log('🗑️ [DELETE IMAGE]:', filename);
        
        const response = await fetch(`/api/upload/image/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            // Remove from array
            const deletedImg = uploadedImages.find(img => img.filename === filename);
            uploadedImages = uploadedImages.filter(img => img.filename !== filename);
            
            // Reset main image if deleted
            if (mainImageUrl === deletedImg?.url) {
                mainImageUrl = '';
            }
            
            displayImagePreviews();
            updateMainImageSelect();
            saveImageData();
            
            showToast('✅ Image deleted!', 'success');
            console.log('✅ Image deleted successfully');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ Error deleting image:', error);
        showToast('❌ Error deleting image', 'error');
    }
}

// Load images for edit mode
function loadImagesForEdit(car) {
    console.log('📷 [LOAD IMAGES] Loading images for car:', car._id);
    
    if (car.images && Array.isArray(car.images) && car.images.length > 0) {
        uploadedImages = car.images.map(url => ({
            url: url,
            filename: url.split('/').pop()
        }));
        console.log('✅ Loaded', uploadedImages.length, 'images');
    } else {
        uploadedImages = [];
        console.log('ℹ️  No images found for this car');
    }

    mainImageUrl = car.mainImage || '';
    
    displayImagePreviews();
    updateMainImageSelect();
    saveImageData();
}

// Reset image upload for new car
function resetImageUpload() {
    uploadedImages = [];
    mainImageUrl = '';
    document.getElementById('carImages').value = '';
    document.getElementById('carMainImage').value = '';
    displayImagePreviews();
    updateMainImageSelect();
}
    


// ==================== CAR MANAGEMENT FUNCTIONS ====================

// Load cars from server
async function loadCars() {
    try {
        console.log('📡 [LOAD CARS] Fetching from /api/cars...');
        const response = await fetch('/api/cars');
        const result = await response.json();

        console.log('📥 [RESPONSE]:', result);

        if (result.success) {
            allCars = result.data;
            filteredCars = [...allCars];
            displayCars();
            updateStats();
            
            // ONLY add dummy data if NO cars exist after loading
            if (allCars.length === 0) {
                console.log('📊 No cars found, adding dummy data...');
                await addDummyData();
            }
        }
    } catch (error) {
        console.error('❌ Error loading cars:', error);
        showToast('Error loading cars', 'error');
    }
}

// Add dummy data (only if no cars exist)
async function addDummyData() {
    const dummyCars = [
        {
            make: 'Toyota',
            model: 'Camry Hybrid',
            year: 2024,
            price: 28500,
            type: 'Sedan',
            mileage: 15000,
            transmission: 'Automatic',
            color: 'Silver',
            fuel: 'Hybrid',
            drive: '2WD',
            engineCapacity: '2.5L',
            badge: 'New Arrival',
            availability: 'Available',
            description: 'Premium hybrid sedan with excellent fuel efficiency and modern technology.',
            externalStockNumber: 'TYT-2024-001',
            interiorColor: 'Gray',
            doors: 4,
            seats: 5,
            trunk: '450L',
            registration: 'Registered 2024',
            bodyType: 'Sedan',
            highlights: ['Fuel Efficient', 'Advanced Safety', 'Eco-Friendly'],
            features: ['Air Conditioning', 'Power Steering', 'ABS', 'Electronic Windows', 'Cruise Control']
        },
        {
            make: 'Honda',
            model: 'CR-V SUV',
            year: 2023,
            price: 32000,
            type: 'SUV',
            mileage: 35000,
            transmission: 'Automatic',
            color: 'Black',
            fuel: 'Petrol',
            drive: 'AWD',
            engineCapacity: '1.5L',
            badge: 'Featured',
            availability: 'Available',
            description: 'Spacious SUV perfect for families with great safety features.',
            externalStockNumber: 'HON-2023-001',
            interiorColor: 'Black Leather',
            doors: 4,
            seats: 5,
            trunk: '520L',
            registration: 'Registered 2023',
            bodyType: 'Crossover SUV',
            highlights: ['Spacious', 'Family-Friendly', 'Advanced Safety'],
            features: ['Air Conditioning', 'Power Steering', 'ABS', 'Leather Seats', 'Sunroof']
        },
        {
            make: 'Ford',
            model: 'F-150 Pickup',
            year: 2023,
            price: 38000,
            type: 'Truck',
            mileage: 45000,
            transmission: 'Automatic',
            color: 'Red',
            fuel: 'Diesel',
            drive: '4WD',
            engineCapacity: '3.0L',
            badge: 'Hot Deal',
            availability: 'Reserved',
            description: 'Powerful pickup truck with towing capacity and comfortable cabin.',
            externalStockNumber: 'FRD-2023-001',
            interiorColor: 'Gray',
            doors: 4,
            seats: 5,
            trunk: '1500L',
            registration: 'Registered 2023',
            bodyType: 'Pickup Truck',
            highlights: ['Powerful', 'High Towing Capacity', 'Durable'],
            features: ['Air Conditioning', 'Power Steering', 'ABS', 'Electronic Windows', 'Traction Control']
        },
        {
            make: 'BMW',
            model: '3 Series',
            year: 2022,
            price: 35000,
            type: 'Sedan',
            mileage: 55000,
            transmission: 'Automatic',
            color: 'White',
            fuel: 'Petrol',
            drive: '2WD',
            engineCapacity: '2.0L',
            badge: 'Featured',
            availability: 'Available',
            description: 'Luxury sedan with premium features and smooth performance.',
            externalStockNumber: 'BMW-2022-001',
            interiorColor: 'Beige Leather',
            doors: 4,
            seats: 5,
            trunk: '480L',
            registration: 'Registered 2022',
            bodyType: 'Luxury Sedan',
            highlights: ['Luxury', 'Premium Features', 'Smooth Performance'],
            features: ['Air Conditioning', 'Power Steering', 'ABS', 'Leather Seats', 'Sunroof', 'Navigation System']
        },
        {
            make: 'Mazda',
            model: 'CX-5',
            year: 2024,
            price: 30000,
            type: 'SUV',
            mileage: 12000,
            transmission: 'Automatic',
            color: 'Blue',
            fuel: 'Petrol',
            drive: 'AWD',
            engineCapacity: '2.5L',
            badge: 'New Arrival',
            availability: 'Sold',
            description: 'Modern SUV with agile handling and advanced safety systems.',
            externalStockNumber: 'MZD-2024-001',
            interiorColor: 'Black',
            doors: 4,
            seats: 5,
            trunk: '500L',
            registration: 'Registered 2024',
            bodyType: 'Crossover SUV',
            highlights: ['Modern Design', 'Advanced Safety', 'Agile Handling'],
            features: ['Air Conditioning', 'Power Steering', 'ABS', 'Electronic Windows', 'Stability Control']
        },
        {
            make: 'Nissan',
            model: 'Altima',
            year: 2023,
            price: 26000,
            type: 'Sedan',
            mileage: 28000,
            transmission: 'Automatic',
            color: 'Gray',
            fuel: 'Petrol',
            drive: '2WD',
            engineCapacity: '1.8L',
            badge: 'Featured',
            availability: 'Available',
            description: 'Reliable sedan with smooth ride and good fuel economy.',
            externalStockNumber: 'NIS-2023-001',
            interiorColor: 'Gray',
            doors: 4,
            seats: 5,
            trunk: '420L',
            registration: 'Registered 2023',
            bodyType: 'Mid-Size Sedan',
            highlights: ['Reliable', 'Good Fuel Economy', 'Smooth Ride'],
            features: ['Air Conditioning', 'Power Steering', 'ABS', 'Electronic Windows', 'Cruise Control']
        }
    ];

    for (const car of dummyCars) {
        try {
            console.log('➕ Adding dummy car:', car.make, car.model);
            const response = await fetch('/api/admin/cars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(car)
            });
            const result = await response.json();
            if (result.success) {
                console.log('✅ Dummy car added:', result.data._id);
            } else {
                console.error('❌ Failed to add dummy car:', result.message);
            }
        } catch (error) {
            console.error('❌ Error adding dummy car:', error);
        }
    }

    await loadCars();
    showToast('Sample vehicles loaded', 'success');
}


// Display cars in table
function displayCars() {
    const tbody = document.getElementById('carsTableBody');

    if (filteredCars.length === 0) {
        tbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="10">No vehicles found. Try adjusting your filters or add a new vehicle.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredCars.map(car => {
        const invoiceTotal = getInvoiceTotalFromCosts(car.invoiceCosts);
        const displayPrice = invoiceTotal !== null ? invoiceTotal : toNumericValue(car.price);

        return `
        <tr>
            <td>
                <strong>${car.internalStockNumber || 'N/A'}</strong>
                <br>
                <small style="color: #667eea; font-size: 0.75rem;">(Auto)</small>
            </td>
            <td>
                <strong>${car.externalStockNumber || 'N/A'}</strong>
                <br>
                <small style="color: #764ba2; font-size: 0.75rem;">(Manual)</small>
            </td>
            <td>${car.make}</td>
            <td>${car.model}</td>
            <td>${car.year}</td>
            <td>${formatKsh(displayPrice)}</td>
            <td>${car.fuel || 'N/A'}</td>
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
                    <button class="btn-delete" onclick="openDeleteModal('${car._id}', '${car.make} ${car.model}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}


// Filter cars
function filterCars() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    filteredCars = allCars.filter(car => {
        const carName = `${car.make} ${car.model}`.toLowerCase();
        const internalStock = (car.internalStockNumber || '').toLowerCase();
        const externalStock = (car.externalStockNumber || '').toLowerCase();
        
        const matchesSearch = 
            carName.includes(searchTerm) ||
            car.make.toLowerCase().includes(searchTerm) ||
            car.model.toLowerCase().includes(searchTerm) ||
            internalStock.includes(searchTerm) ||  // ✅ Search by internal stock
            externalStock.includes(searchTerm);     // ✅ Search by external stock

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
    resetImageUpload();
    document.getElementById('modalTitle').textContent = 'Add New Vehicle';
    document.getElementById('carForm').reset();
    document.getElementById('internalStockNumber').value = '';
    document.getElementById('carImages').value = '';
    document.getElementById('carMainImage').value = '';
    // Reset invoice inputs
    INVOICE_FIELDS.forEach(f => {
        const el = document.getElementById(`inv_${f}`);
        if (el) el.value = '';
    });
    recomputeInvoiceTotals();
    document.getElementById('carModal').classList.add('show');
}

// Open edit modal
function openEditModal(carId) {
    const car = allCars.find(c => c._id === carId);
    if (!car) {
        console.error('❌ Car not found:', carId);
        return;
    }

    currentEditId = carId;
    document.getElementById('modalTitle').textContent = 'Edit Vehicle';

    // Fill form with all fields
    document.getElementById('internalStockNumber').value = car.internalStockNumber || '';
    document.getElementById('externalStockNumber').value = car.externalStockNumber || '';
    document.getElementById('make').value = car.make || '';
    document.getElementById('model').value = car.model || '';
    document.getElementById('year').value = car.year || '';
    document.getElementById('price').value = car.price || '';
    document.getElementById('mileage').value = car.mileage || '';
    document.getElementById('type').value = car.type || '';
    document.getElementById('transmission').value = car.transmission || '';
    document.getElementById('color').value = car.color || '';
    document.getElementById('fuel').value = car.fuel || '';
    document.getElementById('drive').value = car.drive || '';
    document.getElementById('engineCapacity').value = car.engineCapacity || '';
    document.getElementById('availability').value = car.availability || '';
    document.getElementById('badge').value = car.badge || '';
    document.getElementById('description').value = car.description || '';
    
    // Additional fields
    document.getElementById('interiorColor').value = car.interiorColor || '';
    document.getElementById('doors').value = car.doors || 4;
    document.getElementById('seats').value = car.seats || 5;
    document.getElementById('trunk').value = car.trunk || '';
    document.getElementById('registration').value = car.registration || '';
    document.getElementById('bodyType').value = car.bodyType || '';
    document.getElementById('highlights').value = (car.highlights || []).join(', ');
    document.getElementById('features').value = (car.features || []).join(', ');

    // Invoice costs
    const inv = car.invoiceCosts || {};
    INVOICE_FIELDS.forEach(f => {
        const el = document.getElementById(`inv_${f}`);
        if (!el) return;
        const v = inv[f];
        el.value = (v === null || v === undefined) ? '' : v;
    });
    recomputeInvoiceTotals();

    // Load images for edit mode
    loadImagesForEdit(car);

    document.getElementById('carModal').classList.add('show');
    normalizeMakeModelInputs();
}

// Save car
async function saveCar(e) {
    e.preventDefault();

    console.log('🔍 [FORM SUBMISSION] Starting form validation...');
    normalizeMakeModelInputs();

    const make = document.getElementById('make').value.trim();
    const model = document.getElementById('model').value.trim();

    // Validate required fields
    if (!make || !model) {
        showToast('❌ Make and Model are required', 'error');
        return;
    }

    const carData = {
        // Stock numbers
        externalStockNumber: document.getElementById('externalStockNumber').value || '',
        
        // Vehicle identification
        make: make,
        model: model,
        year: parseInt(document.getElementById('year').value, 10),
        
        // Pricing & Availability
        price: numOrNull(document.getElementById('price').value),
        availability: document.getElementById('availability').value,
        
        // Physical specs
        type: document.getElementById('type').value,
        bodyType: document.getElementById('bodyType').value || '',
        color: document.getElementById('color').value,
        interiorColor: document.getElementById('interiorColor').value || '',
        doors: parseInt(document.getElementById('doors').value) || 4,
        seats: parseInt(document.getElementById('seats').value) || 5,
        
        // Engine & transmission
        mileage: numOrNull(document.getElementById('mileage').value),
        transmission: document.getElementById('transmission').value,
        fuel: document.getElementById('fuel').value,
        engineCapacity: document.getElementById('engineCapacity').value || '',
        drive: document.getElementById('drive').value,
        
        // Vehicle dimensions
        trunk: document.getElementById('trunk').value || '',
        
        // Registration
        registration: document.getElementById('registration').value || '',
        
        // Description & details
        description: document.getElementById('description').value,
        highlights: document.getElementById('highlights').value
            .split(',')
            .map(h => h.trim())
            .filter(h => h.length > 0),
        
        // Features
        features: document.getElementById('features').value
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0),
        
        // Images
        images: JSON.parse(document.getElementById('carImages').value || '[]'),
        mainImage: document.getElementById('carMainImage').value || '',
        
        // Categorization
        badge: document.getElementById('badge').value,
        
        // Styling
        gradientColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',

        // Invoice costs (KES)
        invoiceCosts: {
            currency: 'KES',
            cif: numOrNull(document.getElementById('inv_cif')?.value),
            portCfsCharges: numOrNull(document.getElementById('inv_portCfsCharges')?.value),
            shippingLineDo: numOrNull(document.getElementById('inv_shippingLineDo')?.value),
            radiation: numOrNull(document.getElementById('inv_radiation')?.value),
            mssLevy: numOrNull(document.getElementById('inv_mssLevy')?.value),
            clearingServiceCharge: numOrNull(document.getElementById('inv_clearingServiceCharge')?.value),
            kgPlate: numOrNull(document.getElementById('inv_kgPlate')?.value),
            ntsaSticker: numOrNull(document.getElementById('inv_ntsaSticker')?.value),
            handlingCosts: numOrNull(document.getElementById('inv_handlingCosts')?.value),
            dutyPayable: numOrNull(document.getElementById('inv_dutyPayable')?.value),
            discount: numOrNull(document.getElementById('inv_discount')?.value)
        }
    };

    console.log('📤 [DATA TO SEND]:', carData);

    try {
        let response;
        if (currentEditId) {
            console.log('🔄 [UPDATE MODE] Editing car:', currentEditId);
            response = await fetch(`/api/admin/cars/${currentEditId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carData)
            });
        } else {
            console.log('➕ [CREATE MODE] Adding new car');
            response = await fetch('/api/admin/cars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carData)
            });
        }

        console.log('📡 [RESPONSE] Status:', response.status, response.statusText);

        // Parse JSON response ONCE
        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('❌ Failed to parse JSON response:', jsonError);
            console.error('❌ Response status:', response.status);
            showToast('❌ Server error: Invalid response', 'error');
            return;
        }

        console.log('📥 [RESULT]:', result);

        if (response.ok && result.success) {
            showToast(currentEditId ? '✅ Car updated successfully!' : '✅ Car added successfully!', 'success');
            closeModals();
            console.log('📡 Reloading cars from database...');
            await loadCars();
        } else {
            showToast('❌ ' + (result.message || 'Error saving car'), 'error');
        }
    } catch (error) {
        console.error('❌ [NETWORK ERROR]:', error);
        showToast('❌ Error saving car: ' + error.message, 'error');
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
        console.log('🗑️ Deleting car:', carToDelete);
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
        console.error('❌ Error deleting car:', error);
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
    uploadedImages = [];
    mainImageUrl = '';
    resetImageUpload();
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