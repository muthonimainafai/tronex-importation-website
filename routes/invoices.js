const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Car = require('../models/Car');
const User = require('../models/User');
const authRoutes = require('./auth');
const authenticateToken = authRoutes.authenticateToken;

// ============================================
// CREATE INVOICE - Admin creates invoice for a car
// ============================================
router.post('/api/admin/invoices', authenticateToken, async (req, res) => {
    try {
        console.log('📋 [CREATE INVOICE] Creating invoice by admin:', req.user.id);
        
        const { carId, invoiceItems, bankDetails, mpesaDetails, expiryDate, claimClause } = req.body;

        // Validate required fields
        if (!carId) {
            console.warn('⚠️ [CREATE INVOICE] Car ID missing');
            return res.status(400).json({ 
                success: false, 
                message: 'Car ID is required' 
            });
        }

        if (!expiryDate) {
            console.warn('⚠️ [CREATE INVOICE] Expiry date missing');
            return res.status(400).json({ 
                success: false, 
                message: 'Expiry date is required' 
            });
        }

        // Get car details
        const car = await Car.findById(carId);
        if (!car) {
            console.error('❌ [CREATE INVOICE] Car not found:', carId);
            return res.status(404).json({ 
                success: false, 
                message: 'Car not found' 
            });
        }

        console.log('✅ [CREATE INVOICE] Car found:', car.name);

        // Create invoice
        const invoice = new Invoice({
            carId,
            carDetails: {
                make: car.make,
                model: car.model,
                year: car.year,
                internalStockNumber: car.internalStockNumber,
                externalStockNumber: car.externalStockNumber,
                price: car.price,
                type: car.type,
                bodyType: car.bodyType,
                color: car.color,
                interiorColor: car.interiorColor,
                transmission: car.transmission,
                fuel: car.fuel,
                drive: car.drive,
                engineCapacity: car.engineCapacity,
                mileage: car.mileage,
                doors: car.doors,
                seats: car.seats,
                trunk: car.trunk,
                registration: car.registration,
                description: car.description,
                _id: car._id
            },
            invoiceItems: invoiceItems || [],
            bankDetails: bankDetails || {},
            mpesaDetails: mpesaDetails || {},
            expiryDate: new Date(expiryDate),
            claimClause: claimClause || invoice.schema.path('claimClause').defaultValue,
            createdBy: req.user.id,
            status: 'Draft'
        });

        await invoice.save();
        console.log('✅ [CREATE INVOICE] Invoice created:', invoice.invoiceNumber);

        res.json({ 
            success: true, 
            message: 'Invoice created successfully',
            data: invoice 
        });
    } catch (error) {
        console.error('❌ [CREATE INVOICE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating invoice: ' + error.message 
        });
    }
});

// ============================================
// GET INVOICE BY CAR ID - Get invoice for a specific car
// ============================================
router.get('/api/invoices/car/:carId', async (req, res) => {
    try {
        console.log('🔍 [GET INVOICE] Fetching invoice for car:', req.params.carId);
        
        const invoice = await Invoice.findOne({ carId: req.params.carId })
            .populate('carId')
            .populate('customerId')
            .populate('createdBy', 'firstName lastName email');
        
        if (!invoice) {
            console.warn('⚠️ [GET INVOICE] Invoice not found for car:', req.params.carId);
            return res.status(404).json({ 
                success: false, 
                message: 'Invoice not found for this car' 
            });
        }

        console.log('✅ [GET INVOICE] Invoice found:', invoice.invoiceNumber);

        res.json({ 
            success: true, 
            data: invoice 
        });
    } catch (error) {
        console.error('❌ [GET INVOICE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching invoice: ' + error.message 
        });
    }
});

// ============================================
// UPDATE INVOICE - Admin updates invoice details
// ============================================
router.put('/api/admin/invoices/:invoiceId', authenticateToken, async (req, res) => {
    try {
        console.log('✏️ [UPDATE INVOICE] Updating invoice:', req.params.invoiceId);
        
        const { invoiceItems, bankDetails, mpesaDetails, expiryDate, claimClause, status, notes } = req.body;

        const invoice = await Invoice.findById(req.params.invoiceId);
        if (!invoice) {
            console.error('❌ [UPDATE INVOICE] Invoice not found:', req.params.invoiceId);
            return res.status(404).json({ 
                success: false, 
                message: 'Invoice not found' 
            });
        }

        // Update fields
        if (invoiceItems !== undefined) {
            invoice.invoiceItems = invoiceItems;
            console.log('📝 [UPDATE INVOICE] Items updated:', invoiceItems.length);
        }
        if (bankDetails !== undefined) {
            invoice.bankDetails = bankDetails;
            console.log('🏦 [UPDATE INVOICE] Bank details updated');
        }
        if (mpesaDetails !== undefined) {
            invoice.mpesaDetails = mpesaDetails;
            console.log('📱 [UPDATE INVOICE] M-Pesa details updated');
        }
        if (expiryDate) {
            invoice.expiryDate = new Date(expiryDate);
            console.log('📅 [UPDATE INVOICE] Expiry date updated:', expiryDate);
        }
        if (claimClause !== undefined) {
            invoice.claimClause = claimClause;
            console.log('📄 [UPDATE INVOICE] Claim clause updated');
        }
        if (status) {
            invoice.status = status;
            console.log('🔄 [UPDATE INVOICE] Status updated:', status);
        }
        if (notes !== undefined) {
            invoice.notes = notes;
        }

        invoice.updatedBy = req.user.id;

        await invoice.save();
        console.log('✅ [UPDATE INVOICE] Invoice updated successfully');

        res.json({ 
            success: true, 
            message: 'Invoice updated successfully',
            data: invoice 
        });
    } catch (error) {
        console.error('❌ [UPDATE INVOICE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating invoice: ' + error.message 
        });
    }
});

