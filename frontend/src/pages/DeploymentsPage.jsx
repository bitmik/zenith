import React, { useEffect, useMemo, useState } from 'react';
import kubernetesService from '../services/kubernetesService';
import ZenithCard from '../components/ZenithCard';

const DeploymentsPage = () => {
  const [deployments, setDeployments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyDeployment, setBusyDeployment] = useState(null);
  const [statusByDeployment, setStatusByDeployment] = useState({});

  const actionButtonBase = 'inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(0,255,247,0.25)]';
  const buttonVariants = {
    scale: `${actionButtonBase} bg-gradient-to-r from-cyan-500/80 to-blue-500/80 border-cyan-400/40 hover:from-cyan-400 hover:to-blue-400 text-white`,
    restart: `${actionButtonBase} bg-gradient-to-r from-amber-500/80 to-orange-500/80 border-orange-300/40 hover:from-amber-400 hover:to-orange-400 text-white`,
    status: `${actionButtonBase} bg-[#111827] border-cyan-500/30 text-cyan-200 hover:border-cyan-300 hover:text-white`,
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [deps, svcs] = await Promise.all([
        kubernetesService.getDeployments(),
        kubernetesService.getServices()
      ]);
      setDeployments(deps || []);
      setServices(svcs || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Errore nel recupero delle risorse');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const keyForDeployment = (dep) => `${dep.namespace}/${dep.name}`;

  const matchServices = useMemo(() => {
    return services.reduce((acc, svc) => {
      acc[`${svc.namespace}/${svc.selector?.app || svc.name}`] = acc[`${svc.namespace}/${svc.selector?.app || svc.name}`] || [];
      acc[`${svc.namespace}/${svc.selector?.app || svc.name}`].push(svc);
      return acc;
    }, {});
  }, [services]);

  const handleScale = async (dep) => {
    const replicas = window.prompt(`Nuovo numero di replicas per ${dep.name}`, dep.replicas);
    if (replicas === null) return;
    const value = parseInt(replicas, 10);
    if (Number.isNaN(value) || value < 0) {
      alert('Inserisci un numero valido.');
      return;
    }
    setBusyDeployment(keyForDeployment(dep));
    try {
      await kubernetesService.scaleDeployment(dep.namespace, dep.name, value);
      fetchData();
    } catch (err) {
      alert(`Errore nello scaling: ${err?.response?.data?.error || err.message}`);
    } finally {
      setBusyDeployment(null);
    }
  };

  const handleRestart = async (dep) => {
    if (!window.confirm(`Riavviare il deployment ${dep.name}?`)) return;
    setBusyDeployment(keyForDeployment(dep));
    try {
      await kubernetesService.restartDeployment(dep.namespace, dep.name);
      fetchData();
    } catch (err) {
      alert(`Errore nel riavvio: ${err?.response?.data?.error || err.message}`);
    } finally {
      setBusyDeployment(null);
    }
  };

  const handleStatus = async (dep) => {
    setBusyDeployment(keyForDeployment(dep));
    try {
      const status = await kubernetesService.getDeploymentStatus(dep.namespace, dep.name);
      setStatusByDeployment((prev) => ({ ...prev, [keyForDeployment(dep)]: status }));
    } catch (err) {
      alert(`Errore nel recupero dello status: ${err?.response?.data?.error || err.message}`);
    } finally {
      setBusyDeployment(null);
    }
  };

  const renderConditions = (deploymentKey) => {
    const condSource = statusByDeployment[deploymentKey]?.conditions || deployments.find(dep => keyForDeployment(dep) === deploymentKey)?.conditions || [];
    if (!condSource?.length) {
      return <p className="text-gray-500 text-sm">Nessuna condition disponibile.</p>;
    }
    return (
      <ul className="text-sm text-gray-200 space-y-1">
        {condSource.map((cond) => (
          <li key={`${deploymentKey}-${cond.type}`} className="flex items-start justify-between">
            <span className="font-medium">{cond.type}</span>
            <span className={`text-xs ${cond.status === 'True' ? 'text-green-400' : 'text-yellow-300'}`}>
              {cond.status}
              {cond.reason ? ` · ${cond.reason}` : ''}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const renderServices = () => {
    if (!services.length) {
      return <p className="text-gray-400">Nessun service configurato.</p>;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((svc) => (
          <div key={`${svc.namespace}-${svc.name}`} className="p-4 border border-zenith-border rounded-lg bg-[#11131b]">
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="text-white font-semibold">{svc.name}</p>
                <p className="text-xs text-gray-400">Namespace: {svc.namespace}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-[#1f2430] text-cyan-300">{svc.type}</span>
            </div>
            <p className="text-sm text-gray-300"><strong>Cluster IP:</strong> {svc.clusterIP || '—'}</p>
            {svc.externalIP && <p className="text-sm text-gray-300"><strong>External IP:</strong> {svc.externalIP}</p>}
            <p className="text-sm text-gray-300 mt-2">
              <strong>Porte:</strong> {svc.ports.map((p) => `${p.port}:${p.targetPort}/${p.protocol}${p.nodePort ? ` (node ${p.nodePort})` : ''}`).join(', ')}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderDeploymentCards = () => {
    if (loading) {
      return <p className="text-gray-400">Caricamento deployments...</p>;
    }
    if (!deployments.length) {
      return <p className="text-gray-400">Nessun deployment trovato.</p>;
    }
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {deployments.map((dep) => {
          const depKey = keyForDeployment(dep);
          const statusInfo = statusByDeployment[depKey];
          const foundServices = matchServices[`${dep.namespace}/${dep.labels?.app || dep.name}`] || [];
          return (
            <ZenithCard
              key={depKey}
              title={dep.name}
              subtitle={`${dep.namespace} • creato ${dep.creationTimestamp ? new Date(dep.creationTimestamp).toLocaleString() : '—'}`}
            >
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <p className="text-xs uppercase text-gray-400">Desired</p>
                  <p className="text-2xl text-white font-semibold">{dep.replicas}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400">Ready</p>
                  <p className="text-2xl text-green-300 font-semibold">{dep.readyReplicas || 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400">Updated</p>
                  <p className="text-lg text-white">{dep.updatedReplicas || 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400">Available</p>
                  <p className="text-lg text-white">{dep.availableReplicas || 0}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase text-gray-400 mb-2">Conditions</p>
                {renderConditions(depKey)}
              </div>

              {statusInfo && (
                <div className="mt-3 text-xs text-gray-400 border border-zenith-border rounded p-2">
                  <p className={statusInfo.rolloutComplete ? 'text-green-400 font-semibold' : 'text-yellow-300 font-semibold'}>
                    Rollout {statusInfo.rolloutComplete ? 'completato' : 'in corso'}
                  </p>
                  <p>Updated: {statusInfo.updatedReplicas}/{statusInfo.desiredReplicas}</p>
                  <p>Available: {statusInfo.availableReplicas}/{statusInfo.desiredReplicas}</p>
                </div>
              )}

              {foundServices.length > 0 && (
                <div className="mt-4 text-sm text-gray-300">
                  <p className="text-xs uppercase text-gray-400 mb-1">Servizi collegati</p>
                  <ul className="space-y-1">
                    {foundServices.map((svc) => (
                      <li key={`${svc.namespace}-${svc.name}`} className="flex items-center justify-between">
                        <span>{svc.name}</span>
                        <span className="text-xs text-gray-400">{svc.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={() => handleScale(dep)}
                  disabled={busyDeployment === depKey}
                  className={buttonVariants.scale}
                >
                  <span className="text-base">⚡</span>
                  <span>Scale</span>
                </button>
                <button
                  onClick={() => handleRestart(dep)}
                  disabled={busyDeployment === depKey}
                  className={buttonVariants.restart}
                >
                  <span className="text-base">♻</span>
                  <span>Restart</span>
                </button>
                <button
                  onClick={() => handleStatus(dep)}
                  disabled={busyDeployment === depKey}
                  className={buttonVariants.status}
                >
                  <span className="text-base">📊</span>
                  <span>Rollout</span>
                </button>
              </div>
            </ZenithCard>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📦 Deployments & Services</h1>
          <p className="text-gray-400">Gestisci scaling rapido, rollout status e endpoint esposti.</p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded bg-cyan-600 text-white text-sm hover:bg-cyan-500"
        >
          ↻ Aggiorna
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {renderDeploymentCards()}

      <ZenithCard title="🔧 Services" subtitle="Panoramica dei servizi esposti">
        {renderServices()}
      </ZenithCard>
    </div>
  );
};

export default DeploymentsPage;
