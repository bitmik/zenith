import React, { useEffect, useRef, useState } from 'react';
import kubernetesService from '../services/kubernetesService';

const PodTerminal = ({ pod, onClose }) => {
  const [output, setOutput] = useState([]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);
  const outputEndRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const ws = kubernetesService.openTerminal(pod.namespace, pod.name);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = event.data;
      setOutput(prev => [...prev, { type: 'output', text: data }]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setOutput(prev => [...prev, { type: 'error', text: '❌ Errore connessione\n' }]);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setOutput(prev => [...prev, { type: 'system', text: '--- Connessione chiusa ---\n' }]);
      setIsConnected(false);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pod.namespace, pod.name]);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Aggiungi comando all'output
      setOutput(prev => [...prev, { type: 'command', text: `$ ${input}\n` }]);
      
      // Invia al server
      wsRef.current.send(input + '\n');
      
      // Salva nella history
      setCommandHistory(prev => [...prev, input]);
      setHistoryIndex(-1);
      
      // Reset input
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Freccia su: comando precedente
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    }
    
    // Freccia giù: comando successivo
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        if (newIndex === commandHistory.length - 1 && historyIndex === commandHistory.length - 1) {
          setInput('');
          setHistoryIndex(-1);
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const clearTerminal = () => {
    setOutput([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl shadow-2xl w-11/12 h-5/6 flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-gray-800 rounded-t-xl border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center">
              💻 Terminal: {pod.name}
              {isConnected && <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              {!isConnected && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full"></span>}
            </h2>
            <p className="text-sm text-gray-400">Namespace: {pod.namespace}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={clearTerminal}
              className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm">
              🧹 Clear
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Terminal Output */}
        <div className="flex-1 overflow-auto bg-black p-4 font-mono text-sm">
          {output.map((line, index) => (
            <div key={index} className={
              line.type === 'command' ? 'text-green-400 font-bold' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'system' ? 'text-yellow-400' :
              'text-gray-300'
            }>
              {line.text}
            </div>
          ))}
          <div ref={outputEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-green-400 font-mono font-bold">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? "Digita un comando (premi ↑/↓ per history)..." : "Connessione in corso..."}
              className="flex-1 bg-gray-900 text-white px-3 py-2 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={!isConnected}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!isConnected}
              className={`px-4 py-2 rounded font-medium ${isConnected ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
              Send
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            💡 Tips: Usa ↑/↓ per navigare la history • Comandi: ls, pwd, cat, ps, env
          </div>
        </form>
      </div>
    </div>
  );
};

export default PodTerminal;
