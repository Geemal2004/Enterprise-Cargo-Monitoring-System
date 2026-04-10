const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
    device_id: { type: String, required: true, index: true },
    temp: { type: Number },
    hum: { type: Number },
    vib_score: { type: Number },
    ac_alert: { type: Boolean },
    lat: { type: Number },
    lon: { type: Number },
    sd_status: { type: String },
    ts: { type: Date, required: true },
    received_at: { type: Date, default: Date.now }
}, {
    // Time Series collection configuration for MongoDB 5.0+
    timeseries: {
        timeField: 'ts',
        metaField: 'device_id',
        granularity: 'seconds'
    }
});

module.exports = mongoose.model('Telemetry', telemetrySchema);