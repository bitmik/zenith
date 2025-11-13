import React from 'react';
import ZenithNavbar from './ZenithNavbar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-zenith-bg text-white font-orbitron">
      <ZenithNavbar />
      <main>{children}</main>
    </div>
  );
};

export default Layout;
