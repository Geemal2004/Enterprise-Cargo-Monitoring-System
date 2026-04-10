import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AlertsHistory from './pages/AlertsHistory.jsx';
import Layout from './components/Layout.jsx';
import { useStore } from './store/useStore.js';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const jwt = useStore(state => state.jwt);
  if (!jwt) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><AlertsHistory /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);