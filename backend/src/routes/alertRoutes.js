const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const Alert = require('../models/Alert');
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

// GET /api/alerts/:device_id
router.get('/:device_id', protect, checkAccess, async (req, res) => {
    try {
        const { device_id } = req.params;
        const alerts = await Alert.find({ device_id }).sort({ ts: -1 }).limit(100);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;