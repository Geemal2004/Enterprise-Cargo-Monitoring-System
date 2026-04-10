import { create } from 'zustand';

export const useStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  jwt: localStorage.getItem('jwt') || null,
  activeDeviceId: null,
  
  devices: [],
  telemetryLog: [], // Last 200 items max
  latestTelemetry: null,
  activeAlerts: [],
  
  login: (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('jwt', token);
    set({ user: userData, jwt: token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('jwt');
    set({
      user: null,
      jwt: null,
      activeDeviceId: null,
      telemetryLog: [],
      latestTelemetry: null,
      activeAlerts: [],
    });
  },

  setDevices: (devices) => set({ devices }),
  setActiveDevice: (id) => set({ activeDeviceId: id, telemetryLog: [], latestTelemetry: null }),
  setTelemetryLog: (data) => {
    const sorted = [...data].sort((a,b) => new Date(a.ts) - new Date(b.ts));
    set({
      telemetryLog: sorted.slice(-200),
      latestTelemetry: sorted[sorted.length - 1] || null
    });
  },

  appendTelemetry: (item) => {
    const list = get().telemetryLog;
    const newList = [...list, item].slice(-200);
    set({
      telemetryLog: newList,
      latestTelemetry: item
    });
  },

  addAlert: (alert) => {
     // Prepend the new alert onto alerts stack
     set(state => ({ activeAlerts: [alert, ...state.activeAlerts].slice(0, 5) }));
  },
  
  clearAlerts: () => set({ activeAlerts: [] })
}));