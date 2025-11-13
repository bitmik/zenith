// src/components/StatsCard.jsx
import React from 'react';
import ZenithCard from '../components/ZenithCard';

const colorMap = {
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  green: 'text-green-400',
  orange: 'text-orange-400',
};

const StatsCard = ({ title, value, color = 'blue' }) => (
  <ZenithCard>
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-400">{title}</span>
      <span className={`text-2xl font-bold ${colorMap[color] || 'text-white'}`}>{value}</span>
    </div>
  </ZenithCard>
);

export default StatsCard;
