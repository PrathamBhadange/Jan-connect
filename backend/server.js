require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Complaint = require('./models/Complaint');

const app = express();
const PORT = process.env.PORT || 5000;

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============ MONGODB CONNECTION ============

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });

// ============ AUTH ROUTES ============

// Register
app.post('/api/register', async (req, res) => {
    try {
        const {
            fullName, firstName, middleName, lastName,
            email, phone, mobile, location, aadhar, role, password,
            consumerNo, licenseNo, panNo, propertyNo, address, pincode,
            // Admin-specific fields
            employeeId, department, designation, officeLocation, jurisdiction, officeAddress
        } = req.body;

        // Validation
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'All required fields must be filled.' });
        }

        // For citizen, aadhar is required
        if (role === 'user' && !aadhar) {
            return res.status(400).json({ error: 'Aadhar number is required for citizen registration.' });
        }

        // For admin, employee ID and department are required
        if (role === 'admin') {
            if (!employeeId || !department || !designation) {
                return res.status(400).json({ error: 'Employee ID, Department, and Designation are required for admin registration.' });
            }
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered!' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            fullName,
            firstName: firstName || '',
            middleName: middleName || '',
            lastName: lastName || '',
            email: email.toLowerCase(),
            phone: phone || '',
            mobile: mobile || '',
            location: location || '',
            aadhar: aadhar || '',
            role: role || 'user',
            password: hashedPassword,
            consumerNo: consumerNo || '',
            licenseNo: licenseNo || '',
            panNo: panNo || '',
            propertyNo: propertyNo || '',
            address: address || '',
            pincode: pincode || '',
            // Admin-specific
            employeeId: employeeId || '',
            department: department || '',
            designation: designation || '',
            officeLocation: officeLocation || '',
            jurisdiction: jurisdiction || '',
            officeAddress: officeAddress || ''
        });

        await user.save();

        res.status(201).json({ message: 'Registration successful!' });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials or role mismatch!' });
        }

        // Check role
        if (user.role !== role) {
            return res.status(400).json({ error: 'Invalid credentials or role mismatch!' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials or role mismatch!' });
        }

        // Return user data (without password)
        const userData = {
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            location: user.location,
            aadhar: user.aadhar,
            role: user.role
        };

        res.json({ message: 'Login successful!', user: userData });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// ============ COMPLAINT ROUTES ============

// File a new complaint
app.post('/api/complaints', async (req, res) => {
    try {
        const { category, ward, title, description, address, image, userEmail } = req.body;

        if (!category || !ward || !title || !description || !userEmail) {
            return res.status(400).json({ error: 'Required fields are missing.' });
        }

        const complaintId = 'GRV-' + Date.now().toString().slice(-6);
        const date = new Date().toLocaleDateString('en-IN');

        const complaint = new Complaint({
            complaintId,
            category,
            ward,
            title,
            description,
            address: address || '',
            image: image || null,
            status: 'Pending',
            userEmail: userEmail.toLowerCase(),
            date
        });

        await complaint.save();

        res.status(201).json({
            message: 'Complaint filed successfully!',
            complaint: {
                id: complaint.complaintId,
                category: complaint.category,
                ward: complaint.ward,
                title: complaint.title,
                description: complaint.description,
                address: complaint.address,
                image: complaint.image,
                status: complaint.status,
                date: complaint.date,
                userEmail: complaint.userEmail
            }
        });

    } catch (err) {
        console.error('Complaint error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Get complaints for a specific user
app.get('/api/complaints/user/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        const complaints = await Complaint.find({ userEmail: email }).sort({ createdAt: -1 });

        const formatted = complaints.map(c => ({
            id: c.complaintId,
            category: c.category,
            ward: c.ward,
            title: c.title,
            description: c.description,
            address: c.address,
            image: c.image,
            status: c.status,
            date: c.date,
            userEmail: c.userEmail
        }));

        res.json(formatted);

    } catch (err) {
        console.error('Get complaints error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get ALL complaints (admin)
app.get('/api/complaints', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });

        const formatted = complaints.map(c => ({
            id: c.complaintId,
            category: c.category,
            ward: c.ward,
            title: c.title,
            description: c.description,
            address: c.address,
            image: c.image,
            status: c.status,
            date: c.date,
            userEmail: c.userEmail
        }));

        res.json(formatted);

    } catch (err) {
        console.error('Get all complaints error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Update complaint status (admin)
app.patch('/api/complaints/:complaintId/status', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { status } = req.body;

        const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Escalated'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const complaint = await Complaint.findOneAndUpdate(
            { complaintId },
            { status },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        res.json({
            message: 'Status updated successfully!',
            complaint: {
                id: complaint.complaintId,
                status: complaint.status
            }
        });

    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============ USER ROUTES (ADMIN) ============

// Get all users (admin)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });

        const formatted = users.map(u => ({
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            location: u.location,
            aadhar: u.aadhar,
            role: u.role
        }));

        res.json(formatted);

    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============ CATCH-ALL: Serve frontend ============

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
