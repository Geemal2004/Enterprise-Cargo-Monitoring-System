const mqtt = require('mqtt');
const Telemetry = require('./models/Telemetry');
const Alert = require('./models/Alert');

const initMQTT = (io) => {
    const client = mqtt.connect(process.env.MQTT_BROKER, {
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: 5000,
    });

    client.on('connect', () => {
        console.log(`MQTT Client connected to ${process.env.MQTT_BROKER}`);
        client.subscribe('logistics_co/+/telemetry', { qos: 1 }, (err) => {
            if (err) console.error('Subscription error:', err);
            else console.log('Subscribed to logistics_co/+/telemetry');
        });
        client.subscribe('logistics_co/+/alerts', { qos: 2 }, (err) => {
            if (err) console.error('Subscription error:', err);
            else console.log('Subscribed to logistics_co/+/alerts');
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            
            // Expected payload schema
            // { device_id, temp, hum, vib_score, ac_alert, lat, lon, sd_status, ts }
            
            if (topic.endsWith('telemetry') || topic.endsWith('alerts')) {
                const telData = {
                    device_id: payload.device_id,
                    temp: payload.temp,
                    hum: payload.hum,
                    vib_score: payload.vib_score,
                    ac_alert: payload.ac_alert,
                    lat: payload.lat,
                    lon: payload.lon,
                    sd_status: payload.sd_status,
                    ts: new Date(payload.ts),
                    received_at: new Date()
                };

                // Emit telemetry to Room
                io.to(payload.device_id).emit('telemetry', telData);
                
                // 1. Save telemetry if it's on the telemetry topic
                if (topic.endsWith('telemetry')) {
                    await Telemetry.create(telData);
                }

                // 2. Evaluate Alerts
                const triggerAlert = async (type, value, threshold) => {
                    const alertData = {
                        device_id: payload.device_id,
                        type,
                        value,
                        threshold,
                        ts: new Date(payload.ts),
                    };
                    await Alert.create(alertData);
                    io.to(payload.device_id).emit('alert', alertData);
                    console.log(`[ALERT] Triggered: ${type} = ${value}`);
                };

                if (payload.temp > 8.0) {
                    await triggerAlert('temperature', payload.temp, 8.0);
                }
                
                if (payload.ac_alert === true) {
                    await triggerAlert('acoustic', true, true);
                }
                
                if (payload.vib_score > 75) {
                    await triggerAlert('vibration', payload.vib_score, 75);
                }
            }
        } catch (error) {
            console.error('Failed processing MQTT payload:', error, message.toString());
        }
    });

    client.on('error', (err) => {
        console.log('MQTT error:', err);
    });

    return client;
};

module.exports = initMQTT;