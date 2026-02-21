const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    carId: {
        type: String,
        unique: true
    },
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
    price: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'Hatchback'],
        default: 'Sedan'
    },
    mileage: {
        type: Number,
        required: true
    },
    transmission: {
        type: String,
        enum: ['Automatic', 'Manual'],
        default: 'Automatic'
    },
    color: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },

    badge: {
        type: String,
        enum: ['Featured', 'New Arrival', 'Hot Deal'],
        default: 'Featured'
    },
    availability: {
        type: String,
        enum: ['Available', 'Reserved', 'Sold'],
        default: 'Available'
    },
    gradientColor: {
        type: String,
        default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Car', carSchema);