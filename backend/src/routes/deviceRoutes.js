const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const Telemetry = require('../models/Telemetry');
const User = require('../models/User');
const router = express.Router();

// GET /api/devices
router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role === 'super_admin') {
            // Find distinct device IDs actively reporting
            const devices = await Telemetry.distinct('device_id');
            res.json(devices);
        } else {
            res.json(req.user.assigned_devices || []);
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;