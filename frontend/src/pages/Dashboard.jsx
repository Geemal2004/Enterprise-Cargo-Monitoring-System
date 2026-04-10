import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useStore } from '../store/useStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

export default function Dashboard() {
  const { jwt, devices, setDevices, activeDeviceId, setActiveDevice, telemetryLog, setTelemetryLog, appendTelemetry, addAlert, latestTelemetry, activeAlerts, clearAlerts } = useStore();
  
  const [loading, setLoading] = useState(false);

  // 1. Fetch Devices List on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/devices`, {
          headers: { Authorization: `Bearer ${jwt}` }
        });
        setDevices(res.data);
        if (res.data.length > 0 && !activeDeviceId) {
          setActiveDevice(res.data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch devices");
      }
    };
    fetchDevices();
  }, [jwt]);

  // 2. Socket.io and Historical fetch when activeDevice changes
  useEffect(() => {
    if (!activeDeviceId) return;

    let socket;
    
    const initializeDevice = async () => {
      setLoading(true);
      clearAlerts();
      
      // Fetch historical (last 200 points)
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/telemetry/${activeDeviceId}?limit=200`, {
          headers: { Authorization: `Bearer ${jwt}` }
        });
        setTelemetryLog(res.data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);

      // Setup live socket
      socket = io(import.meta.env.VITE_SOCKET_URL);
      socket.emit('join_device', activeDeviceId);
      
      socket.on('telemetry', (data) => {
        appendTelemetry(data);
      });

      socket.on('alert', (alert) => {
        addAlert(alert);
      });
    };

    initializeDevice();

    return () => {
      if (socket) {
        socket.emit('leave_device', activeDeviceId);
        socket.disconnect();
      }
    };
  }, [activeDeviceId, jwt]);

  return (
    <div className="space-y-6">
      {/* Top Banner (Device Select & Alert Toasts) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        
        <div className="flex items-center space-x-4">
          <label className="text-sm font-semibold text-slate-700">Tracking Unit:</label>
          <select 
            className="border-slate-300 rounded text-sm py-1.5 px-3 focus:ring-brand-500 font-mono shadow-sm bg-slate-50 cursor-pointer"
            value={activeDeviceId || ''}
            onChange={(e) => setActiveDevice(e.target.value)}
          >
            <option value="" disabled>Select Device</option>
            {devices.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Global Alert Banner State */}
        {(latestTelemetry?.ac_alert || (latestTelemetry?.temp > 8.0) || activeAlerts.length > 0) && (
           <div className="mt-4 sm:mt-0 flex items-center px-4 py-1.5 bg-red-50 border border-red-200 rounded text-red-700 text-sm font-bold tracking-wide animate-pulse shadow-sm">
             <span className="mr-2 h-2 w-2 bg-red-600 rounded-full"></span>
             CRITICAL ALERT ACTIVE
           </div>
        )}
      </div>

      {loading && <div className="text-slate-500 font-medium flex items-center"><div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></div>Loading Telemetry...</div>}

      {/* Grid: Stat Cards */}
      {!loading && latestTelemetry && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard title="Temperature" value={`${latestTelemetry.temp.toFixed(1)} °C`} status={latestTelemetry.temp > 8.0 ? 'danger' : 'normal'} />
            <StatCard title="Humidity" value={`${latestTelemetry.hum.toFixed(1)} %`} status="normal" />
            <StatCard title="Vibration RMS" value={`${latestTelemetry.vib_score.toFixed(0)} / 100`} status={latestTelemetry.vib_score > 75 ? 'danger' : 'normal'} />
            <StatCard title="Acoustic Anomaly" value={latestTelemetry.ac_alert ? "DETECTED" : "CLEAR"} status={latestTelemetry.ac_alert ? 'danger' : 'normal'} />
            <StatCard title="GPS Fix" value={latestTelemetry.lat !== 0 ? "LOCKED" : "LOST"} status={latestTelemetry.lat !== 0 ? "normal" : "warning"} subtitle={`${latestTelemetry.lat.toFixed(4)}, ${latestTelemetry.lon.toFixed(4)}`} />
        </div>
      )}

      {/* Main Visualization Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Map */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
           <h3 className="text-base font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Live GPS Tracking</h3>
           <div className="h-[350px] bg-slate-50 rounded overflow-hidden border border-slate-200">
             {latestTelemetry && latestTelemetry.lat !== 0 ? (
                <MapContainer center={[latestTelemetry.lat, latestTelemetry.lon]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                  />
                  <Marker position={[latestTelemetry.lat, latestTelemetry.lon]}>
                    <Popup className="font-mono text-sm">
                      <b>{latestTelemetry.device_id}</b><br/>
                      Lat: {latestTelemetry.lat.toFixed(4)}<br/>
                      Lon: {latestTelemetry.lon.toFixed(4)}<br/>
                      {new Date(latestTelemetry.ts).toLocaleTimeString()}
                    </Popup>
                  </Marker>
                </MapContainer>
             ) : (
                <div className="flex bg-slate-100 h-full w-full items-center justify-center text-slate-400 font-medium">Waiting for GPS Fix...</div>
             )}
           </div>
        </div>

        {/* Right Column: Time Series Charts */}
        <div className="space-y-6">
           <ChartCard title="Temperature History (°C)" data={telemetryLog} dataKey="temp" color="#f97316" threshold={8.0} />
           <ChartCard title="Vibration RMS History" data={telemetryLog} dataKey="vib_score" color="#3b82f6" threshold={75} />
        </div>
      </div>
    </div>
  );
}

// Reusable Components

function StatCard({ title, value, status, subtitle }) {
  const statusColors = {
    normal: 'border-l-4 border-slate-300 text-slate-800',
    warning: 'border-l-4 border-amber-400 bg-amber-50 text-amber-900',
    danger: 'border-l-4 border-red-500 bg-red-50 text-red-900'
  };

  return (
    <div className={`bg-white rounded p-4 shadow-sm border border-slate-200 ${statusColors[status]}`}>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</h4>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1 font-mono">{subtitle}</div>}
    </div>
  )
}

function ChartCard({ title, data, dataKey, color, threshold }) {
   if (!data || data.length === 0) return null;

   // Formatting time for X-Axis
   const formattedData = data.map(d => ({
      ...d,
      timeString: new Date(d.ts).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' })
   }));

   return (
     <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">n = {data.length}</span>
        </div>
        <div className="h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="timeString" tick={{fontSize: 10, fill: '#64748B'}} tickMargin={8} minTickGap={30} />
              <YAxis tick={{fontSize: 10, fill: '#64748B'}} tickMargin={8} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '4px', border: '1px solid #E2E8F0', padding: '8px', fontSize: '12px' }} 
                labelStyle={{ fontWeight: 'bold', color: '#334155' }}
              />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
     </div>
   )
}