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
    },

    // ============================================
    // CUSTOMER PROFILE (used to auto-fill invoices)
    // ============================================
    profile: {
        passportUrl: { type: String, default: '' }, // compulsory for profile completion
        companyName: { type: String, default: '', trim: true },
        legalName: { type: String, default: '', trim: true }, // name as per National ID
        idNumber: { type: String, default: '', trim: true }, // National ID/Passport no
        postalAddress: { type: String, default: '', trim: true },
        deliveryDetails: { type: String, default: '', trim: true }
    },

    // ============================================
    // CUSTOMER UPLOADS
    // ============================================
    uploads: {
        bankSlips: [
            {
                url: { type: String, required: true },
                uploadedAt: { type: Date, default: Date.now }
            }
        ], // minimum 3 uploads (enforced in UI/validation where needed)
        consigneeDocUrl: { type: String, default: '' }, // ID/Passport/COI/BR cert
        pinDocUrl: { type: String, default: '' } // KRA PIN doc
    },

    // ============================================
    // ACCOUNT DETAILS TABLE (8 columns)
    // ============================================
    accountDetails: [
        {
            carStockNo: { type: String, default: '', trim: true },
            priceSoldKsh: { type: Number, default: 0 },
            receiveDate: { type: Date, default: null },
            firstPayment: { type: Number, default: 0 },
            secondPayment: { type: Number, default: 0 },
            thirdPayment: { type: Number, default: 0 },
            discountApplied: { type: Number, default: 0 },
            balance: { type: Number, default: 0 },
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
        }
    ]
});

userSchema.pre('save', async function() {
    // Only hash if password is modified
    if (!this.isModified('password')) {
        console.log('⏭️  [PASSWORD HASH] Password not modified, skipping hash');
        return;
    }

    console.log('🔐 [PASSWORD HASH] Hashing password for user:', this.email);
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('✅ [PASSWORD HASH] Password hashed successfully');
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
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);