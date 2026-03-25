const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const User = require('../models/User');

// ============================================
// UPLOADS (passport / slips / docs)
// ============================================
const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads', 'customers');
if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
}

function ensureUserDir(userId) {
    const dir = path.join(uploadsRoot, String(userId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const dir = ensureUserDir(req.user.id);
            cb(null, dir);
        } catch (e) {
            cb(e);
        }
    },
    filename: (req, file, cb) => {
        const safeBase = (file.originalname || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `${Date.now()}-${safeBase}`);
    }
});

const uploadFilter = (req, file, cb) => {
    const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf'
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only images or PDF files are allowed'), false);
};

const upload = multer({
    storage: uploadStorage,
    fileFilter: uploadFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ============================================
// REGISTER - Create new user account
// ============================================
router.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 [REGISTER] New registration attempt');
        const { firstName, lastName, email, mobileNumber, address, city, country, password, passwordConfirm } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !mobileNumber || !password) {
            console.warn('⚠️ [REGISTER] Missing required fields');
            return res.status(400).json({ 
                success: false, 
                message: 'All required fields must be filled' 
            });
        }

        // Password match
        if (password !== passwordConfirm) {
            console.warn('⚠️ [REGISTER] Passwords do not match');
            return res.status(400).json({ 
                success: false, 
                message: 'Passwords do not match' 
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.warn('⚠️ [REGISTER] Email already exists:', email);
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered. Please use a different email or login.' 
            });
        }

        // Create new user
        const user = new User({
            firstName,
            lastName,
            email,
            mobileNumber,
            address: address || '',
            city: city || '',
            country: country || '',
            password,
            role: 'customer' // New users are customers
        });

        await user.save();
        console.log('✅ [REGISTER] User created successfully:', email);

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        console.log('✅ [REGISTER] Token generated successfully');

        res.json({ 
            success: true, 
            message: 'Registration successful! You are now logged in.',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ [REGISTER ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during registration: ' + error.message 
        });
    }
});

// ============================================
// LOGIN - Authenticate user
// ============================================
router.post('/api/auth/login', async (req, res) => {
    try {
        console.log('🔑 [LOGIN] Login attempt');
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            console.warn('⚠️ [LOGIN] Missing email or password');
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }

        // Find user and include password field
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.warn('⚠️ [LOGIN] User not found:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Check if user is active
        if (!user.isActive) {
            console.warn('⚠️ [LOGIN] User account is inactive:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Your account has been deactivated' 
            });
        }

        // Compare passwords
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            console.warn('⚠️ [LOGIN] Invalid password for:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        console.log('✅ [LOGIN] Password verified for:', email);

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        console.log('✅ [LOGIN] Token generated for:', email);

        res.json({ 
            success: true, 
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ [LOGIN ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during login: ' + error.message 
        });
    }
});

// ============================================
// GET USER PROFILE - Get current user details
// ============================================
router.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        console.log('👤 [GET PROFILE] Fetching user:', req.user.id);
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        console.log('✅ [GET PROFILE] Profile retrieved for:', user.email);

        res.json({ 
            success: true, 
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                role: user.role,
                profile: user.profile,
                uploads: user.uploads,
                accountDetails: user.accountDetails
            }
        });
    } catch (error) {
        console.error('❌ [GET PROFILE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching profile: ' + error.message 
        });
    }
});

// ============================================
// UPDATE USER PROFILE - Update user details
// ============================================
router.put('/api/auth/update-profile', authenticateToken, async (req, res) => {
    try {
        console.log('✏️ [UPDATE PROFILE] Updating user:', req.user.id);
        const { firstName, lastName, mobileNumber, address, city, country, email, profile, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
        if (address !== undefined) user.address = address;
        if (city !== undefined) user.city = city;
        if (country !== undefined) user.country = country;
        if (email !== undefined) user.email = String(email).toLowerCase();

        if (profile && typeof profile === 'object') {
            user.profile = Object.assign({}, user.profile || {}, {
                companyName: profile.companyName ?? user.profile?.companyName ?? '',
                legalName: profile.legalName ?? user.profile?.legalName ?? '',
                idNumber: profile.idNumber ?? user.profile?.idNumber ?? '',
                postalAddress: profile.postalAddress ?? user.profile?.postalAddress ?? '',
                deliveryDetails: profile.deliveryDetails ?? user.profile?.deliveryDetails ?? ''
            });
        }

        if (newPassword) {
            user.password = newPassword; // will be hashed by pre-save hook
        }

        user.updatedAt = new Date();
        await user.save();

        console.log('✅ [UPDATE PROFILE] Profile updated for:', user.email);

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                role: user.role,
                profile: user.profile,
                uploads: user.uploads,
                accountDetails: user.accountDetails
            }
        });
    } catch (error) {
        console.error('❌ [UPDATE PROFILE ERROR]:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating profile: ' + error.message 
        });
    }
});

// ============================================
// PROFILE UPLOAD ENDPOINTS
// ============================================
router.post('/api/profile/upload/passport', authenticateToken, upload.single('passport'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
        const url = `/uploads/customers/${req.user.id}/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user.id, { $set: { 'profile.passportUrl': url, updatedAt: new Date() } });
        res.json({ success: true, data: { url } });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Upload failed: ' + e.message });
    }
});

router.post('/api/profile/upload/bank-slips', authenticateToken, upload.array('slips', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'No files provided' });
        const slips = req.files.map(f => ({ url: `/uploads/customers/${req.user.id}/${f.filename}`, uploadedAt: new Date() }));
        await User.findByIdAndUpdate(req.user.id, { $push: { 'uploads.bankSlips': { $each: slips } }, $set: { updatedAt: new Date() } });
        res.json({ success: true, data: slips });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Upload failed: ' + e.message });
    }
});

router.post('/api/profile/upload/consignee', authenticateToken, upload.single('consignee'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
        const url = `/uploads/customers/${req.user.id}/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user.id, { $set: { 'uploads.consigneeDocUrl': url, updatedAt: new Date() } });
        res.json({ success: true, data: { url } });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Upload failed: ' + e.message });
    }
});

router.post('/api/profile/upload/pin', authenticateToken, upload.single('pin'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
        const url = `/uploads/customers/${req.user.id}/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user.id, { $set: { 'uploads.pinDocUrl': url, updatedAt: new Date() } });
        res.json({ success: true, data: { url } });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Upload failed: ' + e.message });
    }
});

// ============================================
// MIDDLEWARE: Verify JWT Token
// ============================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn('⚠️ [AUTH] No token provided');
        return res.status(401).json({ 
            success: false, 
            message: 'No token provided' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            console.warn('⚠️ [AUTH] Invalid token:', err.message);
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        req.user = user;
        next();
    });
}

// Export middleware for use in other routes
router.authenticateToken = authenticateToken;

module.exports = router;