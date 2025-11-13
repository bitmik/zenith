import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ZenithCard from './ZenithCard';

ChartJS.register(ArcElement, Tooltip, Legend);

const fallbackMetrics = [
  { label: 'CPU', value: 45, total: 100, color: '#00ffe0' },
  { label: 'Memory', value: 60, total: 100, color: '#ff7ac3' },
  { label: 'Pods OK', value: 80, total: 100, color: '#6ee7b7' }
];

const getColorFromValue = (value) => {
  if (value <= 40) return '#f43f5e';       // rosso
  if (value <= 70) return '#facc15';       // arancio
  return '#00ffe0';                        // azzurro Zenith
};

const ZenithDonutChart = ({
  title = 'Cluster Pulse',
  subtitle = 'Panoramica percentuale',
  metrics = fallbackMetrics,
  coreMetric = { label: 'Health', value: 90 }
}) => {
  const safeMetrics = metrics.length ? metrics : fallbackMetrics;
  const gaugeValue = Math.max(0, Math.min(100, coreMetric.value || 0));
  const dynamicColor = getColorFromValue(gaugeValue);

  const chartData = useMemo(() => ({
    labels: ['Used', 'Remaining'],
    datasets: [
      {
        label: coreMetric.label,
        data: [gaugeValue, 100 - gaugeValue],
        backgroundColor: [dynamicColor, 'rgba(255,255,255,0.05)'],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
        cutout: '72%',
      }
    ]
  }), [coreMetric.label, gaugeValue, dynamicColor]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: true,
      duration: 1000
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1117',
        borderColor: dynamicColor,
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#fff'
      }
    }
  }), [dynamicColor]);

  return (
    <ZenithCard title={title} subtitle={subtitle}>
      <div className="flex flex-col lg:flex-row gap-6 items-center">
        {/* GAUGE */}
        <div className="relative w-52 h-28">
          <Doughnut data={chartData} options={options} />
          <div className="absolute inset-0 top-[45%] flex flex-col items-center justify-center pointer-events-none text-center z-10">
            <span className="text-[11px] uppercase tracking-widest text-gray-500">
              {coreMetric.label}
            </span>
            <span
              className="text-3xl font-semibold tracking-wide"
              style={{ color: dynamicColor }}
            >
              {gaugeValue}%
            </span>
          </div>
        </div>

        {/* METRICHE DETTAGLIATE */}
        <div className="flex-1 space-y-3">
          {safeMetrics.map((metric, idx) => {
            const total = metric.total || 1;
            const percentage = total === 0 ? 0 : Math.round((metric.value / total) * 1000) / 10;
            return (
              <div key={`${metric.label}-${idx}`} className="flex items-center justify-between bg-[#10131b] border border-zenith-border rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">{metric.label}</p>
                  <p className="text-lg font-semibold text-white">
                    {metric.value}
                    <span className="text-sm text-gray-400"> / {metric.total}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold" style={{ color: metric.color }}>{percentage}%</span>
                  <div className="w-28 h-1.5 bg-[#1c1f2b] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, percentage))}%`,
                        background: metric.color
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ZenithCard>
  );
};

export default ZenithDonutChart;
