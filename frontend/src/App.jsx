import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ZenithNavbar from './components/ZenithNavbar';

import Dashboard from './pages/Dashboard';
import DeploymentsPage from './pages/DeploymentsPage';
import ServicesPage from './pages/ServicesPage';
import MetricsPage from './pages/MetricsPage';
import YAMLPage from './pages/YAMLPage';
import LoginPage from './pages/LoginPage';
import kubernetesService from './services/kubernetesService';

function App() {
  const TOKEN_KEY = 'zenith-auth-token';
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const handler = (error) => {
      if (!authToken) return;
      const requestPath = error?.config?.url || '';
      if (requestPath.includes('/auth/')) return;
      setAuthToken(null);
    };
    kubernetesService.setUnauthorizedHandler(handler);
    return () => kubernetesService.setUnauthorizedHandler(null);
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem(TOKEN_KEY, authToken);
      kubernetesService.setAuthToken(authToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      kubernetesService.setAuthToken(null);
    }
  }, [authToken]);

  const handleLoginSuccess = (token) => {
    setAuthToken(token);
  };

  const handleLogout = async () => {
    await kubernetesService.logout();
    setAuthToken(null);
  };

  if (!authToken) {
    return (
      <div className="min-h-screen bg-zenith-bg text-white font-orbitron flex items-center justify-center px-4">
        <LoginPage onSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zenith-bg text-white font-orbitron">
      <Router>
        <ZenithNavbar onLogout={handleLogout} />
        <div className="pt-20 px-4">
          <Routes>
            <Route path="/" element={<Navigate to="/pods" />} />
            <Route path="/pods" element={<Dashboard />} />
            <Route path="/deployments" element={<DeploymentsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/yaml" element={<YAMLPage />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}

export default App;
