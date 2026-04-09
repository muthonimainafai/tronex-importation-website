const path = require('path');
const dotenv = require('dotenv');
// Always load .env next to server.js (cwd-independent — npm/Cursor may start from another folder).
// quiet:true keeps startup logs clean by hiding dotenv tips.
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
const {
  requireAdmin,
  signAdminPanelToken,
  secureComparePassword
} = require('./middleware/adminAuth');
// ==================== MULTER CONFIGURATION ====================

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads', 'cars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'car-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)'), false);
    }
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

// ==================== IMAGE OPTIMIZATION ====================

async function optimizeImage(filePath) {
    try {
        const optimizedPath = filePath.replace(
            path.extname(filePath),
            '-optimized.webp'
        );

        await sharp(filePath)
            .resize(1200, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(optimizedPath);

        // Delete original and use optimized
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return path.basename(optimizedPath);
    } catch (error) {
        console.error('❌ Error optimizing image:', error);
        return path.basename(filePath);
    }
}

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ==================== STATIC FILES ====================
console.log('📁 Serving static files from:', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== VIEW ENGINE ====================
console.log('📄 Views directory:', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
// Ensure template edits (EJS HTML views/partials) are picked up immediately.
// Express otherwise may cache rendered templates depending on environment.
app.set('view cache', false);
app.engine('html', require('ejs').renderFile);

// ==================== ROUTES ====================

//======================MONGODB CONNECTION=======================
const mongoose = require('mongoose');
const Car = require('./models/car');
const User = require('./models/User');

console.log('📊 Connecting to MongoDB...');
const mongoUriRaw = process.env.MONGODB_URI || 'mongodb://localhost:27017/tronex-cars';
const mongoUri = mongoUriRaw.replace('mongodb://localhost', 'mongodb://127.0.0.1');
let mongoConnectAttempt = 0;

async function connectMongoWithRetry() {
    mongoConnectAttempt += 1;
    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✅ MongoDB connected successfully!');
        await initializeCounter();
    } catch (err) {
        console.error(`❌ MongoDB connection error (attempt ${mongoConnectAttempt}):`, err.message);
        console.log('🔁 Retrying MongoDB connection in 5 seconds...');
        setTimeout(connectMongoWithRetry, 5000);
    }
}

connectMongoWithRetry();

// ============================================
// STOCK NUMBER COUNTER FUNCTIONS
// ============================================

// Initialize counter for stock numbers
async function initializeCounter() {
    try {
        const countersCollection = mongoose.connection.collection('counters');
        const counter = await countersCollection.findOne({ _id: 'internalStockNumber' });
        
        if (!counter) {
            // Next issued number uses $inc first → 199 + 1 = 200 → TRON{yy}-00200
            await countersCollection.insertOne({
                _id: 'internalStockNumber',
                sequence_value: 199
            });
            console.log('✅ Stock number counter initialized (first ID will be …00200)');
        } else {
            console.log('✅ Stock number counter found with value:', counter.sequence_value);
        }
    } catch (error) {
        console.error('Error initializing counter:', error);
    }
}

// Generate next internal stock number: TRON{yy}-##### (e.g. TRON26-00200)
async function getNextInternalStockNumber() {
  const yearTwoDigits = String(new Date().getFullYear()).slice(-2);
  const fallback = `TRON${yearTwoDigits}-00200`;

  try {
      const countersCollection = mongoose.connection.collection('counters');

      let doc = await countersCollection.findOneAndUpdate(
          { _id: 'internalStockNumber' },
          { $inc: { sequence_value: 1 } },
          { returnDocument: 'after' }
      );

      const unwrap = (r) => (r && typeof r === 'object' && r.sequence_value != null ? r : (r && r.value) || null);
      doc = unwrap(doc);

      if (!doc || doc.sequence_value == null) {
          console.warn('⚠️ [COUNTER] Missing or unreadable counter; re-initializing');
          await initializeCounter();
          doc = unwrap(await countersCollection.findOneAndUpdate(
              { _id: 'internalStockNumber' },
              { $inc: { sequence_value: 1 } },
              { returnDocument: 'after' }
          ));
      }

      const counterValue = doc?.sequence_value;
      if (counterValue == null) {
          console.error('❌ [COUNTER] sequence_value still missing after retry');
          return fallback;
      }

      const sequence = String(counterValue).padStart(5, '0');
      const stockNumber = `TRON${yearTwoDigits}-${sequence}`;
      console.log(`✅ [STOCK NUMBER GENERATED] ${stockNumber} (counter: ${counterValue})`);
      return stockNumber;
  } catch (error) {
      console.error('❌ [COUNTER ERROR]:', error);
      return fallback;
  }
}

function formatStockId(raw) {
  if (raw == null || raw === '') return raw;
  let s = typeof raw === 'string' ? raw.trim() : String(raw);

  const canonical = /^TRON(\d{2})-(\d{5})$/i.exec(s);
  if (canonical) return `TRON${canonical[1]}-${canonical[2]}`;

  const legacy = /^TRON-(\d{2})-(\d{5})$/i.exec(s);
  if (legacy) return `TRON${legacy[1]}-${legacy[2]}`;

  const digits = s.replace(/\D/g, '');
  const yearTwoDigits = String(new Date().getFullYear()).slice(-2);

  if (digits.length >= 7) {
      const year = digits.slice(0, 2);
      const seq = digits.slice(-5).padStart(5, '0');
      return `TRON${year}-${seq}`;
  }

  if (digits.length > 0) {
      return `TRON${yearTwoDigits}-${digits.padStart(5, '0').slice(-5)}`;
  }

  return s;
}

// ============================================
// AUTH HELPERS (JWT stored in cookie or header)
// ============================================
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function getJwtFromRequest(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice('Bearer '.length);
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.tronex_token || null;
}

function requireUserPage(req, res, next) {
  const token = getJwtFromRequest(req);
  if (!token) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    req.user = user;
    next();
  });
}

