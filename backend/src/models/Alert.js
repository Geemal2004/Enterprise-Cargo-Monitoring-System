const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    device_id: { type: String, required: true, index: true },
    type: { type: String, required: true },       // e.g. 'vibration', 'temperature', 'acoustic'
    value: { type: mongoose.Schema.Types.Mixed }, // The offending value
    threshold: { type: mongoose.Schema.Types.Mixed }, // The threshold it crossed
    ts: { type: Date, required: true },
    received_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);