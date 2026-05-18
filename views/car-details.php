<?php
$resolvedDisplayPrice = (function () {
    $fromDisplay = (float) ($car['displayPriceKsh'] ?? 0);
    if ($fromDisplay > 0) {
        return $fromDisplay;
    }
    $fromInvoice = (float) ($invoice['totalCosts'] ?? 0);
    if ($fromInvoice > 0) {
        return $fromInvoice;
    }
    $fromCarPrice = (float) ($car['price'] ?? 0);
    return $fromCarPrice > 0 ? $fromCarPrice : 0;
})();
$availClass = strtolower($car['availability'] ?? 'available');
$carTitle = ($car['make'] ?? '') . ' ' . ($car['model'] ?? '');
$mainImg = $car['mainImage'] ?? '';
if ($mainImg === '' && !empty($car['images'][0])) {
    $mainImg = $car['images'][0];
}
if ($mainImg === '') {
    $mainImg = '/images/placeholder-car.svg';
}
$imageCount = is_array($car['images'] ?? null) ? count($car['images']) : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($carTitle) ?> - Tronex Car Importers</title>
    <link rel="stylesheet" href="/css/car-details.css">
    <link rel="stylesheet" href="/css/invoice.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <!-- TRONEX_PUBLIC_NAV -->
    <!-- Main Container -->
    <main class="car-details-container">
        <!-- Back Button -->
        <div class="breadcrumb">
            <a href="/stock-list"><i class="fas fa-arrow-left"></i> Back to Stock List</a>
        </div>

        <!-- Image Gallery Section -->
        <section class="gallery-section">
            <div class="gallery-container">
                <!-- Main Image -->
                <div class="main-image-wrapper">
                    <img id="mainImage" src="<?= e($mainImg) ?>" alt="<?= e($carTitle) ?>" class="main-image" onerror="this.src='/images/placeholder-car.svg'">
                    
                    <!-- Image Navigation -->
                    <?php if ($imageCount > 1): ?>
                        <button class="image-nav-btn prev-btn" onclick="previousImage()" aria-label="Previous image" title="Previous image">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="image-nav-btn next-btn" onclick="nextImage()" aria-label="Next image" title="Next image">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <div class="image-counter">
                            <span id="currentImageIndex">1</span> / <span id="totalImages"><?= e($imageCount) ?></span>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- Thumbnail Strip -->
                <?php if ($imageCount > 1): ?>
                    <div class="thumbnail-strip">
                        <?php foreach (($car['images'] ?? []) as $index => $image): ?>
                            <div class="thumbnail-item <?= $index === 0 ? 'active' : '' ?>" data-index="<?= (int) $index ?>" onclick="selectImage(+this.dataset.index)">
                                <img src="<?= e($image) ?>" alt="<?= e($carTitle) ?> image <?= (int) $index + 1 ?>" loading="lazy" onerror="this.src='/images/placeholder-car.svg'">
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Quick Info Panel -->
            <div class="quick-info-panel">
                <div class="price-badge">
                    <span class="label">Price</span>
                    <span class="price">KSH <?= e(number_format($resolvedDisplayPrice)) ?></span>
                </div>

                <div class="availability-badge">
                    <span class="label">Status</span>
                    <span class="availability status-<?= e($availClass) ?>">
                        <i class="fas fa-check-circle"></i> <?= e($car['availability']) ?>
                    </span>
                </div>

                <button class="btn-inquire" onclick="inquireAboutCar()">
                    <i class="fas fa-envelope"></i> Inquire About This Car
                </button>
            </div>
        </section>

        <!-- Car Details Section -->
        <section class="car-details-section">
            <div class="details-grid">
                <!-- Left Column - Overview -->
                <div class="details-column left-column">
                    <!-- Title & Basic Info -->
                    <div class="detail-card overview-card">
                        <h1 class="car-title"><?= e($carTitle) ?></h1>
                        <p class="car-tagline"><?= e($car['description']) ?></p>

                        <div class="basic-specs">
                            <div class="spec-item">
                                <span class="spec-icon"><i class="fas fa-calendar"></i></span>
                                <div class="spec-info">
                                    <span class="spec-label">Year</span>
                                    <span class="spec-value"><?= e($car['year']) ?></span>
                                </div>
                            </div>

                            <div class="spec-item">
                                <span class="spec-icon"><i class="fas fa-odometer"></i></span>
                                <div class="spec-info">
                                    <span class="spec-label">Mileage</span>
                                    <span class="spec-value"><?= e(number_format((int) $car['mileage'])) ?> km</span>
                                </div>
                            </div>

                            <div class="spec-item">
                                <span class="spec-icon"><i class="fas fa-cube"></i></span>
                                <div class="spec-info">
                                    <span class="spec-label">Type</span>
                                    <span class="spec-value"><?= e($car['type']) ?></span>
                                </div>
                            </div>

                            <div class="spec-item">
                                <span class="spec-icon"><i class="fas fa-bolt"></i></span>
                                <div class="spec-info">
                                    <span class="spec-label">Fuel Type</span>
                                    <span class="spec-value"><?= e($car['fuel']) ?></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Purchase CTA (Left side) -->
                    <div class="detail-card" style="border-left:none;background:transparent;padding:0">
                        <div style="margin-top:12px">
                            <button type="button" class="btn-inquire btn-buy-now" style="width:100%" onclick="buyNow('<?= e($car['_id']) ?>')">
                                <i class="fas fa-credit-card"></i> Buy Now
                            </button>
                        </div>
                    </div>

                    <!-- Highlights -->
                    <?php if (!empty($car['highlights'])): ?>
                        <div class="detail-card highlights-card">
                            <h2 class="card-title">
                                <i class="fas fa-star"></i> Highlights
                            </h2>
                            <ul class="highlights-list">
                                <?php foreach (($car['highlights'] ?? []) as $highlight): ?>
                                    <li><i class="fas fa-check"></i> <?= e($highlight) ?></li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    <?php endif; ?>

                    <!-- Features -->
                    <?php if (!empty($car['features'])): ?>
                        <div class="detail-card features-card">
                            <h2 class="card-title">
                                <i class="fas fa-cogs"></i> Features & Equipment
                            </h2>
                            <div class="features-grid">
                                <?php foreach (($car['features'] ?? []) as $feature): ?>
                                    <div class="feature-item">
                                        <i class="fas fa-check-circle"></i>
                                        <span><?= e($feature) ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- Right Column - Specifications -->
                <div class="details-column right-column">
                    <!-- Vehicle Specifications -->
                    <div class="detail-card specs-card">
                        <h2 class="card-title">
                            <i class="fas fa-info-circle"></i> Vehicle Specifications
                        </h2>

                        <div class="specs-list">
                            <div class="spec-row">
                                <span class="spec-name">Make</span>
                                <span class="spec-val"><?= e($car['make']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Model</span>
                                <span class="spec-val"><?= e($car['model']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Year</span>
                                <span class="spec-val"><?= e($car['year']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">StockID</span>
                                <span class="spec-val"><?= e($car['internalStockNumber'] ?? 'N/A') ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Mileage</span>
                                <span class="spec-val"><?= e(number_format((int) $car['mileage'])) ?> km</span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Body Type</span>
                                <span class="spec-val"><?= e($car['bodyType'] ?? 'N/A') ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Type</span>
                                <span class="spec-val"><?= e($car['type']) ?></span>
                            </div>

                            <div class="spec-row">
                                <span class="spec-name">Exterior Color</span>
                                <span class="spec-val"><?= e($car['color']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Interior Color</span>
                                <span class="spec-val"><?= e($car['interiorColor'] ?? 'N/A') ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Doors</span>
                                <span class="spec-val"><?= e($car['doors'] ?? 'N/A') ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Seats</span>
                                <span class="spec-val"><?= e($car['seats'] ?? 'N/A') ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Trunk Capacity</span>
                                <span class="spec-val"><?= e($car['trunk'] ?? 'N/A') ?></span>
                            </div>

                            <div class="spec-row">
                                <span class="spec-name">Fuel Type</span>
                                <span class="spec-val"><?= e($car['fuel']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Engine Capacity</span>
                                <span class="spec-val"><?= e($car['engineCapacity'] ?? 'N/A') ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Transmission</span>
                                <span class="spec-val"><?= e($car['transmission']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Drive Type</span>
                                <span class="spec-val"><?= e($car['drive']) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Registration</span>
                                <span class="spec-val"><?= e($car['registration'] ?? 'N/A') ?></span>
                            </div>

                            <div class="spec-row">
                                <span class="spec-name">Price</span>
                                <span class="spec-val price-val">KSH <?= e(number_format($resolvedDisplayPrice)) ?></span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-name">Availability</span>
                                <span class="spec-val">
                                    <span class="status-badge status-<?= e($availClass) ?>">
                                        <?= e($car['availability']) ?>
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Call to Action -->
        <section class="cta-section">
            <div class="cta-content">
                <h2>Interested in this vehicle?</h2>
                <p>Get in touch with us for more information, pricing, or to arrange a viewing.</p>
                <div class="cta-buttons">
                    <button class="btn-primary" onclick="inquireAboutCar()">
                        <i class="fas fa-envelope"></i> Send Inquiry
                    </button>
                    <button class="btn-secondary" onclick="callUs()">
                        <i class="fas fa-phone"></i> Call Us
                    </button>
                </div>
            </div>
        </section>

        <!-- Inquiry Modal -->
        <div id="inquiryModal" class="modal">
            <div class="modal-content">
                <button class="modal-close" onclick="closeInquiryModal()">&times;</button>
                <h2>Inquire About This Vehicle</h2>
                
                <form id="inquiryForm" onsubmit="submitInquiry(event)">
                    <input type="hidden" id="carId" value="<?= e($car['_id']) ?>">
                    <input type="hidden" id="carName" value="<?= e($carTitle) ?>">

                    <div class="form-group">
                        <label for="name">Full Name *</label>
                        <input type="text" id="name" name="name" required placeholder="Your full name">
                    </div>

                    <div class="form-group">
                        <label for="email">Email Address *</label>
                        <input type="email" id="email" name="email" required placeholder="your@email.com">
                    </div>

                    <div class="form-group">
                        <label for="phone">Phone Number *</label>
                        <input type="tel" id="phone" name="phone" required placeholder="+1 (555) 000-0000">
                    </div>

                    <div class="form-group">
                        <label for="message">Message</label>
                        <textarea id="message" name="message" rows="5" placeholder="Tell us more about your interest..."></textarea>
                    </div>

                    <button type="submit" class="btn-submit">Send Inquiry</button>
                </form>
            </div>
        </div>

        <!-- Toast Notification -->
        <div id="toast" class="toast"></div>
    </main>

    <!-- Footer -->
    <footer class="footer">
        <div class="footer-content">
            <p>&copy; 2024 Tronex Car Importers. All rights reserved.</p>
            <div class="footer-links">
                <a href="/">Home</a>
                <a href="/about-us">About Us</a>
                <a href="/stock-list">Stock List</a>
            </div>
        </div>
    </footer>

    <script src="/js/car-details.js?v=20260325"></script>
</body>
</html>