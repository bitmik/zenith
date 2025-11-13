// src/components/ZenithCard.jsx
import React from 'react';

const ZenithCard = ({ title, subtitle, children }) => {
  return (
    <div className="bg-zenith-card border border-zenith-border rounded-xl shadow-neon mb-6 overflow-hidden">
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-zenith-border bg-[#16181f]">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

export default ZenithCard;
