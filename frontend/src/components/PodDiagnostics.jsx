import React, { useEffect, useState } from 'react';
import kubernetesService from '../services/kubernetesService';

const PodDiagnostics = ({ pod, onClose }) => {
  const [events, setEvents] = useState([]);
  const [describeOutput, setDescribeOutput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pod) return;
    setLoading(true);
    setError(null);
    Promise.all([
      kubernetesService.getPodEvents(pod.namespace, pod.name),
      kubernetesService.describePod(pod.namespace, pod.name)
    ])
      .then(([eventsResp, describeResp]) => {
        setEvents(eventsResp || []);
        setDescribeOutput(describeResp?.output || '');
      })
      .catch(() => {
        setError('Impossibile recuperare diagnostica pod');
      })
      .finally(() => setLoading(false));
  }, [pod]);

  const renderEvents = () => {
    if (loading) return <div className="text-gray-400">Caricamento eventi...</div>;
    if (error) return <div className="text-red-400">{error}</div>;
    if (!events.length) return <div className="text-gray-400">Nessun evento recente.</div>;

    return (
      <ul className="space-y-3">
        {events.map((event, idx) => (
          <li key={`${event.reason}-${idx}`} className="p-3 bg-[#151922] rounded border border-zenith-border">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white">{event.reason || 'Evento'}</span>
              <span className="text-gray-400 text-xs">{event.lastTimestamp || event.firstTimestamp || '—'}</span>
            </div>
            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{event.message}</p>
            <div className="text-xs text-gray-500 mt-1">
              {event.type} · {event.count || 1} occorrenze
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zenith-card rounded-xl border border-zenith-border shadow-neon w-11/12 max-w-5xl h-5/6 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zenith-border bg-[#16181f]">
          <div>
            <h2 className="text-white font-semibold text-lg">🩺 Diagnostica: {pod.name}</h2>
            <p className="text-sm text-gray-400">Namespace: {pod.namespace}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded bg-red-500 text-white text-sm hover:bg-red-600">Chiudi</button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
          <div className="p-4 overflow-auto border-b lg:border-b-0 lg:border-r border-zenith-border">
            <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-wider mb-3">Eventi Recenti</h3>
            {renderEvents()}
          </div>
          <div className="p-4 overflow-auto bg-[#10141b]">
            <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-wider mb-3">kubectl describe</h3>
            {loading && <div className="text-gray-400">Caricamento describe...</div>}
            {!loading && describeOutput && (
              <pre className="text-xs text-gray-200 whitespace-pre-wrap break-words">{describeOutput}</pre>
            )}
            {!loading && !describeOutput && !error && (
              <div className="text-gray-400">Nessun output disponibile.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodDiagnostics;
