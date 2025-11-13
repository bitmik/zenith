import React, { useEffect, useRef, useState } from 'react';
import kubernetesService from '../services/kubernetesService';

const PodLogs = ({ pod, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const logsEndRef = useRef(null);
  const wsRef = useRef(null);

  // Effect to fetch pod details and set initial container
  useEffect(() => {
    const fetchPodDetails = async () => {
      try {
        const details = await kubernetesService.getPodDetails(pod.namespace, pod.name);
        if (details && details.containers && details.containers.length > 0) {
          setContainers(details.containers);
          setSelectedContainer(details.containers[0].name); // Select the first container by default
        }
      } catch (error) {
        console.error('Error fetching pod details:', error);
        setLogs(prev => [...prev, '❌ ERROR: Impossibile recuperare dettagli pod.']);
      }
    };
    fetchPodDetails();
  }, [pod.namespace, pod.name]);

  // Effect for WebSocket connection
  useEffect(() => {
    if (!selectedContainer) return; // Don't connect until a container is selected

    // Close existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = kubernetesService.streamLogs(pod.namespace, pod.name, selectedContainer);
    wsRef.current = ws;

    setLogs([]); // Clear logs on new connection
    setIsConnected(false); // Reset connection status

    ws.onopen = () => {
      setIsConnected(true);
      setLogs(prev => [...prev, `🔌 Connesso a ${pod.name}/${selectedContainer}`]);
    };

    ws.onmessage = (event) => {
      const data = event.data.toString();
      setLogs(prev => [...prev, data]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setLogs(prev => [...prev, '❌ ERROR: Connessione persa']);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setLogs(prev => [...prev, '--- Stream chiuso ---']);
      setIsConnected(false);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pod.namespace, pod.name, selectedContainer]); // Reconnect when selectedContainer changes

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearLogs = () => setLogs([]);

  const handleContainerChange = (event) => {
    setSelectedContainer(event.target.value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl w-11/12 h-5/6 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              📜 Logs: {pod.name}
              {selectedContainer && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({selectedContainer})</span>}
              {isConnected && <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Namespace: {pod.namespace}</p>
          </div>
          <div className="flex items-center space-x-2">
            {containers.length > 1 && (
              <select
                value={selectedContainer || ''}
                onChange={handleContainerChange}
                className="px-3 py-1 rounded text-sm font-medium bg-gray-200 dark:bg-dark-bg text-gray-700 dark:text-white border border-gray-300 dark:border-dark-border"
              >
                {containers.map(container => (
                  <option key={container.name} value={container.name}>
                    {container.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1 rounded text-sm font-medium ${autoScroll ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
              Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium">
              🧹 Clear
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium">
              ✕ Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-xs text-green-400">
          {logs.length === 0 && !isConnected ? (
            <div className="text-gray-500 text-center py-8">Caricamento logs...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap break-all hover:bg-gray-800">
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default PodLogs;
