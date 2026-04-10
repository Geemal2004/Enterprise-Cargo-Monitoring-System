import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';

export default function AlertsHistory() {
  const { jwt, activeDeviceId, devices } = useStore();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeDeviceId) return;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/alerts/${activeDeviceId}`, {
          headers: { Authorization: `Bearer ${jwt}` }
        });
        setAlerts(res.data);
      } catch (err) {
        console.error("Failed to load alerts");
      }
      setLoading(false);
    };

    fetchAlerts();
  }, [activeDeviceId, jwt]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      
      <div className="p-6 border-b border-slate-200">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-800">Alerts History</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-500">Filter Device:</span>
            {/* Same select logic as dashboard. Keeping it explicitly tied to Global store activeDeviceId */}
             <select 
              className="border-slate-300 rounded text-sm py-1.5 px-3 focus:ring-brand-500 shadow-sm bg-slate-50 cursor-pointer"
              value={activeDeviceId || ''}
              onChange={(e) => useStore.getState().setActiveDevice(e.target.value)}
            >
              <option value="" disabled>Select Device</option>
              {devices.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-slate-500">Showing last 100 historical incidents for the selected tracking unit.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="lowercase bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4">Timestamp (UTC)</th>
              <th className="px-6 py-4">Device ID</th>
              <th className="px-6 py-4">Alert Type</th>
              <th className="px-6 py-4">Value Recorded</th>
              <th className="px-6 py-4">Threshold Rule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
            {loading && (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-slate-500 border-t border-slate-200">
                  <div className="flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Fetching Logs...
                  </div>
                </td>
              </tr>
            )}
            
            {!loading && alerts.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-sans">
                  No historical alerts found for this unit.
                </td>
              </tr>
            )}

            {!loading && alerts.map((alert) => (
              <tr key={alert._id} className="hover:bg-red-50/50 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                  {new Date(alert.ts).toLocaleString()}
                </td>
                <td className="px-6 py-4 font-semibold text-slate-700">{alert.device_id}</td>
                <td className="px-6 py-4 capitalize font-sans font-medium text-red-600 tracking-wide">
                   {alert.type} Intrusion
                </td>
                <td className="px-6 py-4 font-bold tracking-tight text-slate-900 border-l border-slate-100">
                   {typeof alert.value === 'boolean' ? (alert.value ? 'DETECTED' : 'CLEAR') : Number(alert.value).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {'>'} {alert.threshold}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}