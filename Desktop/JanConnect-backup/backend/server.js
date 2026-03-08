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

// Check for duplicate complaint
app.post('/api/complaints/check-duplicate', async (req, res) => {
    try {
        const { category, ward } = req.body;

        if (!category || !ward) {
            return res.status(400).json({ error: 'Category and ward are required.' });
        }

        // 24 hours ago
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Query for duplicate: same category, same ward, not closed, created within 24h
        const existingComplaint = await Complaint.findOne({
            category: category,
            ward: ward,
            status: { $nin: ['Closed', 'Resolved'] },
            createdAt: { $gte: yesterday }
        }).sort({ createdAt: -1 });

        if (existingComplaint) {
            return res.json({
                duplicate: true,
                complaint: {
                    complaint_id: existingComplaint.complaintId,
                    id: existingComplaint.complaintId,
                    title: existingComplaint.title,
                    description: existingComplaint.description,
                    created_at: existingComplaint.createdAt,
                    status: existingComplaint.status,
                    category: existingComplaint.category,
                    ward: existingComplaint.ward,
                    support_count: existingComplaint.support_count
                }
            });
        }

        // No duplicate found
        res.json({ duplicate: false });

    } catch (err) {
        console.error('Duplicate check error:', err);
        res.status(500).json({ error: 'Server error during duplicate check.' });
    }
});

