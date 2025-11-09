import React, { useState, useEffect } from 'react';
import kubernetesService from '../services/kubernetesService';
import PodLogs from './PodLogs';
import PodTerminal from './PodTerminal';
import ServicesPanel from './ServicesPanel';

const Dashboard = () => {
  // Stati per i dati
  const [pods, setPods] = useState([]);
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  
  // Stati UI
  const [darkMode, setDarkMode] = useState(true);
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading solo iniziale (non refresh)
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Stati per azioni
  const [selectedPodForLogs, setSelectedPodForLogs] = useState(null);
  const [selectedPodForTerminal, setSelectedPodForTerminal] = useState(null);
  
  // Stati per operazioni (delete, restart, cleanup)
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    fetchData(true); // Initial load con loading
    
    // Refresh ogni 10 secondi in background (senza loading)
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isInitial = false) => {
    console.log(`🔄 ${isInitial ? 'Caricamento iniziale' : 'Refresh background'}`);
    
    if (isInitial) setInitialLoading(true);
    
    // Pods - sempre chiamata
    kubernetesService.getPods({ t: Date.now() })
      .then(podsData => {
        // Aggiorna sempre i pod per riflettere cambiamenti di stato e età
        console.log(`✅ Pods: ${podsData.length}`);
        setPods(podsData);
      })
      .catch(e => {
        console.error('❌ Pods error:', e.message);
        if (isInitial) setPods([]); // Solo initial setta vuoto
      })
      .finally(() => {
        if (isInitial) setInitialLoading(false);
      });

    // Stats - sempre chiamata
    kubernetesService.getDashboardStats()
      .then(statsData => {
        console.log(`📊 Stats: ${statsData?.pods?.total || 0} total`);
        setStats(statsData);
      })
      .catch(e => {
        console.error('❌ Stats error:', e.message);
        if (isInitial) setStats(null);
      });

    // Metrics - opzionale, non blocca
    kubernetesService.getPodMetrics('all')
      .then(metricsData => {
        console.log(`📏 Metrics: ${metricsData.items?.length || 0}`);
        setMetrics(metricsData);
      })
      .catch(e => {
        console.warn('⚠️  Metrics non disponibili (normale in K3s light):', e.message);
        setMetrics({ items: [] }); // Fallback vuoto, non blocca UI
      });

    if (isInitial) {
      console.log('🎉 Caricamento iniziale completato');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  const getPodMetrics = (podName, namespace) => {
    if (!metrics?.items || metrics.items.length === 0) return null;
    return metrics.items.find(m => 
      m.metadata.name === podName && m.metadata.namespace === namespace
    );
  };

  const formatCpu = (cpu) => {
    if (!cpu) return '0m';
    const match = cpu.match(/^(\d+)n$/);
    if (match) {
      return `${Math.round(parseInt(match[1]) / 1000000)}m`;
    }
    return cpu;
  };

  const formatMemory = (memory) => {
    if (!memory) return '0Mi';
    const match = memory.match(/^(\d+)Ki$/);
    if (match) {
      return `${Math.round(parseInt(match[1]) / 1024)}Mi`;
    }
    return memory;
  };

  const deletePod = async (pod) => {
    if (window.confirm(`Eliminare il pod ${pod.name}?`)) {
      setActionLoading(true);
      setError(null);
      try {
        await kubernetesService.deletePod(pod.namespace, pod.name);
        console.log('✅ Pod eliminato:', pod.name);
        setError(null);
        fetchData(false); // Refresh in background
      } catch (error) {
        console.error('❌ Errore delete pod:', error);
        setError(`Errore eliminazione: ${error.response?.data?.error || error.message}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const restartPod = async (pod) => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await kubernetesService.restartPod(pod.namespace, pod.name);
      console.log('✅ Pod riavviato:', result);
      setError(null);
      fetchData(false); // Refresh in background
    } catch (error) {
      console.error('❌ Errore restart pod:', error);
      setError(`Errore riavvio: ${error.response?.data?.error || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const cleanupStandalone = async () => {
    const standaloneCount = filteredPods.filter(p => !p.isManaged).length;
    if (standaloneCount === 0) {
      alert('Nessun pod standalone da pulire');
      return;
    }
    
    if (window.confirm(`Eliminare ${standaloneCount} pod standalone?`)) {
      setActionLoading(true);
      setError(null);
      try {
        const result = await kubernetesService.cleanupStandalone(
          selectedNamespace === 'all' ? 'default' : selectedNamespace
        );
        console.log('🧹 Cleanup completato:', result);
        alert(`✅ ${result.count || 0} pod eliminati`);
        setError(null);
        fetchData(false);
      } catch (error) {
        console.error('❌ Errore cleanup:', error);
        setError(`Errore cleanup: ${error.response?.data?.error || error.message}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const getFilteredPods = () => {
    let filtered = pods;
    
    if (selectedNamespace !== 'all') {
      filtered = filtered.filter(p => p.namespace === selectedNamespace);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.namespace.toLowerCase().includes(query) ||
        p.status?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const getStatusColor = (status) => {
    const colors = {
      'Running': 'bg-green-500',
      'Pending': 'bg-yellow-500', 
      'Failed': 'bg-red-500',
      'Succeeded': 'bg-green-400',
      'Completed': 'bg-green-400',
      'Unknown': 'bg-gray-500',
      'ContainerStatusUnknown': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const filteredPods = getFilteredPods();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-dark-card shadow-lg border-b border-gray-200 dark:border-dark-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.9,2.1l-6.5,3.8C3.5,6.4,3,7.3,3,8.2v7.6c0,0.9,0.5,1.8,1.4,2.2l6.5,3.8c0.8,0.5,1.9,0.5,2.8,0l6.5-3.8 c0.8-0.5,1.4-1.3,1.4-2.2V8.2c0-0.9-0.5-1.8-1.4-2.2l-6.5-3.8C12.8,1.6,11.7,1.6,10.9,2.1z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Zenith</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gestione Cluster Kubernetes</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative hidden md:block">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca pod..."
                  className="pl-10 pr-4 py-2 w-64 rounded-lg bg-gray-100 dark:bg-dark-bg border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>

              {/* Namespace selector */}
              <select 
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-dark-bg border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Tutti i Namespace</option>
                {stats?.namespaces?.list?.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                )) || <option disabled>Nessun namespace</option>}
              </select>
              
              {/* Dark mode toggle */}
              <button 
                onClick={toggleDarkMode}
                className="p-2.5 rounded-lg bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-gray-700 transition border border-gray-300 dark:border-dark-border"
                title="Toggle Dark Mode"
              >
                {darkMode ? (
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                  </svg>
                )}
              </button>

              {/* Cleanup button - solo per azioni */}
              <button 
                onClick={cleanupStandalone}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  actionLoading 
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
                }`}
                disabled={actionLoading || filteredPods.filter(p => !p.isManaged).length === 0}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 inline-block mr-2"></div>
                    Elaborazione...
                  </>
                ) : (
                  `🧹 Cleanup (${filteredPods.filter(p => !p.isManaged).length})`
                )}
              </button>
              
              {/* Refresh manuale */}
              <button 
                onClick={() => fetchData(true)}
                className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition font-medium"
                title="Refresh manuale"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading Iniziale - SOLO al primo avvio */}
        {initialLoading && (
          <div className="fixed inset-0 bg-white dark:bg-dark-bg flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Zenith</h2>
              <p className="text-gray-500 dark:text-gray-400">Connessione al cluster in corso...</p>
              <div className="flex justify-center space-x-2 mt-4">
                <div className="animate-pulse bg-gray-300 dark:bg-gray-700 h-3 w-3 rounded-full"></div>
                <div className="animate-pulse bg-gray-300 dark:bg-gray-700 h-3 w-3 rounded-full delay-75"></div>
                <div className="animate-pulse bg-gray-300 dark:bg-gray-700 h-3 w-3 rounded-full delay-150"></div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards - Sempre visibili dopo initial loading */}
        {!initialLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Pods Card */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-border hover:shadow-xl transition-shadow animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Pods Totali</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.pods?.total || filteredPods.length || 0}
                  </p>
                  <div className="flex items-center mt-2 space-x-2">
                    <span className="flex items-center text-xs text-green-600 dark:text-green-400">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      {stats?.pods?.running || filteredPods.filter(p => p.status === 'Running').length || 0} running
                    </span>
                    {stats?.pods?.failed > 0 && (
                      <span className="flex items-center text-xs text-red-600 dark:text-red-400">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                        {stats.pods.failed} failed
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl shadow-inner">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Deployments Card */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-border hover:shadow-xl transition-shadow animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Deployments</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.deployments?.total || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Con auto-scaling</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-xl shadow-inner">
                  <svg className="w-8 h-8 text-purple-600 dark:text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Services Card */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-border hover:shadow-xl transition-shadow animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Services</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.services?.total || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Network endpoints</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-xl shadow-inner">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Namespaces Card */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-border hover:shadow-xl transition-shadow animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Namespaces</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.namespaces?.total || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Isolamento risorse</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 rounded-xl shadow-inner">
                  <svg className="w-8 h-8 text-orange-600 dark:text-orange-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pods Table - SEMPRE visibile dopo initial loading */}
        {!initialLoading && (
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-lg border border-gray-200 dark:border-dark-border overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-gray-800">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pods Attivi</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span className="inline-flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Aggiornamento in tempo reale
                    </span>
                    <span className="mx-2">•</span>
                    <span className="font-medium">{filteredPods.length} visibili</span>
                    {stats && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Totali nel cluster: {stats.pods?.total || 0}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    filteredPods.filter(p => p.status === 'Running').length > 0
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    🟢 {filteredPods.filter(p => p.status === 'Running').length} Running
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    filteredPods.filter(p => p.status === 'Failed' || p.status === 'ContainerStatusUnknown').length > 0
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    🔴 {filteredPods.filter(p => p.status === 'Failed' || p.status === 'ContainerStatusUnknown').length} Failed
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    filteredPods.filter(p => p.isManaged).length > 0
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    🏢 {filteredPods.filter(p => p.isManaged).length} Managed
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    filteredPods.filter(p => !p.isManaged).length > 0
                      ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    ⚠️  {filteredPods.filter(p => !p.isManaged).length} Standalone
                  </span>
                </div>
              </div>
            </div>

            {/* Tabella pods - SEMPRE visibile */}
            {filteredPods.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pod</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-dark-border">
                    {filteredPods.map(pod => {
                      const podMetrics = getPodMetrics(pod.name, pod.namespace);
                      const podAge = pod.creationTimestamp 
                        ? new Date(Date.now() - new Date(pod.creationTimestamp)).toISOString().substr(11, 8)
                        : 'N/A';
                      
                      return (
                        <tr key={`${pod.namespace}-${pod.name}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                          <td className="px-6 py-5">
                            <div className="flex items-center">
                              <div className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg ${
                                pod.status === 'Running' 
                                  ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800' 
                                  : pod.status === 'Succeeded' || pod.status === 'Completed'
                                    ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800'
                                    : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700'
                              }`}>
                                <svg className={`w-5 h-5 ${
                                  pod.status === 'Running' ? 'text-green-600 dark:text-green-300' :
                                  pod.status === 'Succeeded' || pod.status === 'Completed' ? 'text-emerald-600 dark:text-emerald-300' :
                                  'text-gray-500 dark:text-gray-400'
                                }`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z"/>
                                </svg>
                              </div>
                              <div className="ml-4">
                                <div className="text-base font-medium text-gray-900 dark:text-white truncate max-w-xs" title={pod.name}>
                                  {pod.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                              {pod.namespace}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              pod.status === 'Running' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              pod.status === 'Succeeded' || pod.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' :
                              pod.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              pod.status === 'Failed' || pod.status === 'ContainerStatusUnknown' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              <span className={`w-2 h-2 mr-1.5 rounded-full ${
                                pod.status === 'Running' ? 'bg-green-500' :
                                pod.status === 'Succeeded' || pod.status === 'Completed' ? 'bg-emerald-400' :
                                pod.status === 'Pending' ? 'bg-yellow-500' :
                                pod.status === 'Failed' || pod.status === 'ContainerStatusUnknown' ? 'bg-red-500' :
                                'bg-gray-400'
                              }`}></span>
                              {pod.status === 'ContainerStatusUnknown' ? 'Unknown' : pod.status}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm">
                            <span className="font-mono text-xs text-cyan-400 dark:text-cyan-300">
                              {podMetrics ? formatCpu(podMetrics.containers[0]?.usage?.cpu) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm">
                            <span className="font-mono text-xs text-cyan-400 dark:text-cyan-300">
                              {podMetrics ? formatMemory(podMetrics.containers[0]?.usage?.memory) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            <span className="font-mono text-xs">{podAge}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            {pod.isManaged ? (
                              <span className="px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                                </svg>
                                Managed
                              </span>
                            ) : (
                              <span className="px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                                </svg>
                                Standalone
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium space-x-1">
                            <button 
                              onClick={() => setSelectedPodForLogs(pod)}
                              className={`p-1 rounded-lg transition ${
                                actionLoading 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900'
                              }`}
                              title="View Logs"
                              disabled={actionLoading}
                            >
                              📜
                            </button>
                            <button 
                              onClick={() => setSelectedPodForTerminal(pod)}
                              className={`p-1 rounded-lg transition ${
                                actionLoading 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 hover:bg-green-50 dark:hover:bg-green-900'
                              }`}
                              title="Open Terminal"
                              disabled={actionLoading}
                            >
                              💻
                            </button>
                            {pod.isManaged && (
                              <button 
                                onClick={() => restartPod(pod)}
                                className={`p-1 rounded-lg transition ${
                                  actionLoading 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900'
                                }`}
                                title="Restart"
                                disabled={actionLoading}
                              >
                                🔄
                              </button>
                            )}
                            {!pod.isManaged && (
                              <button 
                                onClick={() => deletePod(pod)}
                                className={`p-1 rounded-lg transition ${
                                  actionLoading 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900'
                                }`}
                                title="Delete"
                                disabled={actionLoading}
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : !initialLoading ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  {searchQuery || selectedNamespace !== 'all' ? 'Nessun pod trovato' : 'Nessun pod attivo'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery || selectedNamespace !== 'all' 
                    ? 'Prova a modificare i filtri di ricerca o attendi l\'aggiornamento'
                    : 'Tutti i pod sono in stato terminato. Prova a deployare nuove applicazioni.'
                  }
                </p>
                {stats && stats.pods?.total > 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    Totali nel cluster: {stats.pods.total} pod{stats.pods.total !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Services Panel - SEMPRE visibile */}
        {!initialLoading && <ServicesPanel />}

        {/* Error Toast - Solo per azioni */}
        {error && !actionLoading && (
          <div className="fixed top-4 right-4 z-50">
            <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 px-6 py-3 rounded-lg shadow-lg max-w-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <div>
                  <p className="font-medium">{error}</p>
                  <button 
                    onClick={() => setError(null)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm mt-1"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info - Solo in development */}
        {process.env.NODE_ENV === 'development' && !initialLoading && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
            <details className="cursor-pointer">
              <summary className="font-medium text-gray-700 dark:text-gray-300 mb-2">ℹ️  Informazioni Debug</summary>
              <div className="mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                <div>Pods caricati: {pods.length}</div>
                <div>Pods filtrati: {filteredPods.length}</div>
                <div>Stats disponibili: {stats ? `OK (${stats.pods?.total || 0} total)` : 'Caricamento...'}</div>
                <div>Metrics: {metrics?.items?.length || 0} (normalmente 0 senza metrics-server)</div>
                <div>Namespace attivo: {selectedNamespace}</div>
                <div>Ricerca: "{searchQuery}"</div>
                <div>Ultimo refresh: {new Date().toLocaleTimeString('it-IT')}</div>
                <button 
                  onClick={() => fetchData(true)}
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                >
                  🔄 Refresh Manuale
                </button>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Modals - Sempre disponibili */}
      {selectedPodForLogs && (
        <PodLogs 
          pod={selectedPodForLogs} 
          onClose={() => setSelectedPodForLogs(null)} 
        />
      )}

      {selectedPodForTerminal && (
        <PodTerminal 
          pod={selectedPodForTerminal} 
          onClose={() => setSelectedPodForTerminal(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
