const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const Telemetry = require('../models/Telemetry');
const router = express.Router();

const checkAccess = (req, res, next) => {
    if (req.user.role === 'client') {
        const { device_id } = req.params;
        if (!req.user.assigned_devices.includes(device_id)) {
            return res.status(403).json({ message: 'Device Forbidden' });
        }
    }
    next();
};

// GET /api/telemetry/:device_id
// Query params: ?limit=200 &from=ISOString &to=ISOString
router.get('/:device_id', protect, checkAccess, async (req, res) => {
    try {
        const { device_id } = req.params;
        const limit = parseInt(req.query.limit) || 200;
        let query = { device_id };
        
        if (req.query.from || req.query.to) {
            query.ts = {};
            if (req.query.from) query.ts.$gte = new Date(req.query.from);
            if (req.query.to) query.ts.$lte = new Date(req.query.to);
        }

        const data = await Telemetry.find(query).sort({ ts: -1 }).limit(limit);
        res.json(data.reverse()); // Put in chronological order
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/telemetry/:device_id/latest
router.get('/:device_id/latest', protect, checkAccess, async (req, res) => {
    try {
        const { device_id } = req.params;
        const data = await Telemetry.findOne({ device_id }).sort({ ts: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;