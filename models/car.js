const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    // MongoDB will auto-create _id as ObjectId
    
    // Stock Numbers (these are NOT the _id)
    internalStockNumber: {
        type: String,
        unique: true,
        required: [true, 'Internal stock number is required'],
        trim: true
    },

    externalStockNumber: {
        type: String,
        trim: true,
        default: ''
    },

    // Vehicle Identification
    make: {
        type: String,
        required: [true, 'Make is required'],
        trim: true
    },

    model: {
        type: String,
        required: [true, 'Model is required'],
        trim: true
    },

    year: {
        type: Number,
        required: [true, 'Year is required']
    },

    // Pricing & Availability
    price: {
        type: Number,
        required: [true, 'Price is required']
    },

    availability: {
        type: String,
        enum: ['Available', 'Reserved', 'Sold'],
        default: 'Available'
    },

    // Physical Specifications
    type: {
        type: String,
        required: [true, 'Type is required']
    },

    bodyType: {
        type: String,
        default: ''
    },

    color: {
        type: String,
        required: [true, 'Color is required']
    },

    interiorColor: {
        type: String,
        default: ''
    },

    doors: {
        type: Number,
        default: 4
    },

    seats: {
        type: Number,
        default: 5
    },

    // Engine & Transmission
    mileage: {
        type: Number,
        required: [true, 'Mileage is required']
    },

    transmission: {
        type: String,
        required: [true, 'Transmission is required']
    },

    fuel: {
        type: String,
        required: [true, 'Fuel type is required']
    },

    drive: {
        type: String,
        default: ''
    },

    engineCapacity: {
        type: String,
        default: ''
    },

    trunk: {
        type: String,
        default: ''
    },

    registration: {
        type: String,
        default: ''
    },

    // Description & Details
    description: {
        type: String,
        default: ''
    },

    highlights: [String],
    features: [String],

    // Images
    mainImage: {
        type: String,
        default: ''
    },

    images: [String],

    // Categorization
    badge: {
        type: String,
        default: ''
    },

    gradientColor: {
        type: String,
        default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    },

    // ==================== INVOICE (PER-CAR) ====================
    // Admin fills the individual "Cost" values in Manage Cars.
    // Descriptions remain fixed in the UI; totals are computed at render-time.
    invoiceCosts: {
        currency: { type: String, default: 'KES', trim: true },
        // Itemized Need Analysis costs
        cif: { type: Number, default: null },
        portCfsCharges: { type: Number, default: null },
        shippingLineDo: { type: Number, default: null },
        radiation: { type: Number, default: null },
        mssLevy: { type: Number, default: null },
        clearingServiceCharge: { type: Number, default: null },
        kgPlate: { type: Number, default: null },
        ntsaSticker: { type: Number, default: null },
        handlingCosts: { type: Number, default: null },

        // Duty / taxes
        dutyPayable: { type: Number, default: null },

        // Discount (optional)
        discount: { type: Number, default: null }
    }
});

// Add computed field for car name
carSchema.virtual('name').get(function() {
    return `${this.make} ${this.model}`;
});

// Ensure virtuals are included in JSON
carSchema.set('toJSON', { virtuals: true });

// Index for faster queries
carSchema.index({ make: 1 });
carSchema.index({ model: 1 });
carSchema.index({ availability: 1 });
carSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Car || mongoose.model('Car', carSchema);
