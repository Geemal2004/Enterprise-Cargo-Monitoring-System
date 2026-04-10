const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // plaintext for demo, use bcrypt in prod
    role: { type: String, enum: ['super_admin', 'client'], required: true },
    assigned_devices: [{ type: String }] // Only applies to 'client' role
});

// A dummy pre-save to seed some users
userSchema.statics.seed = async function() {
    const count = await this.countDocuments();
    if (count === 0) {
        await this.create({
            username: 'admin',
            password: 'password', // use bcrypt
            role: 'super_admin',
            assigned_devices: []
        });
        await this.create({
            username: 'client1',
            password: 'password',
            role: 'client',
            assigned_devices: ['ESP32-S3-BENCH-01']
        });
        console.log('Seeded demo users.');
    }
};

module.exports = mongoose.model('User', userSchema);