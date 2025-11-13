// src/components/ServicesPanel.jsx
import React, { useEffect, useState } from 'react';
import kubernetesService from '../services/kubernetesService';
import ZenithCard from '../components/ZenithCard';

const ServicesPanel = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchServices = async () => {
    try {
      const data = await kubernetesService.getServices();
      setServices(data);
    } catch (err) {
      console.error('Errore fetch servizi:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ZenithCard title="🌐 Services & Endpoints" subtitle="Network endpoints e load balancers">
        <div className="text-gray-400">Caricamento servizi...</div>
      </ZenithCard>
    );
  }

  return (
    <ZenithCard title="🌐 Services & Endpoints" subtitle="Network endpoints e load balancers">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700 text-sm">
          <thead className="text-gray-300 bg-[#1c1e26]">
            <tr>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Namespace</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Cluster IP</th>
              <th className="px-4 py-3 text-left">External IP</th>
              <th className="px-4 py-3 text-left">Ports</th>
            </tr>
          </thead>
          <tbody className="text-white divide-y divide-gray-800">
            {services.map(svc => (
              <tr
                key={`${svc.namespace}-${svc.name}`}
                className="hover:bg-[#0f1f26] hover:shadow-[0_0_10px_#00fff7] transition"
              >
                <td className="px-4 py-2 font-semibold text-white">{svc.name}</td>
                <td className="px-4 py-2 text-gray-300">{svc.namespace}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    svc.type === 'LoadBalancer'
                      ? 'bg-purple-900 text-purple-300'
                      : svc.type === 'NodePort'
                      ? 'bg-blue-900 text-blue-300'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {svc.type}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-cyan-400">{svc.clusterIP || '-'}</td>
                <td className="px-4 py-2 font-mono text-green-400">{svc.externalIP || '-'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {svc.ports?.map((port, idx) => (
                      <span key={idx} className="bg-cyan-800 text-cyan-100 px-2 py-1 rounded text-xs font-mono">
                        {port.port}:{port.targetPort}{port.nodePort && ` (${port.nodePort})`}/{port.protocol}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-4 text-center text-gray-400">
                  Nessun servizio trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ZenithCard>
  );
};

export default ServicesPanel;
