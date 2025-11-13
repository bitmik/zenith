import React, { useState } from 'react';
import kubernetesService from '../services/kubernetesService';

const LoginPage = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await kubernetesService.login(username, password);
      if (!token) throw new Error('Token mancante');
      onSuccess(token);
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Login fallito';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-[#131722]/90 backdrop-blur-md border border-zenith-border rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.1)] p-8 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_25px_rgba(0,255,247,0.3)] animate-pulse">
          <span className="text-2xl">⚡</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-3 tracking-wide">Zenith Access</h1>
        <p className="text-sm text-gray-400">Autenticazione richiesta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-[#0f131d]/70 border border-zenith-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-all"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#0f131d]/70 border border-zenith-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-all"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold text-white shadow-[0_0_25px_rgba(0,255,247,0.35)] hover:shadow-[0_0_35px_rgba(0,255,247,0.5)] transition-all duration-300 disabled:opacity-50"
        >
          {loading ? 'Verifica...' : 'Accedi'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
