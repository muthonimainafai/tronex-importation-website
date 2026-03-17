const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================
// REGISTER - Create new user account
// ============================================
router.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 [REGISTER] New registration attempt');
        const { firstName, lastName, email, phone, mobileNumber, address, city, country, postalCode, password, passwordConfirm } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !phone || !mobileNumber || !password) {
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
            phone,
            mobileNumber,
            address: address || '',
            city: city || '',
            country: country || '',
            postalCode: postalCode || '',
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
                phone: user.phone,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                postalCode: user.postalCode,
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
                phone: user.phone,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                postalCode: user.postalCode,
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
                phone: user.phone,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                postalCode: user.postalCode,
                role: user.role
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
        const { firstName, lastName, phone, mobileNumber, address, city, country, postalCode } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                firstName: firstName || user.firstName,
                lastName: lastName || user.lastName,
                phone: phone || user.phone,
                mobileNumber: mobileNumber || user.mobileNumber,
                address: address || user.address,
                city: city || user.city,
                country: country || user.country,
                postalCode: postalCode || user.postalCode,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        console.log('✅ [UPDATE PROFILE] Profile updated for:', user.email);

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                mobileNumber: user.mobileNumber,
                address: user.address,
                city: user.city,
                country: user.country,
                postalCode: user.postalCode,
                role: user.role
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