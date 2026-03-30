const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const Invoice = require('../models/Invoice');
const Car = require('../models/car');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const authRoutes = require('./auth');
const authenticateToken = authRoutes.authenticateToken;
let puppeteer = null;
try {
    puppeteer = require('puppeteer-core');
} catch (_) {
    puppeteer = null;
}
let Resend = null;
try {
    ({ Resend } = require('resend'));
} catch (e) {
    console.warn('⚠️ [INVOICES] resend package not installed. Email sending disabled.');
}

function getResendClient() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!Resend || !apiKey) return null;
    return new Resend(apiKey);
}

async function sendInvoiceEmailWithAttachment({ to, subject, text, filename, pdfBuffer }) {
    const resend = getResendClient();
    const fromEmail = process.env.EMAIL_FROM;

    if (!resend || !fromEmail) {
        const missing = [];
        if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
        if (!fromEmail) missing.push('EMAIL_FROM');
        throw new Error('Resend not configured. Missing: ' + missing.join(', '));
    }

    const result = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        text,
        attachments: [
            {
                filename,
                content: pdfBuffer.toString('base64')
            }
        ]
    });

    if (result && result.error) {
        throw new Error(result.error.message || 'Resend failed to send email');
    }

    return result && result.data ? result.data : null;
}

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

const ALLOWED_EARLY_PAYMENT_DISCOUNTS = new Set([10000, 20000, 30000]);

function normalizeEarlyPaymentDiscount(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    const rounded = Math.round(n);
    return ALLOWED_EARLY_PAYMENT_DISCOUNTS.has(rounded) ? rounded : 0;
}

function earlyPaymentDiscountLabel(amount) {
    if (amount === 30000) return 'Payment within 24hrs — KES 30,000';
    if (amount === 20000) return 'Payment within 48hrs — KES 20,000';
    if (amount === 10000) return 'Payment within 72hrs — KES 10,000';
    return '';
}

function buildPerCarInvoice(carDoc, earlyPaymentDiscountRaw = 0) {
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
    const earlyPaymentDiscount = normalizeEarlyPaymentDiscount(earlyPaymentDiscountRaw);
    const subtotalBeforeEarly = Math.max(0, itemizedNeedTotal + dutyPayable - discount);
    const totalCosts = Math.max(0, subtotalBeforeEarly - earlyPaymentDiscount);

    return {
        currency: costs.currency || 'KES',
        items,
        itemizedNeedTotal,
        dutyPayable,
        itemizedDutyTaxesTotal: dutyPayable,
        discount,
        earlyPaymentDiscount,
        earlyPaymentDiscountLabel: earlyPaymentDiscountLabel(earlyPaymentDiscount),
        subtotalBeforeEarly,
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

function renderProformaPdfContent(doc, car, customer, inv) {
    doc.fontSize(18).fillColor('#8b0f1a').text('TRONEX CAR IMPORTERS LTD', { align: 'left' });
    doc.fillColor('#000').fontSize(10).text('Proforma Invoice', { align: 'left' });
    doc.moveDown(0.8);

    const toName = (customer.profile?.legalName || '').trim() || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    doc.fontSize(10)
        .text(`Customer ID: ${customer.customerId || customer._id}`)
        .text(`Customer Name: ${toName || '—'}`)
        .text(`Mobile No: ${customer.mobileNumber || '—'}`)
        .text(`Email: ${customer.email || '—'}`)
        .text(`Country: ${customer.country || '—'}`)
        .text(`National ID/Passport No: ${customer.profile?.idNumber || '—'}`)
        .text(`Postal Address: ${customer.profile?.postalAddress || '—'}`)
        .text(`Delivery Details: ${customer.profile?.deliveryDetails || '—'}`);
    doc.moveDown(0.6);

    doc.fontSize(12).text('Vehicle', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10)
        .text(`Stock ID: ${car.internalStockNumber || '—'}`)
        .text(`Make/Model: ${car.make || ''} ${car.model || ''} (${car.year || '—'})`)
        .text(`Mileage: ${car.mileage?.toLocaleString?.() || car.mileage || '—'}`)
        .text(`Transmission: ${car.transmission || '—'}`)
        .text(`Fuel: ${car.fuel || '—'}`);
    doc.moveDown(0.7);

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

    inv.items.forEach((it) => {
        const y = doc.y;
        doc.fontSize(9).text(it.label, colDesc, y, { width: 340 });
        doc.text(moneyKES(it.value).replace('KES ', ''), colCost, y, { width: 140, align: 'right' });
        doc.moveDown(0.5);
    });

    doc.moveDown(0.5);
    doc.fontSize(10).text(`Itemized Need Analysis Total: ${moneyKES(inv.itemizedNeedTotal)}`, { align: 'right' });
    doc.text(`Duty Payable: ${moneyKES(inv.dutyPayable)}`, { align: 'right' });
    doc.text(`Discount: ${moneyKES(inv.discount)}`, { align: 'right' });
    if (inv.earlyPaymentDiscount > 0) {
        doc.text(`Early payment discount: ${moneyKES(inv.earlyPaymentDiscount)}`, { align: 'right' });
        if (inv.earlyPaymentDiscountLabel) {
            doc.fontSize(8).fillColor('#444').text(`(${inv.earlyPaymentDiscountLabel})`, { align: 'right' });
            doc.fillColor('#000').fontSize(10);
        }
    }
    doc.fontSize(11).text(`TOTAL COSTS: ${moneyKES(inv.totalCosts)}`, { align: 'right' });
    doc.moveDown(0.8);

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
}

function resolveBrowserExecutablePath() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ].filter(Boolean);

    for (const exe of candidates) {
        if (fs.existsSync(exe)) return exe;
    }
    return null;
}

