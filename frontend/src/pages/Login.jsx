import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../store/useStore';

export default function Login() {
  const navigate = useNavigate();
  const login = useStore(state => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
        username,
        password
      });
      // Store state
      login({ username: res.data.username, role: res.data.role, id: res.data._id }, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Cargo Monitor</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your Logistics account</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input 
              type="text" 
              className="w-full p-2 border border-slate-300 rounded focus:ring-brand-500 focus:border-brand-500 transition-colors"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full p-2 border border-slate-300 rounded focus:ring-brand-500 focus:border-brand-500 transition-colors"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required />
          </div>
          
          {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
          
          <button 
            type="submit" 
            className="w-full bg-brand-600 text-white font-medium py-2 px-4 rounded hover:bg-brand-900 transition-colors">
              Sign In
          </button>
        </form>
        
        <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
             Secure Logitics Operations Center
        </div>
      </div>
    </div>
  );
}