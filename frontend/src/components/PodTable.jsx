import React from 'react';

// Utility per calcolare l'età del pod
const getPodAge = (timestamp) => {
  if (!timestamp) return '-';
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

const PodTable = ({
  pods,
  metrics,
  formatCpu,
  formatMemory,
  getPodMetrics,
  deletePod,
  restartPod,
  setSelectedPodForLogs,
  setSelectedPodForTerminal,
  setSelectedPodForDiagnostics,
  actionLoading
}) => {
  if (!pods.length) {
    return (
      <div className="text-center text-gray-400 mt-8">
        Nessun pod trovato.
      </div>
    );
  }

  return (
    <div className="bg-zenith-card border border-zenith-border rounded-xl shadow-neon overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-[#1c1e26] text-xs text-gray-400 uppercase tracking-wider">
          <tr>
            <th className="px-6 py-3 text-left">Pod</th>
            <th className="px-6 py-3 text-left">Namespace</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-left">CPU</th>
            <th className="px-6 py-3 text-left">Memory</th>
            <th className="px-6 py-3 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody className="text-sm text-white divide-y divide-gray-800">
          {pods.map((pod) => {
            const metricsData = getPodMetrics(pod.name, pod.namespace);
            const cpu = metricsData?.containers?.[0]?.usage?.cpu;
            const mem = metricsData?.containers?.[0]?.usage?.memory;

            const statusColor = {
              Running: 'bg-green-900 text-green-300',
              Pending: 'bg-yellow-900 text-yellow-300',
              Failed: 'bg-red-900 text-red-300',
              Succeeded: 'bg-blue-900 text-blue-300',
              Terminating: 'bg-orange-900 text-orange-200',
              CrashLoopBackOff: 'bg-red-900 text-red-200',
              Unknown: 'bg-gray-700 text-gray-300',
            };

            const statusClass = statusColor[pod.status] || 'bg-gray-800 text-white';

            return (
              <tr
                key={`${pod.namespace}-${pod.name}`}
                className="transition duration-150 hover:bg-[#0f1f26] hover:shadow-[0_0_10px_#00fff7] hover:ring-1 hover:ring-cyan-500 group"
              >
                <td className="px-6 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">{pod.name}</span>
                    <span className="text-xs text-gray-400 mt-0.5">
                      🕒 {getPodAge(pod.creationTimestamp)}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-3 text-gray-400 group-hover:text-cyan-300">
                  {pod.namespace}
                </td>

                <td className="px-6 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold inline-flex flex-col ${statusClass}`}
                    title={pod.reason || pod.status}
                  >
                    <span>{pod.status}</span>
                    {pod.phase && pod.phase !== pod.status && (
                      <span className="text-[10px] opacity-80">
                        phase: {pod.phase}
                      </span>
                    )}
                  </span>
                </td>

                <td className="px-6 py-3 font-mono text-cyan-300">
                  {cpu ? formatCpu(cpu) : 'N/A'}
                </td>

                <td className="px-6 py-3 font-mono text-cyan-300">
                  {mem ? formatMemory(mem) : 'N/A'}
                </td>

                <td className="px-6 py-3 text-right space-x-2">
                  <button
                    onClick={() => setSelectedPodForLogs(pod)}
                    className="text-blue-400 hover:text-blue-200 transition"
                    disabled={actionLoading}
                    title="Log"
                  >
                    📜
                  </button>
                  <button
                    onClick={() => setSelectedPodForTerminal(pod)}
                    className="text-green-400 hover:text-green-200 transition"
                    disabled={actionLoading}
                    title="Terminal"
                  >
                    💻
                  </button>
                  <button
                    onClick={() => setSelectedPodForDiagnostics(pod)}
                    className="text-cyan-400 hover:text-cyan-200 transition"
                    disabled={actionLoading}
                    title="Diagnostica"
                  >
                    ⚠️
                  </button>

                  {pod.isManaged ? (
                    <button
                      onClick={() => restartPod(pod)}
                      className="text-yellow-400 hover:text-yellow-200 transition"
                      disabled={actionLoading}
                      title="Restart"
                    >
                      ☠️
                    </button>
                  ) : (
                    <button
                      onClick={() => deletePod(pod)}
                      className="text-red-400 hover:text-red-200 transition"
                      disabled={actionLoading}
                      title="Delete"
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
  );
};

export default PodTable;
