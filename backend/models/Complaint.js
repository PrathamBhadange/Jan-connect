const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    complaintId: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: String,
        required: true
    },
    ward: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    image: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Resolved', 'Escalated'],
        default: 'Pending'
    },
    userEmail: {
        type: String,
        required: true,
        lowercase: true
    },
    date: {
        type: String,
        required: true
    },
    assignedOfficer: {
        type: String,
        default: null,
        lowercase: true
    },
    assignedOfficerName: {
        type: String,
        default: null
    },
    assignedOfficerDepartment: {
        type: String,
        default: null
    },
    slaStatus: {
        type: String,
        enum: ['Within SLA', 'SLA Breached', 'Resolved', 'Escalated'],
        default: 'Within SLA'
    },
    slaDeadline: {
        type: Date,
        default: null
    },
    autoEscalated: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Complaint', complaintSchema);
