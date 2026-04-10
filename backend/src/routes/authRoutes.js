const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await User.findOne({ username });
        
        // Use bcrypt in production - dummy plaintext comparison
        if (user && user.password === password) {
            const token = jwt.sign(
                { id: user._id, role: user.role, assigned_devices: user.assigned_devices },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            res.json({ _id: user._id, username: user.username, role: user.role, token });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;