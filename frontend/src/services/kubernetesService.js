import axios from 'axios';

// Base HTTP per API
const HTTP_BASE = process.env.REACT_APP_BACKEND_HTTP || 'http://192.168.0.156:30001';
const API_URL = `${HTTP_BASE.replace(/\/$/, '')}/api`;

// Base WS separata (meglio una var dedicata)
const WS_BASE = process.env.REACT_APP_BACKEND_WS
  ? process.env.REACT_APP_BACKEND_WS.replace(/\/$/, '')
  : ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + '192.168.0.156:30002');

class KubernetesService {
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });
  }

  async getPods() { const { data } = await this.api.get('/pods'); return data; }
  async deletePod(ns, name) { const { data } = await this.api.delete(`/pods/${ns}/${name}`); return data; }
  async restartPod(ns, name) { const { data } = await this.api.post(`/pods/${ns}/${name}/restart`); return data; }
  async cleanupStandalone(ns = 'default') { const { data } = await this.api.delete(`/pods/cleanup/standalone?namespace=${ns}`); return data; }
  async getDashboardStats() { const { data } = await this.api.get('/dashboard/stats'); return data; }
  async getPodMetrics(ns = 'all') { const { data } = await this.api.get(`/metrics/pods?namespace=${ns}`); return data; }
  async getDeployments() { const { data } = await this.api.get('/deployments'); return data; }
  async createDeployment(payload) { const { data } = await this.api.post('/deployments', payload); return data; }
  async scaleDeployment(ns, name, replicas) { const { data } = await this.api.patch(`/deployments/${ns}/${name}/scale`, { replicas }); return data; }
  async deleteDeployment(ns, name) { const { data } = await this.api.delete(`/deployments/${ns}/${name}`); return data; }
  async getServices() { const { data } = await this.api.get('/services'); return data; }

  // WebSocket per log streaming
  streamLogs(namespace, podName, container) {
    const params = new URLSearchParams({ type: 'logs', namespace, pod: podName });
    if (container) params.append('container', container);
    return new WebSocket(`${WS_BASE}/?${params.toString()}`);
  }

  // WebSocket per terminal
  openTerminal(namespace, podName, container) {
    const params = new URLSearchParams({ type: 'exec', namespace, pod: podName });
    if (container) params.append('container', container);
    return new WebSocket(`${WS_BASE}/?${params.toString()}`);
  }
}

export default new KubernetesService();