// Support an existing complaint (increment support_count, add citizen to supporters)
app.post('/api/complaints/:complaintId/support', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { citizenEmail } = req.body;

        if (!citizenEmail) {
            return res.status(400).json({ error: 'Citizen email is required.' });
        }

        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Check if user already supported this complaint
        if (complaint.supporters && complaint.supporters.includes(citizenEmail.toLowerCase())) {
            return res.status(400).json({ error: 'You have already supported this complaint.' });
        }

        // Add supporter and increment count
        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            {
                $inc: { support_count: 1 },
                $push: { supporters: citizenEmail.toLowerCase() }
            },
            { new: true }
        );

        res.json({
            message: 'Support added successfully!',
            support_count: updatedComplaint.support_count
        });

    } catch (err) {
        console.error('Support error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// File a new complaint
app.post('/api/complaints', async (req, res) => {
    try {
        const { category, ward, title, description, address, image, userEmail } = req.body;

        if (!category || !ward || !title || !description || !userEmail) {
            return res.status(400).json({ error: 'Required fields are missing.' });
        }

        const complaintId = 'SG-' + new Date().getFullYear() + Math.random().toString(9).substring(2, 11);
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
            complaint: complaint
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

        res.json(complaints);

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

        res.json(complaint);

    } catch (err) {
        console.error('Get complaint error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get ALL complaints (admin)
app.get('/api/complaints', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });

        res.json(complaints);

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

        const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Escalated', 'Reopened', 'Closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Check if trying to change status FROM "Resolved" 
        // If yes, ensure user satisfaction was confirmed (userSatisfied !== false)
        if (complaint.status === 'Resolved' && status !== 'Resolved') {
            // If status is already Resolved and trying to change it, check user satisfaction
            // Allow change to Reopened automatically (from reappeal), but prevent manual changes by admin
            if (status !== 'Reopened' && (complaint.userSatisfied === null || complaint.userSatisfied === false)) {
                return res.status(400).json({ 
                    error: 'Cannot modify a resolved complaint until the user confirms satisfaction. Please wait for user feedback.',
                    requiresUserConfirmation: true,
                    userSatisfied: complaint.userSatisfied
                });
            }
        }

        // Determine SLA status
        let slaStatus = complaint.slaStatus;
        if (complaint.slaDeadline) {
            const now = new Date();
            if (now > complaint.slaDeadline && !['Resolved', 'Escalated', 'Closed'].includes(status)) {
                slaStatus = 'SLA Breached';
            }
        }

        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            { 
                status,
                slaStatus: ['Resolved', 'Escalated', 'Closed'].includes(status) ? slaStatus : 'Within SLA'
            },
            { new: true }
        );

        res.json({
            message: 'Status updated successfully!',
            complaint: updatedComplaint
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
                assignedOfficerDepartment: officer.department,
                status: 'In Progress'
            },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        res.json({
            message: 'Officer assigned successfully!',
            complaint: complaint
        });

    } catch (err) {
        console.error('Assign officer error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============ RESOLVE / REAPPEAL / CLOSE ROUTES ============

// Admin resolves complaint with after-image and notes
app.patch('/api/complaints/:complaintId/resolve', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { afterImage, resolutionNotes } = req.body;

        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Update complaint with resolution details
        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            {
                status: 'Resolved',
                afterImage: afterImage || null,
                resolutionNotes: resolutionNotes || '',
                slaStatus: 'Resolved'
            },
            { new: true }
        );

        res.json({
            message: 'Complaint marked as Resolved!',
            complaint: updatedComplaint
        });

    } catch (err) {
        console.error('Resolve error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Citizen reappeals (reopens) a resolved complaint
app.post('/api/complaints/:complaintId/reappeal', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { reappeal_reason, reappeal_comment, reappeal_image } = req.body;

        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Only allow reappeal if status is Resolved
        if (complaint.status !== 'Resolved') {
            return res.status(400).json({ error: 'Only resolved complaints can be reappealed.' });
        }

        // Reset SLA timer for reappealed complaint (24 hours from now)
        const newSlaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Update complaint with reappeal info and reopen it
        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            {
                status: 'Reopened',
                reappeal_status: true,
                reappeal_reason: reappeal_reason || '',
                reappeal_comment: reappeal_comment || '',
                reappeal_image: reappeal_image || null,
                $inc: { reappeal_count: 1 },
                slaDeadline: newSlaDeadline,
                slaStatus: 'Within SLA',
                autoEscalated: false
            },
            { new: true }
        );

        res.json({
            message: 'Complaint reappealed successfully!',
            complaint: updatedComplaint
        });

    } catch (err) {
        console.error('Reappeal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Citizen confirms resolution (closes complaint)
app.post('/api/complaints/:complaintId/close', async (req, res) => {
    try {
        const { complaintId } = req.params;

        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Only allow close if status is Resolved
        if (complaint.status !== 'Resolved') {
            return res.status(400).json({ error: 'Only resolved complaints can be closed.' });
        }

        // Update complaint status to Closed
        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            {
                status: 'Closed',
                slaStatus: 'Resolved'
            },
            { new: true }
        );

        res.json({
            message: 'Complaint closed successfully!',
            complaint: updatedComplaint
        });

    } catch (err) {
        console.error('Close error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Submit user satisfaction feedback
app.post('/api/complaints/:complaintId/satisfaction', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { satisfied, feedback } = req.body;

        if (satisfied === undefined || satisfied === null) {
            return res.status(400).json({ error: 'Satisfaction status is required.' });
        }

        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Only allow satisfaction submission if complaint is in Resolved or In Progress status
        if (!['In Progress', 'Resolved'].includes(complaint.status)) {
            return res.status(400).json({ error: 'Satisfaction can only be submitted for In Progress or Resolved complaints.' });
        }

        const updatedComplaint = await Complaint.findOneAndUpdate(
            { complaintId },
            {
                userSatisfied: satisfied === true || satisfied === 'true',
                userSatisfactionFeedback: feedback || null,
                satisfactionSubmittedAt: new Date()
            },
            { new: true }
        );

        res.json({
            message: 'Satisfaction feedback submitted successfully!',
            complaint: updatedComplaint
        });

    } catch (err) {
        console.error('Submit satisfaction error:', err);
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
        if (isExpired && !['Resolved', 'Escalated', 'Closed'].includes(complaint.status)) {
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

// Delete a complaint (user)
app.delete('/api/complaints/:complaintId', async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required.' });
        }

        // Find complaint
        const complaint = await Complaint.findOne({ complaintId });
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Verify user is the one who filed the complaint
        if (complaint.userEmail !== userEmail.toLowerCase()) {
            return res.status(403).json({ error: 'You can only delete your own complaints.' });
        }

        // Allow deletion only if status is Pending
        if (complaint.status !== 'Pending') {
            return res.status(400).json({ error: 'Only pending complaints can be deleted.' });
        }

        // Delete complaint
        await Complaint.findOneAndDelete({ complaintId });

        res.json({ message: 'Complaint deleted successfully!' });

    } catch (err) {
        console.error('Delete complaint error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============ USER ROUTES (ADMIN) ============

// Get all users (admin)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });

        res.json(users);

    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get all officers (admin users only)
app.get('/api/officers', async (req, res) => {
    try {
        const officers = await User.find({ role: 'admin' }).select('-password').sort({ fullName: 1 });

        const formatted = officers.map(o => ({
            email: o.email,
            fullName: o.fullName,
            department: o.department,
            designation: o.designation,
            employeeId: o.employeeId
        }));

        res.json(formatted);

    } catch (err) {
        console.error('Get officers error:', err);
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
