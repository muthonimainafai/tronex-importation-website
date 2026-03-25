const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    // Link to Car & Customer
    carId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car',
        required: [true, 'Car ID is required']
    },
    
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Will be filled when customer views/downloads invoice
    },

    // Invoice Identification (Auto-generated)
    invoiceNumber: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    
    dateIssued: {
        type: Date,
        default: Date.now
    },

    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },

    // Car Details (Snapshot from Car model)
    // Use Mixed to avoid schema/version mismatches causing "cast to string" errors.
    carDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Customer Details (Will be filled from User model when logged in)
    customerDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Invoice Line Items (Admin fills these)
    invoiceItems: [
        {
            description: {
                type: String,
                required: [true, 'Item description is required']
            },
            cost: {
                type: Number,
                required: [true, 'Cost is required'],
                default: 0
            },
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                auto: true
            }
        }
    ],

    // Totals (Calculated automatically)
    subtotal: {
        type: Number,
        default: 0
    },

    totalCost: {
        type: Number,
        default: 0
    },

    // Payment Details (Admin fills these)
    bankDetails: {
        bankName: {
            type: String,
            default: ''
        },
        accountName: {
            type: String,
            default: ''
        },
        accountNumber: {
            type: String,
            default: ''
        },
        branchCode: {
            type: String,
            default: ''
        },
        branch: {
            type: String,
            default: ''
        },
        swiftCode: {
            type: String,
            default: ''
        }
    },

    mpesaDetails: {
        paybillNumber: {
            type: String,
            default: ''
        },
        accountName: {
            type: String,
            default: ''
        }
    },

    // Terms & Conditions
    claimClause: {
        type: String,
        default: '(a) Online car store ltd will take NO liability for any money not deposited in the above A/c or Mpesa pay bill number shown above.\n(b) Our vehicles import quotation/proforma invoice may have some figures variation from what it dictates and the final payment due to dollar changes but its 99.8% accurate & NO refund claims will be accepted.\n(c) Online car store ltd takes NO liability for any new government policies introduced during the importation & clearing process e.g. duty increment or reduction etc.'
    },

    notes: {
        type: String,
        default: ''
    },

    // Invoice Status
    status: {
        type: String,
        enum: ['Draft', 'Issued', 'Paid', 'Overdue', 'Cancelled'],
        default: 'Draft'
    },

    // Who created/updated the invoice
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Admin user
        required: [true, 'Creator ID is required']
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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

// Generate required fields before validation runs
invoiceSchema.pre('validate', async function() {
    if (!this.invoiceNumber) {
        const count = await mongoose.model('Invoice').countDocuments();
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const day = String(new Date().getDate()).padStart(2, '0');
        this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
        console.log('✅ [INVOICE NUMBER] Generated:', this.invoiceNumber);
    }
});

// Pre-save middleware to calculate totals
invoiceSchema.pre('save', async function() {
    // Calculate subtotal and total
    this.subtotal = this.invoiceItems.reduce((sum, item) => sum + (item.cost || 0), 0);
    this.totalCost = this.subtotal + (this.carDetails?.price || 0);

    console.log('✅ [INVOICE TOTALS] Subtotal:', this.subtotal, 'Total:', this.totalCost);

    this.updatedAt = new Date();
});

// Index for faster queries
invoiceSchema.index({ carId: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ status: 1 });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);