function buildBuilderLikeInvoiceModel(invoice) {
    const currency = 'KES';
    const items = (invoice.invoiceItems || []).map((it) => ({
        label: it.description || '—',
        value: Number(it.cost || 0)
    }));

    const dutyPayable = items
        .filter((it) => String(it.label || '').toLowerCase().includes('duty payable'))
        .reduce((sum, it) => sum + Number(it.value || 0), 0);

    const discount = Math.abs(
        items
            .filter((it) => String(it.label || '').toLowerCase().includes('discount'))
            .reduce((sum, it) => sum + Number(it.value || 0), 0)
    );

    return {
        currency,
        items,
        itemizedNeedAnalysisTotal: Number(invoice.subtotal || 0),
        itemizedDutyTaxesTotal: dutyPayable,
        dutyPayable,
        discount,
        totalCosts: Number(invoice.totalCost || 0),
        bank: {
            bankName: invoice.bankDetails?.bankName || '—',
            accountName: invoice.bankDetails?.accountName || '—',
            branchCode: invoice.bankDetails?.branchCode || '—',
            branch: invoice.bankDetails?.branch || '—',
            accountNumber: invoice.bankDetails?.accountNumber || '—',
            swiftCode: invoice.bankDetails?.swiftCode || '—',
            paybill: invoice.mpesaDetails?.paybillNumber || '—'
        }
    };
}