// ============================================
// GET ALL INVOICES - Admin gets all invoices
// ============================================
router.get('/api/admin/invoices', authenticateToken, async (req, res) => {
    try {
        console.log('📊 [GET ALL INVOICES] Fetching all invoices');
        
        const invoices = await Invoice.find()
            .populate('carId')
            .populate('customerId')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        console.log('✅ [GET ALL INVOICES] Retrieved', invoices.length, 'invoices');

        res.json({ 
            success: true, 
            count: invoices.length,
            data: invoices 
        });
    } catch (error) {
        console.error('❌ [GET ALL INVOICES ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching invoices: ' + error.message 
        });
    }
});

// ============================================
// GET INVOICE BY ID - Get specific invoice
// ============================================
router.get('/api/invoices/:invoiceId', async (req, res) => {
    try {
        console.log('🔍 [GET INVOICE] Fetching invoice:', req.params.invoiceId);
        
        const invoice = await Invoice.findById(req.params.invoiceId)
            .populate('carId')
            .populate('customerId')
            .populate('createdBy', 'firstName lastName email');

        if (!invoice) {
            console.warn('⚠️ [GET INVOICE] Invoice not found:', req.params.invoiceId);
            return res.status(404).json({ 
                success: false, 
                message: 'Invoice not found' 
            });
        }

        console.log('✅ [GET INVOICE] Invoice retrieved:', invoice.invoiceNumber);

        res.json({ 
            success: true, 
            data: invoice 
        });
    } catch (error) {
        console.error('❌ [GET INVOICE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching invoice: ' + error.message 
        });
    }
});

// ============================================
// LINK CUSTOMER TO INVOICE - Customer downloads invoice
// ============================================
router.put('/api/invoices/:invoiceId/link-customer', authenticateToken, async (req, res) => {
    try {
        console.log('🔗 [LINK CUSTOMER] Linking customer to invoice:', req.params.invoiceId);
        
        const invoice = await Invoice.findById(req.params.invoiceId);
        if (!invoice) {
            console.error('❌ [LINK CUSTOMER] Invoice not found:', req.params.invoiceId);
            return res.status(404).json({ 
                success: false, 
                message: 'Invoice not found' 
            });
        }

        // Get customer details
        const customer = await User.findById(req.user.id);
        if (!customer) {
            console.error('❌ [LINK CUSTOMER] Customer not found:', req.user.id);
            return res.status(404).json({ 
                success: false, 
                message: 'Customer not found' 
            });
        }

        // Update invoice with customer details
        invoice.customerId = customer._id;
        invoice.customerDetails = {
            customerId: customer._id.toString(),
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            mobileNumber: customer.mobileNumber,
            address: customer.address,
            city: customer.city,
            country: customer.country,
            postalCode: customer.postalCode
        };

        await invoice.save();
        console.log('✅ [LINK CUSTOMER] Customer linked to invoice');

        res.json({ 
            success: true, 
            message: 'Customer linked to invoice successfully',
            data: invoice 
        });
    } catch (error) {
        console.error('❌ [LINK CUSTOMER ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error linking customer: ' + error.message 
        });
    }
});

// ============================================
// DELETE INVOICE - Admin deletes draft invoice
// ============================================
router.delete('/api/admin/invoices/:invoiceId', authenticateToken, async (req, res) => {
    try {
        console.log('🗑️ [DELETE INVOICE] Deleting invoice:', req.params.invoiceId);
        
        const invoice = await Invoice.findById(req.params.invoiceId);
        if (!invoice) {
            console.error('❌ [DELETE INVOICE] Invoice not found:', req.params.invoiceId);
            return res.status(404).json({ 
                success: false, 
                message: 'Invoice not found' 
            });
        }

        // Only allow deleting draft invoices
        if (invoice.status !== 'Draft') {
            console.warn('⚠️ [DELETE INVOICE] Cannot delete non-draft invoice');
            return res.status(400).json({ 
                success: false, 
                message: 'Only draft invoices can be deleted' 
            });
        }

        await Invoice.findByIdAndDelete(req.params.invoiceId);
        console.log('✅ [DELETE INVOICE] Invoice deleted successfully');

        res.json({ 
            success: true, 
            message: 'Invoice deleted successfully' 
        });
    } catch (error) {
        console.error('❌ [DELETE INVOICE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting invoice: ' + error.message 
        });
    }
});

module.exports = router;