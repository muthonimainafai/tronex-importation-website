const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Personal Information
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },

    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },

    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },

    mobileNumber: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true
    },

    // Address Information
    address: {
        type: String,
        trim: true,
        default: ''
    },

    city: {
        type: String,
        trim: true,
        default: ''
    },

    country: {
        type: String,
        trim: true,
        default: ''
    },

    postalCode: {
        type: String,
        trim: true,
        default: ''
    },

    // Authentication
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password by default
    },

    // Role & Status
    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },

    isActive: {
        type: Boolean,
        default: true
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

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Only hash if password is modified
    if (!this.isModified('password')) return next();
    
    try {
        console.log('🔐 [PASSWORD HASH] Hashing password for user:', this.email);
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('�� [PASSWORD HASH] Password hashed successfully');
        next();
    } catch (error) {
        console.error('❌ [PASSWORD HASH ERROR]:', error);
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(enteredPassword) {
    try {
        return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
        console.error('❌ [PASSWORD COMPARE ERROR]:', error);
        throw error;
    }
};

// Method to get user without password
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);