function requireCustomerPage(req, res, next) {
  const token = getJwtFromRequest(req);
  if (!token) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err || !user || user.role !== 'customer') {
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }
    req.user = user;
    next();
  });
}

// ============================================
// INVOICE HELPERS (per-car)
// ============================================
function toNumOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toFiniteNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  s = s.replace(/,/g, '');
  s = s.replace(/[^0-9.\-]/g, '');
  if (!s || s === '.' || s === '-' || s === '-.') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function buildCarInvoiceViewModel(car) {
  const costs = car?.invoiceCosts || {};
  const itemized = [
    { key: 'cif', label: 'Cost insurance and Freight (CIF)', value: toNumOrNull(costs.cif) },
    { key: 'portCfsCharges', label: 'Port/Cfs Charges', value: toNumOrNull(costs.portCfsCharges) },
    { key: 'shippingLineDo', label: 'Shipping line/D.O', value: toNumOrNull(costs.shippingLineDo) },
    { key: 'radiation', label: 'Radiation', value: toNumOrNull(costs.radiation) },
    { key: 'mssLevy', label: 'MSS Levy', value: toNumOrNull(costs.mssLevy) },
    { key: 'clearingServiceCharge', label: 'Clearing service Charge', value: toNumOrNull(costs.clearingServiceCharge) },
    { key: 'kgPlate', label: 'KG Plate (cic ins. comp.insured)', value: toNumOrNull(costs.kgPlate) },
    { key: 'ntsaSticker', label: 'NTSA Sticker', value: toNumOrNull(costs.ntsaSticker) },
    { key: 'handlingCosts', label: 'Handling Costs', value: toNumOrNull(costs.handlingCosts) }
  ];

  const itemizedNeedAnalysisTotal = itemized.reduce((sum, it) => sum + (Number(it.value) || 0), 0);
  const dutyPayable = Number(toNumOrNull(costs.dutyPayable) || 0);
  const itemizedDutyTaxesTotal = dutyPayable;
  const discount = Number(toNumOrNull(costs.discount) || 0);
  const totalCosts = Math.max(0, itemizedNeedAnalysisTotal + itemizedDutyTaxesTotal - discount);

  return {
    currency: costs.currency || 'KES',
    items: itemized,
    dutyPayable,
    discount,
    itemizedNeedAnalysisTotal,
    itemizedDutyTaxesTotal,
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

function toNumericValue(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDisplayPriceKsh(car) {
  const costs = car?.invoiceCosts || {};
  const itemizedKeys = [
    'cif',
    'portCfsCharges',
    'shippingLineDo',
    'radiation',
    'mssLevy',
    'clearingServiceCharge',
    'kgPlate',
    'ntsaSticker',
    'handlingCosts'
  ];

  const hasAnyInvoiceValue =
    itemizedKeys.some((k) => toNumericValue(costs[k]) > 0) ||
    toNumericValue(costs.dutyPayable) > 0 ||
    toNumericValue(costs.discount) > 0;

  if (!hasAnyInvoiceValue) return toNumericValue(car?.price);

  const itemizedTotal = itemizedKeys.reduce((sum, k) => sum + toNumericValue(costs[k]), 0);
  const dutyPayable = toNumericValue(costs.dutyPayable);
  const discount = toNumericValue(costs.discount);
  return Math.max(0, itemizedTotal + dutyPayable - discount);
}


//=====================ROUTES=================================

// Home page
app.get('/', (req, res) => {
  console.log('✅ GET / - Rendering index.html');
  res.render('index');
});

// About Us route
app.get('/about-us', (req, res) => {
  res.render('about-us');
});

// User auth pages
app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// My Profile (requires login)
app.get(['/my-profile', '/my-profile/'], requireCustomerPage, (req, res) => {
  res.render('my-profile');
});

// Stock List route - render full stock-list view
app.get('/stock-list', (req, res) => {
  res.render('stock-list');
});

// Clearing & Forwarding route
app.get('/clearing-forwarding', (req, res) => {
  res.send('<h1>Clearing & Forwarding Page - Coming Soon</h1><a href="/">Back to Home</a>');
});

// Vessel Schedule route
app.get('/vessel-schedule', (req, res) => {
  res.send('<h1>Vessel Schedule Page - Coming Soon</h1><a href="/">Back to Home</a>');
});

// Testimonials route
app.get('/testimonials', (req, res) => {
  res.send('<h1>Testimonials Page - Coming Soon</h1><a href="/">Back to Home</a>');
});

// ==================== API ROUTES ====================

// API route for contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Validate input
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill in all required fields' 
      });
    }

    console.log('Contact form submitted:', { name, email, phone, message });

    res.status(200).json({ 
      success: true, 
      message: 'Thank you for your inquiry! We will get back to you soon.' 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

// Admin login route
app.get('/admin-login', (req, res) => {
  res.render('admin-login');
});

// When someone visits /admin directly, always send them to login
app.get('/admin', (req, res) => {
  res.redirect('/admin-login');
});

// Admin login API — returns signed JWT (store as adminToken; send Authorization on admin requests)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const configured = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production' && !configured) {
    return res.status(503).json({ success: false, message: 'Admin login is not configured.' });
  }

  const devFallback = process.env.NODE_ENV === 'production' ? null : 'admin123';
  const expected = configured != null && configured !== '' ? configured : devFallback;

  if (!expected || !secureComparePassword(String(password || ''), expected)) {
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }

  const token = signAdminPanelToken();
  return res.json({ success: true, message: 'Login successful', token });
});

