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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Complaint', complaintSchema);
