// Car images
let carImages = [];
let currentImageIndex = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get car images from DOM
    const totalImagesSpan = document.getElementById('totalImages');
    if (totalImagesSpan) {
        const imageCount = parseInt(totalImagesSpan.textContent);
        // Images are already in the HTML, just set up the variables
        const images = Array.from(document.querySelectorAll('.thumbnail-item img')).map(img => img.src);
        carImages = images.length > 0 ? images : [document.getElementById('mainImage').src];
    }

    console.log('🖼️ Car details page loaded');
    console.log('📷 Total images:', carImages.length);
});

// Navigate to previous image
function previousImage() {
    if (carImages.length <= 1) return;
    
    currentImageIndex = (currentImageIndex - 1 + carImages.length) % carImages.length;
    updateMainImage();
}

// Navigate to next image
function nextImage() {
    if (carImages.length <= 1) return;
    
    currentImageIndex = (currentImageIndex + 1) % carImages.length;
    updateMainImage();
}

// Select specific image by index
function selectImage(index) {
    currentImageIndex = index;
    updateMainImage();
}

// Update main image and thumbnails
function updateMainImage() {
    const mainImage = document.getElementById('mainImage');
    const currentImageIndexEl = document.getElementById('currentImageIndex');
    
    if (carImages[currentImageIndex]) {
        mainImage.src = carImages[currentImageIndex];
    }
    
    if (currentImageIndexEl) {
        currentImageIndexEl.textContent = currentImageIndex + 1;
    }

    // Update active thumbnail
    document.querySelectorAll('.thumbnail-item').forEach((item, index) => {
        item.classList.toggle('active', index === currentImageIndex);
    });
}

// Inquire about car
function inquireAboutCar() {
    const modal = document.getElementById('inquiryModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// Close inquiry modal
function closeInquiryModal() {
    const modal = document.getElementById('inquiryModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Submit inquiry form
async function submitInquiry(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const message = document.getElementById('message').value;
    const carId = document.getElementById('carId').value;
    const carName = document.getElementById('carName').value;

    console.log('📧 [INQUIRY] Submitting inquiry for:', carName);

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                email: email,
                phone: phone,
                message: `Inquiry about: ${carName}\n\nMessage: ${message}`
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('✅ Inquiry sent successfully! We will contact you soon.', 'success');
            closeInquiryModal();
            document.getElementById('inquiryForm').reset();
            console.log('✅ Inquiry sent successfully');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ Error submitting inquiry:', error);
        showToast('❌ Error sending inquiry: ' + error.message, 'error');
    }
}

// Call us function
function callUs() {
    // Replace with your actual phone number
    window.location.href = 'tel:+1234567890';
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('inquiryModal');
    if (modal && e.target === modal) {
        closeInquiryModal();
    }
});