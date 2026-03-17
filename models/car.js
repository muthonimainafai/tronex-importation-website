const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    carId: {
        type: String,
        unique: true
    },
    
    // Stock Numbers
    internalStockNumber: {
        type: String,
        unique: true,
        required: true
    },
    externalStockNumber: {
        type: String,
        default: ''
    },
    
    // Basic Info (Auto-generated name from make & model)
    name: {
        type: String,
        required: true
    },
    make: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    
    // Pricing & Availability
    price: {
        type: Number,
        required: true
    },
    availability: {
        type: String,
        enum: ['Available', 'Reserved', 'Sold'],
        default: 'Available'
    },
    
    // Physical Specs
    type: {
        type: String,
        enum: ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'Hatchback'],
        default: 'Sedan'
    },
    bodyType: {
        type: String,
        default: ''
    },
    color: {
        type: String,
        required: true
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
        required: true
    },
    transmission: {
        type: String,
        enum: ['Automatic', 'Manual'],
        default: 'Automatic'
    },
    fuel: {
        type: String,
        enum: ['Petrol', 'Diesel', 'Hybrid', 'Electric'],
        default: 'Petrol'
    },
    engineCapacity: {
        type: String,
        default: ''
    },
    drive: {
        type: String,
        enum: ['2WD', '4WD', 'AWD'],
        default: '2WD'
    },
    
    // Vehicle Dimensions
    trunk: {
        type: String,
        default: ''
    },
    
    // Registration
    registration: {
        type: String,
        default: ''
    },
    
    // Description & Details
    description: {
        type: String,
        required: true
    },
    highlights: {
        type: [String],
        default: []
    },
    
    // Features Array
    features: {
        type: [String],
        default: []
    },
    
    // Images
    images: {
        type: [String],
        default: []
    },
    mainImage: {
        type: String,
        default: ''
    },
    
    // Categorization
    badge: {
        type: String,
        enum: ['Featured', 'New Arrival', 'Hot Deal'],
        default: 'Featured'
    },
    
    // Styling
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
    }
});

module.exports = mongoose.models.Car || mongoose.model('Car', carSchema);