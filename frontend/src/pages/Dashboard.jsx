import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import kubernetesService from '../services/kubernetesService';
import PodLogs from '../components/PodLogs';
import PodTerminal from '../components/PodTerminal';
import PodDiagnostics from '../components/PodDiagnostics';
import ServicesPanel from '../components/ServicesPanel';
import StatsCard from '../components/StatsCard';
import PodTable from '../components/PodTable';
import ZenithMetricsChart from '../components/ZenithMetricsChart';
import ZenithDonutChart from '../components/ZenithDonutChart';

const HIDE_COMPLETED_AFTER_MINUTES = 30;

const removeStaleCompletedPods = (podList) => {
  const cutoff = Date.now() - HIDE_COMPLETED_AFTER_MINUTES * 60 * 1000;
  return podList.filter((pod) => {
    if (!pod?.creationTimestamp) return pod?.status !== 'Succeeded';
    if (pod.status !== 'Succeeded') return true;
    return new Date(pod.creationTimestamp).getTime() >= cutoff;
  });
};

const Dashboard = () => {
  const [pods, setPods] = useState([]);
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPodForLogs, setSelectedPodForLogs] = useState(null);
  const [selectedPodForTerminal, setSelectedPodForTerminal] = useState(null);
  const [selectedPodForDiagnostics, setSelectedPodForDiagnostics] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const cpuHistoryRef = useRef([]);

  const donutMetrics = useMemo(() => {
    if (!pods.length) return [];
    const total = pods.length;
    const running = pods.filter(p => p.status === 'Running' || p.phase === 'Running').length;
    const pending = pods.filter(p => ['Pending', 'ContainerCreating', 'Creating', 'ImagePullBackOff'].includes(p.status)).length;
    const failed = pods.filter(p => ['Failed', 'CrashLoopBackOff', 'Error', 'Terminating'].includes(p.status)).length;
    return [
      { label: 'Pods Running', value: running, total, color: '#22d3ee' },
      { label: 'Pending / Creating', value: pending, total, color: '#facc15' },
      { label: 'Failed / Crash', value: failed, total, color: '#f472b6' }
    ];
  }, [pods]);

  const coreMetric = useMemo(() => {
    if (!pods.length) return null;
    const total = pods.length;
    const running = pods.filter(p => p.status === 'Running' || p.phase === 'Running').length;
    return {
      label: 'Running %',
      value: Math.round((running / total) * 1000) / 10,
      color: '#8b5cf6'
    };
  }, [pods]);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    try {
      const podsData = await kubernetesService.getPods({ t: Date.now() });
      setPods(removeStaleCompletedPods(podsData));
    } catch {
      if (isInitial) setPods([]);
    }

    try {
      const statsData = await kubernetesService.getDashboardStats();
      setStats(statsData);
    } catch {
      if (isInitial) setStats(null);
    }

    try {
      const metricsData = await kubernetesService.getPodMetrics('all');
      setMetrics(metricsData);

      const totalCPU = metricsData?.items?.reduce((sum, item) => {
        const cpu = item?.containers?.[0]?.usage?.cpu || '0n';
        const match = cpu.match(/^(\d+)n$/);
        return sum + (match ? parseInt(match[1], 10) / 1000000 : 0);
      }, 0) || 0;

      // Save last 20 datapoints
      cpuHistoryRef.current.push(totalCPU);
      if (cpuHistoryRef.current.length > 20) {
        cpuHistoryRef.current.shift();
      }
    } catch {
      setMetrics({ items: [] });
    }

    if (isInitial) setInitialLoading(false);
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const deletePod = async (pod) => {
    if (!window.confirm(`Eliminare il pod ${pod.name}?`)) return;
    setActionLoading(true);
    setError(null);
    try {
      await kubernetesService.deletePod(pod.namespace, pod.name);
      fetchData(false);
    } catch (err) {
      setError(`Errore eliminazione: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const restartPod = async (pod) => {
    setActionLoading(true);
    setError(null);
    try {
      await kubernetesService.restartPod(pod.namespace, pod.name);
      fetchData(false);
    } catch (err) {
      setError(`Errore riavvio: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const cleanupStandalone = async () => {
    const standalonePods = filteredPods.filter(p => !p.isManaged);
    if (!standalonePods.length) return alert('Nessun pod standalone da pulire');
    if (!window.confirm(`Eliminare ${standalonePods.length} pod standalone?`)) return;

    setActionLoading(true);
    setError(null);
    try {
      const result = await kubernetesService.cleanupStandalone(
        selectedNamespace === 'all' ? 'default' : selectedNamespace
      );
      alert(`✅ ${result.count || 0} pod eliminati`);
      fetchData(false);
    } catch (err) {
      setError(`Errore cleanup: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getPodMetrics = (name, ns) =>
    metrics?.items?.find(m => m.metadata.name === name && m.metadata.namespace === ns) || null;

  const formatCpu = (cpu) => {
    if (!cpu) return '0m';
    const match = cpu.match(/^(\d+)n$/);
    return match ? `${Math.round(parseInt(match[1], 10) / 1000000)}m` : cpu;
  };

  const formatMemory = (memory) => {
    if (!memory) return '0Mi';
    const match = memory.match(/^(\d+)Ki$/);
    return match ? `${Math.round(parseInt(match[1], 10) / 1024)}Mi` : memory;
  };

  const getFilteredPods = () => {
    return pods
      .filter(p => selectedNamespace === 'all' || p.namespace === selectedNamespace)
      .filter(p => {
        const q = searchQuery.toLowerCase();
        return (
          !searchQuery ||
          p.name.toLowerCase().includes(q) ||
          p.namespace.toLowerCase().includes(q) ||
          (p.status?.toLowerCase().includes(q))
        );
      });
  };

  const filteredPods = getFilteredPods();

  return (
    <div className="min-h-screen bg-zenith-bg text-white font-orbitron pb-12">
      <section className="px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Zenith Dashboard</p>
            <h1 className="text-3xl font-bold text-white mt-1">Cluster Control Room</h1>
            <p className="text-sm text-gray-400">Gestione e monitoraggio del tuo Kubernetes</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca pod..."
              className="px-4 py-2 rounded-lg bg-zenith-card/40 border border-zenith-border text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500"
            />
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="px-4 py-2 rounded-lg bg-zenith-card/40 border border-zenith-border text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">Tutti i Namespace</option>
              {stats?.namespaces?.list?.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <button
              onClick={cleanupStandalone}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                actionLoading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-red-900 text-red-300 hover:bg-red-800'
              }`}
              disabled={actionLoading || filteredPods.filter(p => !p.isManaged).length === 0}
            >
              🧹 Cleanup ({filteredPods.filter(p => !p.isManaged).length})
            </button>
            <button
              onClick={() => fetchData(true)}
              className="px-4 py-2 rounded-lg bg-cyan-800 text-cyan-200 hover:bg-cyan-700 font-medium shadow-neon"
              title="Refresh manuale"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </section>

      {/* LOADING */}
      {initialLoading && (
        <div className="fixed inset-0 bg-zenith-bg flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold text-white mb-2">Zenith</h2>
            <p className="text-gray-400">Connessione al cluster in corso...</p>
          </div>
        </div>
      )}

      {/* STATS */}
      {!initialLoading && stats && (
        <section className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard title="Pods" value={stats.pods?.total || 0} color="blue" />
          <StatsCard title="Deployments" value={stats.deployments?.total || 0} color="purple" />
          <StatsCard title="Services" value={stats.services?.total || 0} color="green" />
          <StatsCard title="Namespaces" value={stats.namespaces?.total || 0} color="orange" />
        </section>
      )}

      {!initialLoading && (
        <section className="px-6 mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pods.length > 0 && (
            <ZenithDonutChart
              title="Status Pods"
              subtitle="Running, pending e failure in tempo reale"
              metrics={donutMetrics}
              coreMetric={coreMetric}
            />
          )}
          {cpuHistoryRef.current.length > 0 && (
            <ZenithMetricsChart
              dataPoints={cpuHistoryRef.current}
              label="CPU Totale Pods"
              color="#00ffe0"
            />
          )}
        </section>
      )}

      {/* TABLE */}
      {!initialLoading && (
        <section className="px-6">
          <PodTable
            pods={filteredPods}
            metrics={metrics}
            formatCpu={formatCpu}
            formatMemory={formatMemory}
            getPodMetrics={getPodMetrics}
            deletePod={deletePod}
            restartPod={restartPod}
            setSelectedPodForLogs={setSelectedPodForLogs}
            setSelectedPodForTerminal={setSelectedPodForTerminal}
            setSelectedPodForDiagnostics={setSelectedPodForDiagnostics}
            actionLoading={actionLoading}
          />
        </section>
      )}

      {/* SERVICES */}
      {!initialLoading && (
        <section className="px-6 mt-6">
          <ServicesPanel />
        </section>
      )}

      {/* LOGS / TERMINAL */}
      {selectedPodForLogs && (
        <PodLogs pod={selectedPodForLogs} onClose={() => setSelectedPodForLogs(null)} />
      )}
      {selectedPodForTerminal && (
        <PodTerminal pod={selectedPodForTerminal} onClose={() => setSelectedPodForTerminal(null)} />
      )}
      {selectedPodForDiagnostics && (
        <PodDiagnostics
          pod={selectedPodForDiagnostics}
          onClose={() => setSelectedPodForDiagnostics(null)}
        />
      )}

      {/* ERROR TOAST */}
      {error && !actionLoading && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 px-6 py-3 rounded-lg shadow-lg max-w-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-4 text-sm text-red-400 hover:text-red-200"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