async function renderInvoiceHtmlFromTemplate(invoice) {
    const partialPath = path.join(__dirname, '..', 'views', 'partials', 'tronex-invoice.html');
    const cssPath = path.join(__dirname, '..', 'public', 'css', 'invoice.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const htmlFragment = await ejs.renderFile(partialPath, {
        invoice: buildBuilderLikeInvoiceModel(invoice),
        car: invoice.carDetails || {},
        customer: invoice.customerDetails || {}
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #ffffff; }
    .pdf-shell { padding: 16px; }
${css}
  </style>
</head>
<body>
  <div class="pdf-shell">${htmlFragment}</div>
</body>
</html>`;
}

async function tryRenderPdfFromTemplate(invoice) {
    if (!puppeteer) return null;

    const executablePath = resolveBrowserExecutablePath();
    if (!executablePath) return null;

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        const html = await renderInvoiceHtmlFromTemplate(invoice);
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const buffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });
        return buffer;
    } finally {
        await browser.close();
    }
}

function renderInvoicePdfLikeBuilder(doc, invoice) {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usableWidth = right - left;
    const currency = 'KES';
    const customer = invoice.customerDetails || {};
    const car = invoice.carDetails || {};
    const bank = invoice.bankDetails || {};
    const mpesa = invoice.mpesaDetails || {};
    const items = invoice.invoiceItems || [];
    const subtotal = Number(invoice.subtotal || 0);
    const total = Number(invoice.totalCost || 0);
    const duty = items
        .filter((it) => String(it.description || '').toLowerCase().includes('duty payable'))
        .reduce((sum, it) => sum + Number(it.cost || 0), 0);
    const discount = Math.abs(items
        .filter((it) => String(it.description || '').toLowerCase().includes('discount'))
        .reduce((sum, it) => sum + Number(it.cost || 0), 0));
    const customerName = (customer.legalName || `${customer.firstName || ''} ${customer.lastName || ''}`).trim() || '__________________';
    const customerId = customer.customerId || '__________________';

    const ensureSpace = (heightNeeded = 24) => {
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (doc.y + heightNeeded > bottom) doc.addPage();
    };

    doc.fillColor('#111').fontSize(16).text('TRONEX CAR IMPORTERS LTD', left, doc.y, { width: usableWidth * 0.58 });
    doc.fontSize(10).fillColor('#555').text('Proforma Invoice', left, doc.y + 1, { width: usableWidth * 0.58 });
    doc.fontSize(9).fillColor('#555').text(`Mobile: ${customer.mobileNumber || '__________________'}`, left + usableWidth * 0.62, 40, { width: usableWidth * 0.38, align: 'right' });
    doc.text(`Email: ${customer.email || '__________________'}`, { width: usableWidth * 0.38, align: 'right' });
    doc.moveDown(1.4);
    doc.fillColor('#111').fontSize(13).text('PROFORMA INVOICE', { align: 'center' });
    doc.moveDown(0.5);

    ensureSpace(72);
    const metaTop = doc.y;
    doc.roundedRect(left, metaTop, usableWidth, 64, 4).strokeColor('#dddddd').lineWidth(1).stroke();
    doc.fontSize(9).fillColor('#111');
    doc.text(`Customer ID: ${customerId}`, left + 10, metaTop + 8);
    doc.text(`Stock ID: ${car.internalStockNumber || 'N/A'}`, left + usableWidth / 2, metaTop + 8);
    doc.text(`Invoice No: ${invoice.invoiceNumber || '__________________'}`, left + 10, metaTop + 26);
    doc.text(`Date Issued: ${fmtDate(invoice.dateIssued)}`, left + usableWidth / 3, metaTop + 26);
    doc.text(`Expiry Date: ${fmtDate(invoice.expiryDate)}`, left + (usableWidth * 2) / 3, metaTop + 26);
    doc.text(`Customer: ${customerName}`, left + 10, metaTop + 44);
    doc.text(`Mobile: ${customer.mobileNumber || '__________________'}`, left + usableWidth / 2, metaTop + 44);
    doc.y = metaTop + 74;

    const widths = [usableWidth * 0.46, usableWidth * 0.18, usableWidth * 0.18, usableWidth * 0.18];
    const colX = [left, left + widths[0], left + widths[0] + widths[1], left + widths[0] + widths[1] + widths[2]];
    const drawRow = (cells, isHeader = false, bold = false) => {
        ensureSpace(20);
        const y = doc.y;
        doc.rect(left, y, usableWidth, 18).fillAndStroke(isHeader ? '#f5f6fb' : '#ffffff', '#e5e7eb');
        doc.fillColor('#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(cells[0] || '', colX[0] + 6, y + 5, { width: widths[0] - 12 });
        doc.text(cells[1] || '', colX[1] + 4, y + 5, { width: widths[1] - 8, align: 'right' });
        doc.text(cells[2] || '', colX[2] + 4, y + 5, { width: widths[2] - 8, align: 'right' });
        doc.text(cells[3] || '', colX[3] + 4, y + 5, { width: widths[3] - 8, align: 'right' });
        doc.y = y + 18;
    };

    drawRow(['Description', 'Cost', 'Itemized Total', 'Total Cost'], true, true);
    items.forEach((it) => {
        drawRow([
            String(it.description || '—'),
            `${currency} ${moneyKES(it.cost).replace('KES ', '')}`,
            '',
            ''
        ]);
    });
    drawRow(['Itemized Total', '', `${currency} ${moneyKES(subtotal).replace('KES ', '')}`, ''], false, true);
    drawRow(['Duty Payable', `${currency} ${moneyKES(duty).replace('KES ', '')}`, '', '']);
    drawRow(['Discount', `${currency} ${moneyKES(discount).replace('KES ', '')}`, '', '']);
    drawRow(['TOTAL COSTS (All Costs Inclusive)', '', '', `${currency} ${moneyKES(total).replace('KES ', '')}`], false, true);
    doc.moveDown(0.6);

    ensureSpace(120);
    const boxTop = doc.y;
    const boxGap = 10;
    const boxWidth = (usableWidth - boxGap) / 2;
    const boxHeight = 105;
    doc.roundedRect(left, boxTop, boxWidth, boxHeight, 4).strokeColor('#d7dce4').stroke();
    doc.roundedRect(left + boxWidth + boxGap, boxTop, boxWidth, boxHeight, 4).strokeColor('#d7dce4').stroke();
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(10).text('BANK DETAILS', left + 8, boxTop + 8);
    doc.font('Helvetica').fontSize(9).text(`Bank: ${bank.bankName || '—'}`, left + 8, boxTop + 24);
    doc.text(`Account Name: ${bank.accountName || '—'}`, left + 8, boxTop + 38);
    doc.text(`Branch Code: ${bank.branchCode || '—'}`, left + 8, boxTop + 52);
    doc.text(`Account Number: ${bank.accountNumber || '—'}`, left + 8, boxTop + 66);
    doc.text(`Swift Code: ${bank.swiftCode || '—'}`, left + 8, boxTop + 80);
    const rX = left + boxWidth + boxGap + 8;
    doc.font('Helvetica-Bold').fontSize(10).text('M-PESA DETAILS', rX, boxTop + 8);
    doc.font('Helvetica').fontSize(9).text(`Paybill No: ${mpesa.paybillNumber || '—'}`, rX, boxTop + 24);
    doc.text(`Account Name: ${mpesa.accountName || '—'}`, rX, boxTop + 38);
    doc.text('Customer Signature: __________________', rX, boxTop + 80);
    doc.y = boxTop + boxHeight + 14;

    ensureSpace(140);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('VEHICLE DETAILS');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Stock ID: ${car.internalStockNumber || 'N/A'}`);
    doc.text(`Year: ${car.year || 'N/A'}`);
    doc.text(`Make: ${car.make || 'N/A'}    Model: ${car.model || 'N/A'}`);
    doc.text(`Body Type: ${car.bodyType || 'N/A'}    Transmission: ${car.transmission || 'N/A'}`);
    doc.text(`Fuel: ${car.fuel || 'N/A'}    Engine Capacity: ${car.engineCapacity || 'N/A'}`);
    doc.text(`Mileage: ${car.mileage != null ? Number(car.mileage).toLocaleString() : 'N/A'}    Registration: ${car.registration || 'N/A'}`);
}

