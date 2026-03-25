const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Car = require('../models/car');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const authRoutes = require('./auth');
const authenticateToken = authRoutes.authenticateToken;

async function resolveCarByAnyId(carId) {
    if (!carId) return null;

    // If it's a valid ObjectId, try direct lookup first
    if (mongoose.isValidObjectId(carId)) {
        const byId = await Car.findById(carId);
        if (byId) return byId;
    }

    // Otherwise try common string identifiers (works even if field isn't in schema but exists in Mongo)
    return await Car.findOne({
        $or: [
            { internalStockNumber: carId },
            { externalStockNumber: carId },
            { carId: carId } // legacy field used by older docs / clients
        ]
    });
}

async function resolveInvoiceByAnyId(invoiceId) {
    if (!invoiceId) return null;

    if (mongoose.isValidObjectId(invoiceId)) {
        const byId = await Invoice.findById(invoiceId);
        if (byId) return byId;
    }

    return await Invoice.findOne({ invoiceNumber: invoiceId });
}

function formatCurrency(value) {
    const num = Number(value || 0);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString();
}

function moneyKES(n) {
    const num = Number(n || 0);
    return `KES ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildPerCarInvoice(carDoc) {
    const car = carDoc?.toObject ? carDoc.toObject() : (carDoc || {});
    const costs = car.invoiceCosts || {};
    const toNum = (v) => {
        if (v === null || v === undefined || v === '') return 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const items = [
        { label: 'Cost insurance and Freight (CIF)', value: toNum(costs.cif) },
        { label: 'Port/Cfs Charges', value: toNum(costs.portCfsCharges) },
        { label: 'Shipping line/D.O', value: toNum(costs.shippingLineDo) },
        { label: 'Radiation', value: toNum(costs.radiation) },
        { label: 'MSS Levy', value: toNum(costs.mssLevy) },
        { label: 'Clearing service Charge', value: toNum(costs.clearingServiceCharge) },
        { label: 'KG Plate (cic ins. comp.insured)', value: toNum(costs.kgPlate) },
        { label: 'NTSA Sticker', value: toNum(costs.ntsaSticker) },
        { label: 'Handling Costs', value: toNum(costs.handlingCosts) }
    ];
    const itemizedNeedTotal = items.reduce((s, i) => s + i.value, 0);
    const dutyPayable = toNum(costs.dutyPayable);
    const discount = toNum(costs.discount);
    const totalCosts = Math.max(0, itemizedNeedTotal + dutyPayable - discount);

    return {
        currency: costs.currency || 'KES',
        items,
        itemizedNeedTotal,
        dutyPayable,
        itemizedDutyTaxesTotal: dutyPayable,
        discount,
        totalCosts,
        bank: {
            bankName: 'Bank of Africa Kenya Ltd.',
            accountName: 'Tronex Car Importers Ltd',
            branchCode: '015',
            branch: 'Changamwe, Mombasa',
            accountNumber: '02482480002',
            swiftCode: 'AFRIKENX',
            paybill: '972900'
        }
    };
}

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
        const car = await resolveCarByAnyId(carId);
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
            carId: car._id,
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
            claimClause,
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
// DOWNLOAD INVOICE PDF - Admin/Customer downloads invoice as PDF
// ============================================
router.get('/api/invoices/:invoiceId/pdf', authenticateToken, async (req, res) => {
    try {
        const resolved = await resolveInvoiceByAnyId(req.params.invoiceId);
        if (!resolved) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const invoice = await Invoice.findById(resolved._id).populate('carId').populate('customerId');
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filename = `${invoice.invoiceNumber || invoice._id}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).text('TRONEX LTD', { align: 'left' });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('#444').text('Car Importation Invoice', { align: 'left' });
        doc.fillColor('#000');
        doc.moveDown(0.8);

        // Invoice metadata
        doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber || '—'}`);
        doc.text(`Date Issued: ${new Date(invoice.dateIssued || Date.now()).toLocaleDateString()}`);
        doc.text(`Expiry Date: ${new Date(invoice.expiryDate).toLocaleDateString()}`);
        doc.text(`Status: ${invoice.status || '—'}`);
        doc.moveDown(0.8);

        // Customer snapshot (auto-fill)
        const cust = invoice.customerDetails || {};
        const custName = `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || '—';
        doc.fontSize(13).text('Customer', { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(10)
            .text(`Name: ${custName}`)
            .text(`Email: ${cust.email || '—'}`)
            .text(`Mobile: ${cust.mobileNumber || '—'}`)
            .text(`Address: ${(cust.address || '').trim() || '—'}`)
            .text(`City: ${(cust.city || '').trim() || '—'}`)
            .text(`Country: ${(cust.country || '').trim() || '—'}`);
        doc.moveDown(0.8);

        // Car snapshot
        const car = invoice.carDetails || {};
        doc.fontSize(13).text('Vehicle', { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(11)
            .text(`StockID: ${car.internalStockNumber || '—'}`)
            .text(`Vehicle: ${car.make || ''} ${car.model || ''} (${car.year || '—'})`)
            .text(`External Stock: ${car.externalStockNumber || '—'}`)
            .text(`Price: ${formatCurrency(car.price)}`);
        doc.moveDown(0.8);

        // Items table
        doc.fontSize(13).text('Invoice Items', { underline: true });
        doc.moveDown(0.4);

        const startX = doc.x;
        const colDesc = startX;
        const colCost = startX + 360;
        const rowH = 18;

        doc.fontSize(10).fillColor('#444');
        doc.text('Description', colDesc, doc.y, { width: 340 });
        doc.text('Cost', colCost, doc.y, { width: 140, align: 'right' });
        doc.fillColor('#000');
        doc.moveDown(0.6);

        (invoice.invoiceItems || []).forEach(item => {
            const y = doc.y;
            doc.fontSize(10).text(item.description || '—', colDesc, y, { width: 340 });
            doc.text(formatCurrency(item.cost), colCost, y, { width: 140, align: 'right' });
            doc.moveDown(rowH / 10);
        });

        doc.moveDown(0.6);
        doc.fontSize(11).text(`Subtotal: ${formatCurrency(invoice.subtotal)}`, { align: 'right' });
        doc.fontSize(12).text(`Total: ${formatCurrency(invoice.totalCost)}`, { align: 'right' });
        doc.moveDown(0.8);

        // Payment details
        doc.fontSize(13).text('Payment Details', { underline: true });
        doc.moveDown(0.4);
        const bank = invoice.bankDetails || {};
        const mpesa = invoice.mpesaDetails || {};
        doc.fontSize(10)
            .text(`Bank: ${bank.bankName || '—'}`)
            .text(`Account Name: ${bank.accountName || '—'}`)
            .text(`Account Number: ${bank.accountNumber || '—'}`)
            .text(`Branch: ${bank.branch || '—'}`)
            .text(`Swift Code: ${bank.swiftCode || '—'}`);
        doc.moveDown(0.4);
        doc.text(`M-Pesa Paybill: ${mpesa.paybillNumber || '—'}`);
        doc.text(`M-Pesa Account Name: ${mpesa.accountName || '—'}`);
        doc.moveDown(0.8);

        // Terms
        if (invoice.claimClause) {
            doc.fontSize(13).text('Terms', { underline: true });
            doc.moveDown(0.4);
            doc.fontSize(9).fillColor('#333').text(invoice.claimClause, { align: 'left' });
            doc.fillColor('#000');
        }

        doc.end();
    } catch (error) {
        console.error('❌ [PDF DOWNLOAD ERROR]:', error);
        res.status(500).json({ success: false, message: 'Error generating PDF: ' + error.message });
    }
});

// ============================================
// DOWNLOAD PER-CAR PROFORMA (from Manage Cars invoiceCosts)
// ============================================
router.get('/api/cars/:carId/invoice/pdf', authenticateToken, async (req, res) => {
    try {
        const car = await resolveCarByAnyId(req.params.carId);
        if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

        // Load customer profile to auto-fill invoice meta
        const customer = await User.findById(req.user.id);
        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

        // Enforce "passport upload compulsory" for invoice download
        if (!customer.profile?.passportUrl) {
            return res.status(400).json({ success: false, message: 'Please upload your passport in My Profile before downloading the invoice.' });
        }

        const inv = buildPerCarInvoice(car);
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const stock = (car.internalStockNumber || car._id || '').toString().replace(/[^a-zA-Z0-9\-_]/g, '');
        const filename = `TRONEX-PROFORMA-${stock || 'CAR'}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        // Letterhead
        doc.fontSize(18).fillColor('#8b0f1a').text('TRONEX CAR IMPORTERS LTD', { align: 'left' });
        doc.fillColor('#000').fontSize(10).text('Proforma Invoice', { align: 'left' });
        doc.moveDown(0.8);

        // Meta (auto-filled)
        const toName = (customer.profile?.legalName || '').trim() || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
        doc.fontSize(10)
            .text(`Customer ID: ${customer._id}`)
            .text(`To: ${toName || '—'}`)
            .text(`Mobile No: ${customer.mobileNumber || '—'}`)
            .text(`Email: ${customer.email || '—'}`)
            .text(`Country: ${customer.country || '—'}`)
            .text(`National ID/Passport No: ${customer.profile?.idNumber || '—'}`)
            .text(`Postal Address: ${customer.profile?.postalAddress || '—'}`)
            .text(`Delivery Details: ${customer.profile?.deliveryDetails || '—'}`);
        doc.moveDown(0.6);

        // Vehicle
        doc.fontSize(12).text('Vehicle', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10)
            .text(`Stock ID: ${car.internalStockNumber || '—'}`)
            .text(`Make/Model: ${car.make || ''} ${car.model || ''} (${car.year || '—'})`)
            .text(`Mileage: ${car.mileage?.toLocaleString?.() || car.mileage || '—'}`)
            .text(`Transmission: ${car.transmission || '—'}`)
            .text(`Fuel: ${car.fuel || '—'}`);
        doc.moveDown(0.7);

        // Table
        doc.fontSize(12).text('Invoice Items', { underline: true });
        doc.moveDown(0.3);
        const startX = doc.x;
        const colDesc = startX;
        const colCost = startX + 360;

        doc.fontSize(9).fillColor('#444');
        doc.text('Description', colDesc, doc.y, { width: 340 });
        doc.text('Cost', colCost, doc.y, { width: 140, align: 'right' });
        doc.fillColor('#000');
        doc.moveDown(0.6);

        inv.items.forEach(it => {
            const y = doc.y;
            doc.fontSize(9).text(it.label, colDesc, y, { width: 340 });
            doc.text(moneyKES(it.value).replace('KES ', ''), colCost, y, { width: 140, align: 'right' });
            doc.moveDown(0.5);
        });

        doc.moveDown(0.5);
        doc.fontSize(10).text(`Itemized Need Analysis Total: ${moneyKES(inv.itemizedNeedTotal)}`, { align: 'right' });
        doc.text(`Duty Payable: ${moneyKES(inv.dutyPayable)}`, { align: 'right' });
        doc.text(`Discount: ${moneyKES(inv.discount)}`, { align: 'right' });
        doc.fontSize(11).text(`TOTAL COSTS: ${moneyKES(inv.totalCosts)}`, { align: 'right' });
        doc.moveDown(0.8);

        // Bank details (constant)
        doc.fontSize(12).text('Bank Details', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(9)
            .text(`Bank: ${inv.bank.bankName}`)
            .text(`Account Name: ${inv.bank.accountName}`)
            .text(`Branch Code: ${inv.bank.branchCode}`)
            .text(`Branch: ${inv.bank.branch}`)
            .text(`Account Number: ${inv.bank.accountNumber}`)
            .text(`Swift Code: ${inv.bank.swiftCode}`)
            .moveDown(0.3)
            .text(`M-Pesa Paybill: ${inv.bank.paybill}`);

        doc.end();
    } catch (error) {
        console.error('❌ [PER-CAR PDF ERROR]:', error);
        res.status(500).json({ success: false, message: 'Error generating invoice PDF: ' + error.message });
    }
});

// ============================================
// GET INVOICE BY CAR ID - Get invoice for a specific car
// ============================================
router.get('/api/invoices/car/:carId', async (req, res) => {
    try {
        console.log('🔍 [GET INVOICE] Fetching invoice for car:', req.params.carId);

        const car = await resolveCarByAnyId(req.params.carId);
        if (!car) {
            console.warn('⚠️ [GET INVOICE] Car not found:', req.params.carId);
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        const invoice = await Invoice.findOne({ carId: car._id })
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

        const invoice = await resolveInvoiceByAnyId(req.params.invoiceId);
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
        
        const resolved = await resolveInvoiceByAnyId(req.params.invoiceId);
        let invoice = null;
        if (resolved) {
            invoice = await Invoice.findById(resolved._id)
                .populate('carId')
                .populate('customerId')
                .populate('createdBy', 'firstName lastName email');
        }

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
            mobileNumber: customer.mobileNumber,
            address: customer.address,
            city: customer.city,
            country: customer.country
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