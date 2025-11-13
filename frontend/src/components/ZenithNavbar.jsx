import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/pods', label: 'Pods' },
  { to: '/deployments', label: 'Deployments' },
  { to: '/services', label: 'Services' },
  { to: '/metrics', label: 'Metrics' },
  { to: '/yaml', label: 'YAML' },
];

const ZenithNavbar = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);

  const renderLinks = (extraClasses = '') => (
    <div className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-3 ${extraClasses}`}>
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          onClick={() => setIsOpen(false)}
          className={({ isActive }) =>
            `transition px-3 py-2 rounded-md text-sm font-semibold ${
              isActive
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-neon'
                : 'text-gray-400 hover:text-cyan-300'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );

  return (
    <nav className="bg-zenith-card border-b border-zenith-border shadow sticky top-0 z-50">
      <div className="px-6 py-3 flex items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.9,2.1l-6.5,3.8C3.5,6.4,3,7.3,3,8.2v7.6c0,0.9,0.5,1.8,1.4,2.2l6.5,3.8c0.8,0.5,1.9,0.5,2.8,0l6.5-3.8 c0.8-0.5,1.4-1.3,1.4-2.2V8.2c0-0.9-0.5-1.8-1.4-2.2l-6.5-3.8C12.8,1.6,11.7,1.6,10.9,2.1z" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Zenith</p>
            <h1 className="text-lg font-bold text-white">Ops Console</h1>
          </div>
        </div>

        <button
          className="md:hidden p-2 rounded-lg border border-zenith-border text-gray-300 hover:text-white"
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Toggle navigation"
        >
          {isOpen ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <div className="hidden md:flex items-center gap-3 ml-auto">
          {renderLinks('justify-end')}
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg border border-zenith-border text-sm font-semibold text-gray-300 hover:text-white hover:border-cyan-400"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-zenith-border px-6 pb-4">
          {renderLinks('mt-3')}
          {onLogout && (
            <button
              onClick={() => { setIsOpen(false); onLogout(); }}
              className="w-full mt-3 px-4 py-2 rounded-lg border border-zenith-border text-sm font-semibold text-gray-300 hover:text-white"
            >
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default ZenithNavbar;
