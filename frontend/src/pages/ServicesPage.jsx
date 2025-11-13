import React, { useEffect, useState } from 'react';
import kubernetesService from '../services/kubernetesService';
import ZenithCard from '../components/ZenithCard';

const ServicesPage = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    kubernetesService.getServices()
      .then(data => setServices(data))
      .catch(() => setServices([]));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🔧 Services</h1>
      {services.length === 0 ? (
        <p className="text-gray-400">Nessun servizio disponibile.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((svc) => (
            <ZenithCard key={`${svc.namespace}-${svc.name}`} title={svc.name} subtitle={svc.namespace}>
              <p><strong>Type:</strong> {svc.type}</p>
              <p><strong>Cluster IP:</strong> {svc.clusterIP}</p>
              <p><strong>Ports:</strong> {svc.ports.map(p => `${p.port}/${p.protocol}`).join(', ')}</p>
            </ZenithCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