async function invoicePdfToBuffer(invoice) {
    try {
        const browserBuffer = await tryRenderPdfFromTemplate(invoice);
        if (browserBuffer) return browserBuffer;
    } catch (err) {
        console.warn('⚠️ [INVOICE PDF] HTML renderer failed, falling back to PDFKit:', err.message);
    }

    return new Promise((resolve, reject) => {
        try {
            const chunks = [];
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));
            renderInvoicePdfLikeBuilder(doc, invoice);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
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
            createdBy: req.user?.id || null,
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
// GENERATE INVOICE FROM MANAGE-CARS INPUTS
// - Creates an Invoice record (admin-visible)
// - Sends Invoice PDF to Tronex + Faith emails
// ============================================
router.post('/api/admin/cars/:carId/generate-invoice', async (req, res) => {
    try {
        const { carId } = req.params;
        const { invoiceCosts, expiryDays } = req.body || {};

        // Choose an invoice creator:
        // - If a JWT was provided elsewhere (req.user), use it.
        // - Otherwise, allow null (createdBy is no longer required).
        const creatorId = req.user?.id || null;

        const car = await resolveCarByAnyId(carId);
        if (!car) {
            return res.status(404).json({ success: false, message: 'Car not found' });
        }

        const costsForInvoice = invoiceCosts && typeof invoiceCosts === 'object' ? invoiceCosts : (car.invoiceCosts || {});
        const perCar = buildPerCarInvoice({ invoiceCosts: costsForInvoice });

        const expiry = (() => {
            const days = Number(expiryDays || process.env.INVOICE_EXPIRY_DAYS || 30);
            return new Date(Date.now() + Math.max(0, days) * 24 * 60 * 60 * 1000);
        })();

        const invoiceItems = (perCar.items || [])
            .map(it => ({ description: it.label, cost: Number(it.value || 0) }))
            .filter(it => Number.isFinite(it.cost));

        // Ensure duty payable (and discount) are included in invoice totals.
        // The invoice schema calculates `subtotal` as the sum of `invoiceItems`,
        // so duty must be an item for totals to reflect it.
        if (Number.isFinite(perCar.dutyPayable) && Number(perCar.dutyPayable) > 0) {
            invoiceItems.push({
                description: 'Duty Payable',
                cost: Number(perCar.dutyPayable)
            });
        }

        if (Number.isFinite(perCar.discount) && Number(perCar.discount) > 0) {
            // Discount reduces total, so represent it as a negative line.
            invoiceItems.push({
                description: 'Discount',
                cost: -Number(perCar.discount)
            });
        }

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
            invoiceItems,
            bankDetails: {
                bankName: perCar.bank.bankName,
                accountName: perCar.bank.accountName,
                branchCode: perCar.bank.branchCode,
                branch: perCar.bank.branch,
                accountNumber: perCar.bank.accountNumber,
                swiftCode: perCar.bank.swiftCode
            },
            mpesaDetails: {
                paybillNumber: perCar.bank.paybill,
                accountName: 'TRONEX'
            },
            expiryDate: expiry,
            claimClause: undefined,
            createdBy: creatorId,
            status: 'Issued'
        });

        await invoice.save();

        let emailSent = false;
        let emailError = null;

        // Email using Resend if configured.
        const recipients = ['tronexcarimportersltd@gmail.com', 'faithmaina393@gmail.com'];
        const resend = getResendClient();

        if (resend && process.env.EMAIL_FROM) {
            const pdfBuffer = await invoicePdfToBuffer(invoice);
            const attachmentName = `${invoice.invoiceNumber || invoice._id}.pdf`;

            try {
                const sendResult = await sendInvoiceEmailWithAttachment({
                    to: recipients,
                    subject: `TRONEX Invoice ${invoice.invoiceNumber} - ${car.make} ${car.model}`,
                    text: `Hello,\n\nPlease find attached invoice ${invoice.invoiceNumber} for ${car.make} ${car.model}.\n\nRegards,\nTRONEX`,
                    filename: attachmentName,
                    pdfBuffer
                });
                console.log('✅ [INVOICE EMAIL] Sent with Resend id:', sendResult?.id || 'n/a');
                emailSent = true;
            } catch (e) {
                emailError = e && e.message ? e.message : String(e);
                console.error('❌ [INVOICE EMAIL ERROR]:', emailError);
            }
        } else {
            emailError = 'Resend not configured (missing RESEND_API_KEY or EMAIL_FROM); invoice created but email not sent.';
        }

        return res.json({
            success: true,
            message: 'Invoice created successfully',
            data: {
                invoice,
                email: { sent: emailSent, error: emailError }
            }
        });
    } catch (error) {
        console.error('❌ [GENERATE INVOICE ERROR]:', error);
        res.status(500).json({ success: false, message: 'Error generating invoice: ' + error.message });
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

        const filename = `${invoice.invoiceNumber || invoice._id}.pdf`;
        const pdfBuffer = await invoicePdfToBuffer(invoice);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(pdfBuffer);
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

        const earlyPaymentDiscount = normalizeEarlyPaymentDiscount(req.query.earlyDiscount);
        const inv = buildPerCarInvoice(car, earlyPaymentDiscount);
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const stock = (car.internalStockNumber || car._id || '').toString().replace(/[^a-zA-Z0-9\-_]/g, '');
        const filename = `TRONEX-PROFORMA-${stock || 'CAR'}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
        renderProformaPdfContent(doc, car, customer, inv);
        doc.end();
    } catch (error) {
        console.error('❌ [PER-CAR PDF ERROR]:', error);
        res.status(500).json({ success: false, message: 'Error generating invoice PDF: ' + error.message });
    }
});

function proformaPdfToBuffer(car, customer, earlyPaymentDiscount = 0) {
    const inv = buildPerCarInvoice(car, earlyPaymentDiscount);
    const chunks = [];

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));
            renderProformaPdfContent(doc, car, customer, inv);
            doc.end();
        } catch (e) {
            reject(e);
        }
    });
}

// Customer endpoint: email invoice PDF to customer email + Tronex addresses
router.post('/api/cars/:carId/invoice/email', authenticateToken, async (req, res) => {
    try {
        const car = await resolveCarByAnyId(req.params.carId);
        if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

        const customer = await User.findById(req.user.id);
        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

        const missing = [];
        if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
        if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM');

        if (missing.length) {
            return res.status(500).json({
                success: false,
                message: 'Resend not configured. Missing: ' + missing.join(', ')
            });
        }

        const earlyPaymentDiscount = normalizeEarlyPaymentDiscount(req.body?.earlyPaymentDiscount);
        const pdfBuffer = await proformaPdfToBuffer(car, customer, earlyPaymentDiscount);
        const stock = (car.internalStockNumber || car._id || '').toString().replace(/[^a-zA-Z0-9\-_]/g, '');
        const filename = `TRONEX-PROFORMA-${stock || 'CAR'}.pdf`;

        const recipients = [
            customer.email,
            'tronexcarimportersltd@gmail.com',
            'faithmaina393@gmail.com'
        ].filter(Boolean);

        const sendResult = await sendInvoiceEmailWithAttachment({
            to: recipients,
            subject: `TRONEX Invoice - ${car.make || ''} ${car.model || ''}`.trim(),
            text: `Hello,\n\nPlease find attached the invoice for your vehicle (${car.make || ''} ${car.model || ''}).\n\nRegards,\nTRONEX Car Importers`,
            filename,
            pdfBuffer
        });

        return res.json({
            success: true,
            message: 'Invoice emailed successfully',
            data: {
                recipients,
                provider: 'resend',
                emailId: sendResult?.id || null
            }
        });
    } catch (error) {
        console.error('❌ [EMAIL INVOICE ERROR]:', error);
        return res.status(500).json({ success: false, message: 'Error emailing invoice: ' + error.message });
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
            // Public customer ID used in invoice templates
            customerId: (customer.customerId || customer._id).toString(),
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