const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
    });

    //=====================ROUTES=================================

// Home page
app.get('/', (req, res) => {
  console.log('✅ GET / - Rendering index.html');
  res.render('index');
});

// About Us route
app.get('/about-us', (req, res) => {
  res.send('<h1>About Us Page - Coming Soon</h1><a href="/">Back to Home</a>');
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

//=====================CAR API ROUTES======================
//Ger all cars(for users side)
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
      const { name, make, model, year, price, type, mileage, transmission, color, description, badge, availability, gradientColor } = req.body;

      // Validation
      if (!name || !make || !model || !year || !price || !mileage || !color || !description) {
          return res.status(400).json({
              success: false,
              message: 'Please fill in all required fields'
          });
      }

      //Create new car
      const newCar = new Car({
        carId: `CAR-${Date.now()}`,
        name,
        make,
        model,
        year: parseInt(year),
        price: parseFloat(price),
        type: type || 'Sedan',
        mileage: parseInt(mileage),
        transmission: transmission || 'Automatic',
        color,
        description,
        badge: badge || 'Featured',
        availability: availability || 'Available',
        gradientColor: gradientColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    });

    await newCar.save();

    res.status(201).json({
        success: true,
        message: 'Car added successfully',
        data: newCar
    });
} catch (error) {
    console.error('Error creating car:', error);
    res.status(500).json({
        success: false,
        message: 'Error creating car',
        error: error.message
    });
}
});

 //UPDATE car

 app.put('/api/admin/cars/:id', async (req, res) => {
  try {
      const { name, make, model, year, price, type, mileage, transmission, color, description, badge, availability, gradientColor } = req.body;

      const updateData = {
          name,
          make,
          model,
          year: parseInt(year),
          price: parseFloat(price),
          type: type || 'Sedan',
          mileage: parseInt(mileage),
          transmission: transmission || 'Automatic',
          color,
          description,
          badge: badge || 'Featured',
          availability: availability || 'Available',
          gradientColor: gradientColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          updatedAt: Date.now()
      };

      const car = await Car.findByIdAndUpdate(req.params.id, updateData, { new: true });

      if (!car) {
          return res.status(404).json({
              success: false,
              message: 'Car not found'
          });
      }

      res.json({
          success: true,
          message: 'Car updated successfully',
          data: car
      });
  } catch (error) {
      console.error('Error updating car:', error);
      res.status(500).json({
          success: false,
          message: 'Error updating car',
          error: error.message
      });
  }
});

//manage cars route
app.get('/manage-cars', (req, res) => {
  res.render('manage-cars');
});
// ==================== ERROR HANDLERS ====================

// stock-list route
app.get('/stock-list', (req, res) => {
  res.render('stock-list');
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Not Found:', req.method, req.path);
  res.status(404).send('Page not found - <a href="/">Back to Home</a>');
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