// Admin dashboard page (actual admin UI)
app.get('/admin-dashboard', (req, res) => {
  res.render('admin');
});

// Manage cars route
app.get('/manage-cars', (req, res) => {
  res.render('manage-cars');
});

//=====================CAR API ROUTES======================
//Get all cars(for users side)
app.get('/api/cars', async (req, res) => {
  try {
      const cars = await Car.find().sort({ createdAt: -1 });
      const data = cars.map(c => {
          const obj = c.toObject();
          obj.internalStockNumber = formatStockId(obj.internalStockNumber);
          return obj;
      });
      res.json({
          success: true,
          data
      });
  } catch (error) {
      console.error('Error fetching cars:', error);
      res.status(500).json({
          success: false,
          message: 'Error fetching cars',
          error: error.message
      });
  }
});

// Get featured cars only
app.get('/api/cars/featured', async (req, res) => {
  try {
      const cars = await Car.find({ badge: 'Featured' }).limit(6);
      const data = cars.map(c => {
          const obj = c.toObject();
          obj.internalStockNumber = formatStockId(obj.internalStockNumber);
          return obj;
      });
      res.json({
          success: true,
          data
      });
  } catch (error) {
      console.error('Error fetching featured cars:', error);
      res.status(500).json({
          success: false,
          message: 'Error fetching featured cars',
          error: error.message
      });
  }
});

