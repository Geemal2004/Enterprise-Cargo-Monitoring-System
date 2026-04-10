import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function Layout({ children }) {
  const user = useStore(state => state.user);
  const logout = useStore(state => state.logout);
  const location = useLocation();

  const navItem = (path, name) => {
    const isActive = location.pathname.startsWith(path);
    return (
      <Link 
        to={path} 
        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
          isActive 
            ? "bg-slate-100 text-brand-600" 
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}>
        {name}
      </Link>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo area */}
            <div className="flex items-center space-x-8">
              <span className="text-xl font-bold text-slate-800 tracking-tight">CargoOps</span>
              <nav className="hidden md:flex space-x-2">
                {navItem('/dashboard', 'Live Dashboard')}
                {navItem('/alerts', 'Alerts History')}
              </nav>
            </div>
            
            {/* User area */}
            <div className="flex items-center space-x-4">
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-800">{user?.username}</span>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{user?.role}</span>
              </div>
              <button 
                onClick={logout}
                className="text-sm text-slate-500 hover:text-red-600 font-medium py-1 px-3 border border-transparent hover:bg-red-50 rounded transition-colors">
                Sign Out
              </button>
            </div>
            
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}