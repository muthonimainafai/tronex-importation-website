// Image upload management
let uploadedImages = [];
let mainImageUrl = '';

// Initialize image upload
function initImageUpload() {
    const imageUpload = document.getElementById('imageUpload');
    const uploadWrapper = document.querySelector('.image-upload-wrapper');

    if (!imageUpload) return;

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

    const formData = new FormData();
    
    for (let file of files) {
        formData.append('images', file);
    }

    const progressDiv = document.querySelector('.image-upload-progress');
    const progressFill = document.querySelector('.progress-fill');

    progressDiv.classList.add('active');
    progressFill.style.width = '0%';

    try {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressFill.style.width = percentComplete + '%';
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
                    
                    showToast('✅ Images uploaded successfully!', 'success');
                } else {
                    showToast('❌ Upload failed: ' + result.message, 'error');
                }
            } else {
                showToast('❌ Upload error: ' + xhr.statusText, 'error');
            }
            
            progressDiv.classList.remove('active');
            progressFill.style.width = '0%';
            document.getElementById('imageUpload').value = '';
        });

        xhr.addEventListener('error', () => {
            showToast('❌ Upload error: Network failure', 'error');
            progressDiv.classList.remove('active');
        });

        xhr.open('POST', '/api/upload/images');
        xhr.send(formData);

    } catch (error) {
        console.error('❌ Upload error:', error);
        showToast('❌ Error uploading images: ' + error.message, 'error');
        progressDiv.classList.remove('active');
    }
}

function displayImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    
    if (uploadedImages.length === 0) {
        container.innerHTML = '<div class="image-preview-empty">No images uploaded yet</div>';
        return;
    }

    container.innerHTML = uploadedImages.map(img => `
        <div class="image-preview-item ${img.url === mainImageUrl ? 'main-image' : ''}">
            <img src="${img.url}" alt="Car image">
            <div class="image-preview-actions">
                <button class="btn-set-main" onclick="setMainImage('${img.url}')">
                    <i class="fas fa-star"></i> Main
                </button>
                <button class="btn-delete-image" onclick="deleteImage('${img.filename}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
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
    
    select.innerHTML = '<option value="">-- No main image selected --</option>' +
        uploadedImages.map(img => `
            <option value="${img.url}" ${img.url === mainImageUrl ? 'selected' : ''}>
                ${img.filename}
            </option>
        `).join('');
}

function saveImageData() {
    document.getElementById('carImages').value = JSON.stringify(uploadedImages.map(img => img.url));
    document.getElementById('carMainImage').value = mainImageUrl;
}

async function deleteImage(filename) {
    if (!confirm('Delete this image?')) return;

    try {
        console.log('🗑️ [DELETE IMAGE]:', filename);
        
        const response = await fetch(`/api/upload/image/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            // Remove from array
            uploadedImages = uploadedImages.filter(img => img.filename !== filename);
            
            // Reset main image if deleted
            if (mainImageUrl === uploadedImages.find(img => img.filename === filename)?.url) {
                mainImageUrl = '';
            }
            
            displayImagePreviews();
            updateMainImageSelect();
            saveImageData();
            
            showToast('✅ Image deleted!', 'success');
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
    if (car.images && car.images.length > 0) {
        uploadedImages = car.images.map(url => ({
            url: url,
            filename: url.split('/').pop()
        }));
        mainImageUrl = car.mainImage || '';
        
        displayImagePreviews();
        updateMainImageSelect();
        saveImageData();
    }
}