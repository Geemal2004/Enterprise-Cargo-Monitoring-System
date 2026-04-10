require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const initMQTT = require('./mqttHandler');

// Initialize App & Server
const app = express();
const server = http.createServer(app);

// Init Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // Allow connections from frontend
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log(`Socket Connected: ${socket.id}`);
    
    // Clients must explicitly join a room for a specific device_id
    socket.on('join_device', (device_id) => {
        socket.join(device_id);
        console.log(`Socket ${socket.id} joined room ${device_id}`);
    });

    socket.on('leave_device', (device_id) => {
        socket.leave(device_id);
        console.log(`Socket ${socket.id} left room ${device_id}`);
    });

    socket.on('disconnect', () => {
        console.log(`Socket Disconnected: ${socket.id}`);
    });
});

// Connect to Database & seed demo users
connectDB().then(async () => {
    await User.seed(); // Only Seeds if empty
    
    // Initialize MQTT Listener after DB connection
    initMQTT(io);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/alerts', alertRoutes);

// Health Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// Default Error Handler
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