//GET single car by ID
app.get('/api/cars/:id', async (req, res) => {
  try {
      const car = await Car.findById(req.params.id);
      if (!car) {
          return res.status(404).json({
              success: false,
              message: 'Car not found'
          });
      }
      const data = car.toObject();
      data.internalStockNumber = formatStockId(data.internalStockNumber);
      res.json({
          success: true,
          data
      });
  } catch (error) {
      console.error('Error fetching car:', error);
      res.status(500).json({
          success: false,
          message: 'Error fetching car',
          error: error.message
      });
  }
});

//=====================ADMIN API ROUTES====================
//CREATE new car
app.post('/api/admin/cars', requireAdmin, async (req, res) => {
  try {
      console.log('📨 [POST /api/admin/cars] Received data:', req.body);

      const { 
          make, model, year, price, type, bodyType, mileage, transmission, 
          color, interiorColor, doors, seats, fuel, drive, engineCapacity, trunk,
          registration, description, badge, availability, gradientColor, highlights, 
          features, images, mainImage, externalStockNumber, invoiceCosts
      } = req.body;

      const parsedYear = Number.parseInt(year, 10);
      const parsedPrice = toFiniteNumber(price);
      const parsedMileage = toFiniteNumber(mileage);

      // Validation - ONLY required fields
      if (
          !make || !model || !color || !description ||
          !Number.isFinite(parsedYear) ||
          !Number.isFinite(parsedPrice) ||
          !Number.isFinite(parsedMileage)
      ) {
          console.log('❌ Validation failed - missing required fields');
          return res.status(400).json({
              success: false,
              message: 'Please provide valid fields: make, model, year, price, mileage, color, description'
          });
      }

      // Generate auto-incrementing internal stock number
      const internalStockNumber = await getNextInternalStockNumber();
      
      // Auto-generate car name from make and model
      const name = `${make} ${model}`;

      console.log('📦 [CREATING CAR] Stock:', internalStockNumber, 'Name:', name);

      // Create new car
      const newCar = new Car({
        carId: `CAR-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        internalStockNumber,
        externalStockNumber: externalStockNumber || '',
        name,
        make,
        model,
        year: parsedYear,
        price: parsedPrice,
        type: type || 'Sedan',
        bodyType: bodyType || '',
        mileage: parsedMileage,
        transmission: transmission || 'Automatic',
        color,
        interiorColor: interiorColor || '',
        doors: parseInt(doors) || 4,
        seats: parseInt(seats) || 5,
        fuel: fuel || 'Petrol',
        drive: drive || '2WD',
        engineCapacity: engineCapacity || '',
        trunk: trunk || '',
        registration: registration || '',
        description,
        badge: badge || 'Featured',
        availability: availability || 'Available',
        gradientColor: gradientColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        highlights: Array.isArray(highlights) ? highlights : [],
        features: Array.isArray(features) ? features : [],
        images: Array.isArray(images) ? images : [],
        mainImage: mainImage || '',
        invoiceCosts: invoiceCosts || undefined
      });

      const savedCar = await newCar.save();
      console.log('✅ [CAR CREATED]:', savedCar._id, 'Stock:', internalStockNumber);

      res.status(201).json({
        success: true,
        message: 'Car added successfully',
        data: savedCar
      });
  } catch (error) {
      console.error('❌ [ERROR CREATING CAR]:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({
          success: false,
          message: 'Error creating car: ' + error.message,
          error: error.message
      });
  }
});

 //UPDATE car
app.put('/api/admin/cars/:id', requireAdmin, async (req, res) => {
  try {
      console.log('🔄 [UPDATE START] Car ID:', req.params.id);

      const { 
          make, model, year, price, type, bodyType, mileage, transmission, 
          color, interiorColor, doors, seats, fuel, drive, engineCapacity, trunk,
          registration, description, badge, availability, gradientColor, highlights, 
          features, images, mainImage, externalStockNumber, invoiceCosts
      } = req.body;

      const parsedYear = Number.parseInt(year, 10);
      const parsedPrice = toFiniteNumber(price);
      const parsedMileage = toFiniteNumber(mileage);

      if (
          !make || !model || !color || !description ||
          !Number.isFinite(parsedYear) ||
          !Number.isFinite(parsedPrice) ||
          !Number.isFinite(parsedMileage)
      ) {
          return res.status(400).json({
              success: false,
              message: 'Please provide valid fields: make, model, year, price, mileage, color, description'
          });
      }

      // Auto-generate car name from make and model
      const name = `${make} ${model}`;

      const updateData = {
          name,
          make,
          model,
          year: parsedYear,
          price: parsedPrice,
          type: type || 'Sedan',
          bodyType: bodyType || '',
          mileage: parsedMileage,
          transmission: transmission || 'Automatic',
          color,
          interiorColor: interiorColor || '',
          doors: parseInt(doors) || 4,
          seats: parseInt(seats) || 5,
          fuel: fuel || 'Petrol',
          drive: drive || '2WD',
          engineCapacity: engineCapacity || '',
          trunk: trunk || '',
          registration: registration || '',
          description,
          badge: badge || 'Featured',
          availability: availability || 'Available',
          gradientColor: gradientColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          highlights: highlights || [],
          features: features || [],
          images: images || [],
          mainImage: mainImage || '',
          externalStockNumber: externalStockNumber || '',
          invoiceCosts: invoiceCosts || undefined,
          updatedAt: new Date()
      };

      console.log('💾 [SAVE DATA] Updating car...');

      const car = await Car.findByIdAndUpdate(
          req.params.id, 
          updateData, 
          { new: true }
      );

      if (!car) {
          console.log('❌ [ERROR] Car not found:', req.params.id);
          return res.status(404).json({
              success: false,
              message: 'Car not found'
          });
      }

      console.log('✅ [UPDATE SUCCESS]:', name);

      res.json({
          success: true,
          message: 'Car updated successfully',
          data: car
      });
  } catch (error) {
      console.error('❌ [ERROR UPDATING CAR]:', error.message);
      res.status(500).json({
          success: false,
          message: 'Error updating car',
          error: error.message
      });
  }
});

// DELETE car
app.delete('/api/admin/cars/:id', requireAdmin, async (req, res) => {
  try {
      const car = await Car.findByIdAndDelete(req.params.id);

      if (!car) {
          return res.status(404).json({
              success: false,
              message: 'Car not found'
          });
      }

      res.json({
          success: true,
          message: 'Car deleted successfully',
          data: car
      });
  } catch (error) {
      console.error('Error deleting car:', error);
      res.status(500).json({
          success: false,
          message: 'Error deleting car',
          error: error.message
      });
  }
});

// ==================== IMAGE UPLOAD ROUTES ====================

// Upload single image
app.post('/api/upload/image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
      if (!req.file) {
          return res.status(400).json({
              success: false,
              message: 'No image file provided'
          });
      }

      console.log('📸 [IMAGE UPLOAD] Received file:', req.file.filename);

      // Optimize image
      const optimizedFilename = await optimizeImage(req.file.path);

      const imageUrl = `/uploads/cars/${optimizedFilename}`;

      console.log('✅ [IMAGE OPTIMIZED] URL:', imageUrl);

      res.json({
          success: true,
          message: 'Image uploaded successfully',
          data: {
              filename: optimizedFilename,
              url: imageUrl,
              size: req.file.size
          }
      });
  } catch (error) {
      console.error('❌ [IMAGE UPLOAD ERROR]:', error);
      res.status(500).json({
          success: false,
          message: 'Error uploading image: ' + error.message
      });
  }
});

// Upload multiple images
app.post('/api/upload/images', requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
      if (!req.files || req.files.length === 0) {
          return res.status(400).json({
              success: false,
              message: 'No image files provided'
          });
      }

      console.log('📸 [MULTI-UPLOAD] Received', req.files.length, 'files');

      const uploadedImages = [];

      for (const file of req.files) {
          try {
              const optimizedFilename = await optimizeImage(file.path);
              const imageUrl = `/uploads/cars/${optimizedFilename}`;
              uploadedImages.push({
                  filename: optimizedFilename,
                  url: imageUrl
              });
          } catch (error) {
              console.error('❌ Error optimizing file:', file.filename, error);
          }
      }

      console.log('✅ [MULTI-UPLOAD COMPLETE] Uploaded:', uploadedImages.length, 'images');

      res.json({
          success: true,
          message: `${uploadedImages.length} images uploaded successfully`,
          data: uploadedImages
      });
  } catch (error) {
      console.error('❌ [MULTI-UPLOAD ERROR]:', error);
      res.status(500).json({
          success: false,
          message: 'Error uploading images: ' + error.message
      });
  }
});

// Delete image
app.delete('/api/upload/image/:filename', requireAdmin, (req, res) => {
  try {
      const { filename } = req.params;
      const filePath = path.join(uploadDir, filename);

      console.log('🗑️ [DELETE IMAGE] File:', filename);

      // Security: prevent directory traversal
      if (!path.resolve(filePath).startsWith(uploadDir)) {
          return res.status(403).json({
              success: false,
              message: 'Invalid file path'
          });
      }

      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('✅ [IMAGE DELETED]:', filename);
          res.json({
              success: true,
              message: 'Image deleted successfully'
          });
      } else {
          res.status(404).json({
              success: false,
              message: 'Image not found'
          });
      }
  } catch (error) {
      console.error('❌ [DELETE IMAGE ERROR]:', error);
      res.status(500).json({
          success: false,
          message: 'Error deleting image: ' + error.message
      });
  }
});

// Car details page
app.get('/car/:id', async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return res.status(404).render('404', { message: 'Car not found' });
        }
        const carData = car.toObject();
        carData.internalStockNumber = formatStockId(carData.internalStockNumber);
        carData.displayPriceKsh = getDisplayPriceKsh(carData);
        res.render('car-details', { car: carData, invoice: buildCarInvoiceViewModel(carData) });
    } catch (error) {
        console.error('Error fetching car details:', error);
        res.status(500).render('error', { message: 'Error loading car details' });
    }
  });

// Payment page (new URL to avoid browser caching/back-forward issues)
app.get('/payment-details/:id', requireUserPage, async (req, res) => {
  try {
    // Prevent stale cached HTML after template changes
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('X-Payment-Layout', 'details-v3');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).render('404', { message: 'Car not found' });
    }
    const carData = car.toObject();
    carData.internalStockNumber = formatStockId(carData.internalStockNumber);
    const customer = await User.findById(req.user.id);
    res.render('payment', { car: carData, invoice: buildCarInvoiceViewModel(carData), customer });
  } catch (error) {
    console.error('Error loading payment page:', error);
    res.status(500).render('error', { message: 'Error loading payment page' });
  }
});

// Backward-compatible redirect (keeps querystring, but forces the new URL)
app.get('/payment/:id', requireUserPage, async (req, res) => {
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex !== -1 ? req.originalUrl.slice(queryIndex) : '';
  return res.redirect(302, `/payment-details/${encodeURIComponent(req.params.id)}${query}`);
});

  // Register routes
app.use(authRoutes);
app.use(invoiceRoutes);

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Not Found:', req.method, req.path);
  res.status(404).send('Page not found - <a href="/">Back to Home</a>');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚗 Tronex Car Importers running on http://localhost:${PORT}`);
  console.log(`\n📍 Visit: http://localhost:${PORT}`);
  console.log('\n✅ Server is ready!\n');
});