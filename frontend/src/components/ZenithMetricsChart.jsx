// src/components/ZenithMetricsChart.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import ZenithCard from '../components/ZenithCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const ZenithMetricsChart = ({ dataPoints, label = 'CPU Usage', color = '#00ffe0' }) => {
  const chartData = {
    labels: dataPoints.map((_, i) => `${i}s`),
    datasets: [
      {
        label,
        data: dataPoints,
        fill: true,
        borderColor: color,
        backgroundColor: color + '22',
        pointRadius: 0,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1c23',
        titleColor: '#fff',
        bodyColor: color,
        borderColor: color,
        borderWidth: 1,
        padding: 8,
      },
    },
    scales: {
      x: {
        ticks: { color: '#888', font: { size: 10 } },
        grid: { color: '#2c2f36' },
      },
      y: {
        ticks: { color: '#888', font: { size: 10 } },
        grid: { color: '#2c2f36' },
      },
    },
  };

  return (
    <ZenithCard title="📈 CPU Trend (Last 30s)">
      <div className="h-48">
        <Line data={chartData} options={options} />
      </div>
    </ZenithCard>
  );
};

export default ZenithMetricsChart;
