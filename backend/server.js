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

// ============ SLA AUTO-ESCALATION ============

// Function to check and auto-escalate complaints after 24 hours
async function checkAndAutoEscalateComplaints() {
    try {
        const now = new Date();
        
        // Find all complaints that:
        // 1. Are still "Pending" or "In Progress"
        // 2. Have exceeded their SLA deadline (24 hours)
        // 3. Haven't been auto-escalated yet
        const complaints = await Complaint.find({
            status: { $in: ['Pending', 'In Progress'] },
            slaDeadline: { $lt: now },
            autoEscalated: false
        });

        let escalatedCount = 0;
        for (const complaint of complaints) {
            try {
                await Complaint.findByIdAndUpdate(
                    complaint._id,
                    {
                        status: 'Escalated',
                        slaStatus: 'SLA Breached',
                        autoEscalated: true
                    },
                    { new: true }
                );
                escalatedCount++;
            } catch (err) {
                console.error(`Error escalating complaint ${complaint.complaintId}:`, err);
            }
        }

        if (escalatedCount > 0) {
            console.log(`✅ Auto-escalated ${escalatedCount} complaints due to SLA breach`);
        }
    } catch (err) {
        console.error('Error in SLA auto-escalation check:', err);
    }
}

// Run SLA check every 5 minutes (300000 ms)
setInterval(checkAndAutoEscalateComplaints, 5 * 60 * 1000);

// Run initial check on startup (after 10 seconds to ensure DB is ready)
setTimeout(checkAndAutoEscalateComplaints, 10000);

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
        const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

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
            date,
            slaDeadline,
            slaStatus: 'Within SLA'
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
                userEmail: complaint.userEmail,
                slaDeadline: complaint.slaDeadline,
                slaStatus: complaint.slaStatus
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
            userEmail: c.userEmail,
            assignedOfficer: c.assignedOfficer,
            assignedOfficerName: c.assignedOfficerName,
            assignedOfficerDepartment: c.assignedOfficerDepartment,
            slaDeadline: c.slaDeadline,
            slaStatus: c.slaStatus,
            autoEscalated: c.autoEscalated,
            createdAt: c.createdAt
        }));

        res.json(formatted);

    } catch (err) {
        console.error('Get complaints error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get single complaint by ID
app.get('/api/complaints/:complaintId', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const complaint = await Complaint.findOne({ complaintId });

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const formatted = {
            id: complaint.complaintId,
            category: complaint.category,
            ward: complaint.ward,
            title: complaint.title,
            description: complaint.description,
            address: complaint.address,
            image: complaint.image,
            status: complaint.status,
            date: complaint.date,
            userEmail: complaint.userEmail,
            assignedOfficer: complaint.assignedOfficer,
            assignedOfficerName: complaint.assignedOfficerName,
            assignedOfficerDepartment: complaint.assignedOfficerDepartment,
            createdAt: complaint.createdAt,
            updatedAt: complaint.updatedAt,
            slaDeadline: complaint.slaDeadline,
            slaStatus: complaint.slaStatus,
            autoEscalated: complaint.autoEscalated
        };

        res.json(formatted);

    } catch (err) {
        console.error('Get complaint error:', err);
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
            userEmail: c.userEmail,
            assignedOfficer: c.assignedOfficer,
            assignedOfficerName: c.assignedOfficerName,
            assignedOfficerDepartment: c.assignedOfficerDepartment,
            slaDeadline: c.slaDeadline,
            slaStatus: c.slaStatus,
            autoEscalated: c.autoEscalated,
            createdAt: c.createdAt
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

        // Determine SLA status
        let slaStatus = 'Within SLA';
        let autoEscalated = false;
        
        const complaint = await Complaint.findOne({ complaintId });
        if (complaint && complaint.slaDeadline) {
            const now = new Date();
            if (now > complaint.slaDeadline && status !== 'Resolved' && status !== 'Escalated') {
                slaStatus = 'SLA Breached';
            }
        }

        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            { 
                status,
                slaStatus: status === 'Resolved' ? 'Resolved' : (status === 'Escalated' ? 'Escalated' : slaStatus)
            },
            { new: true }
        );

        if (!updatedComplaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        res.json({
            message: 'Status updated successfully!',
            complaint: {
                id: updatedComplaint.complaintId,
                status: updatedComplaint.status,
                slaStatus: updatedComplaint.slaStatus,
                autoEscalated: updatedComplaint.autoEscalated
            }
        });

    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Assign officer to complaint (admin)
app.patch('/api/complaints/:complaintId/assign', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { officerEmail } = req.body;

        if (!officerEmail) {
            return res.status(400).json({ error: 'Officer email is required.' });
        }

        // Find the officer
        const officer = await User.findOne({ email: officerEmail.toLowerCase() });
        if (!officer || officer.role !== 'admin') {
            return res.status(404).json({ error: 'Officer not found or invalid role.' });
        }

        // Update complaint with officer info
        const complaint = await Complaint.findOneAndUpdate(
            { complaintId },
            { 
                assignedOfficer: officer.email,
                assignedOfficerName: officer.fullName,
                assignedOfficerDepartment: officer.department
            },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        res.json({
            message: 'Officer assigned successfully!',
            complaint: {
                id: complaint.complaintId,
                assignedOfficer: complaint.assignedOfficer,
                assignedOfficerName: complaint.assignedOfficerName,
                assignedOfficerDepartment: complaint.assignedOfficerDepartment
            }
        });

    } catch (err) {
        console.error('Assign officer error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get SLA info for a complaint
app.get('/api/complaints/:complaintId/sla', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const complaint = await Complaint.findOne({ complaintId });

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const now = new Date();
        const slaDeadline = complaint.slaDeadline;
        const timeRemaining = slaDeadline - now; // in milliseconds
        const isExpired = timeRemaining <= 0;

        let displayStatus = complaint.slaStatus;
        if (isExpired && complaint.status !== 'Resolved' && complaint.status !== 'Escalated') {
            displayStatus = 'SLA Breached';
        }

        res.json({
            complaintId: complaint.complaintId,
            status: complaint.status,
            slaDeadline: complaint.slaDeadline,
            timeRemainingMs: Math.max(0, timeRemaining),
            slaStatus: displayStatus,
            autoEscalated: complaint.autoEscalated,
            isExpired: isExpired
        });

    } catch (err) {
        console.error('Get SLA info error:', err);
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
