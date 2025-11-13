// src/pages/YAMLPage.jsx
import React from 'react';

const YAMLPage = () => {
  return (
    <div className="p-6 text-white font-orbitron">
      <h1 className="text-2xl font-bold mb-4">📝 YAML Editor</h1>
      <p className="text-gray-400 mb-2">
        Qui potrai incollare YAML Kubernetes per creare risorse manualmente.
      </p>
      <div className="bg-zenith-card border border-zenith-border rounded p-4 mt-4">
        <textarea
          rows={10}
          placeholder="Incolla YAML qui..."
          className="w-full bg-zenith-bg text-white border border-zenith-border p-3 rounded resize-none font-mono"
        />
        <button className="mt-3 px-4 py-2 bg-cyan-700 text-white rounded hover:bg-cyan-600">
          🚀 Applica
        </button>
      </div>
    </div>
  );
};

export default YAMLPage;
