const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
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
// Load environment variables
dotenv.config();

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
app.engine('html', require('ejs').renderFile);

// ==================== ROUTES ====================

//======================MONGODB CONNECTION=======================
const mongoose = require('mongoose');
const Car = require('./models/car');

console.log('📊 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tronex-cars')
    .then(() => {
        console.log('✅ MongoDB connected successfully!');
        initializeCounter();
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
    });

// ============================================
// STOCK NUMBER COUNTER FUNCTIONS
// ============================================

// Initialize counter for stock numbers
async function initializeCounter() {
    try {
        const countersCollection = mongoose.connection.collection('counters');
        const counter = await countersCollection.findOne({ _id: 'internalStockNumber' });
        
        if (!counter) {
            await countersCollection.insertOne({
                _id: 'internalStockNumber',
                sequence_value: 200
            });
            console.log('✅ Stock number counter initialized with value 200');
        } else {
            console.log('✅ Stock number counter found with value:', counter.sequence_value);
        }
    } catch (error) {
        console.error('Error initializing counter:', error);
    }
}

// Generate next internal stock number using counter
async function getNextInternalStockNumber() {
  try {
      const countersCollection = mongoose.connection.collection('counters');
      
      console.log('🔄 [COUNTER] Attempting to increment counter...');
      
      // Increment counter and get the NEW value
      const result = await countersCollection.findOneAndUpdate(
          { _id: 'internalStockNumber' },
          { $inc: { sequence_value: 1 } },
          { 
              returnDocument: 'after'  // Get AFTER increment
          }
      );
      
      console.log('📊 [COUNTER] Full result object:', JSON.stringify(result, null, 2));
      
      // Handle both old and new MongoDB driver formats
      let counterValue = null;
      
      if (result && result.value) {
          // Old format: result.value.sequence_value
          counterValue = result.value.sequence_value;
          console.log('✅ [COUNTER] Using old format - sequence_value:', counterValue);
      } else if (result && result.sequence_value) {
          // New format: result.sequence_value directly
          counterValue = result.sequence_value;
          console.log('✅ [COUNTER] Using new format - sequence_value:', counterValue);
      } else {
          console.error('❌ [COUNTER] Cannot extract sequence_value from result');
          console.error('Result:', result);
          await initializeCounter();
          return '26.00200';
      }
      
      // Build the stock number
      const stockNumber = `26.00${counterValue}`;
      console.log(`✅ [STOCK NUMBER GENERATED] ${stockNumber} (counter: ${counterValue})`);
      
      return stockNumber;
  } catch (error) {
      console.error('❌ [COUNTER ERROR]:', error);
      return '26.00200';
  }
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

// Admin login API
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === correctPassword) {
      res.json({ success: true, message: 'Login successful' });
  } else {
      res.json({ success: false, message: 'Invalid password' });
  }
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
      res.json({
          success: true,
          data: cars
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
      res.json({
          success: true,
          data: cars
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
      res.json({
          success: true,
          data: car
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
// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === correctPassword) {
      res.json({ success: true, message: 'Login successful' });
  } else {
      res.json({ success: false, message: 'Invalid password' });
  }
});

//CREATE new car
app.post('/api/admin/cars', async (req, res) => {
  try {
      console.log('📨 [POST /api/admin/cars] Received data:', req.body);

      const { 
          make, model, year, price, type, bodyType, mileage, transmission, 
          color, interiorColor, doors, seats, fuel, drive, engineCapacity, trunk,
          registration, description, badge, availability, gradientColor, highlights, 
          features, mainImage, externalStockNumber
      } = req.body;

      // Validation - ONLY required fields
      if (!make || !model || !year || !price || !mileage || !color || !description) {
          console.log('❌ Validation failed - missing required fields');
          return res.status(400).json({
              success: false,
              message: 'Please fill in all required fields: make, model, year, price, mileage, color, description'
          });
      }

      // Generate auto-incrementing internal stock number
      const internalStockNumber = await getNextInternalStockNumber();
      
      // Auto-generate car name from make and model
      const name = `${make} ${model}`;

      console.log('📦 [CREATING CAR] Stock:', internalStockNumber, 'Name:', name);

      // Create new car
      const newCar = new Car({
        carId: `CAR-${Date.now()}`,
        internalStockNumber,
        externalStockNumber: externalStockNumber || '',
        name,
        make,
        model,
        year: parseInt(year),
        price: parseFloat(price),
        type: type || 'Sedan',
        bodyType: bodyType || '',
        mileage: parseInt(mileage),
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
        mainImage: mainImage || ''
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
app.put('/api/admin/cars/:id', async (req, res) => {
  try {
      console.log('🔄 [UPDATE START] Car ID:', req.params.id);

      const { 
          make, model, year, price, type, bodyType, mileage, transmission, 
          color, interiorColor, doors, seats, fuel, drive, engineCapacity, trunk,
          registration, description, badge, availability, gradientColor, highlights, 
          features, images, mainImage, externalStockNumber
      } = req.body;

      // Auto-generate car name from make and model
      const name = `${make} ${model}`;

      const updateData = {
          name,
          make,
          model,
          year: parseInt(year),
          price: parseFloat(price),
          type: type || 'Sedan',
          bodyType: bodyType || '',
          mileage: parseInt(mileage),
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
app.delete('/api/admin/cars/:id', async (req, res) => {
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
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
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
app.post('/api/upload/images', upload.array('images', 10), async (req, res) => {
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
app.delete('/api/upload/image/:filename', (req, res) => {
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
        res.render('car-details', { car });
    } catch (error) {
        console.error('Error fetching car details:', error);
        res.status(500).render('error', { message: 'Error loading car details' });
    }
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