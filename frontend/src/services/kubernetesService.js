import axios from 'axios';

// Resolve backend base URLs, with environment overrides and sensible local fallbacks.
const resolveHttpBase = () => {
  if (process.env.REACT_APP_BACKEND_HTTP) {
    return process.env.REACT_APP_BACKEND_HTTP.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3001';
    }
    return window.location.origin.replace(/\/$/, '');
  }

  return 'http://localhost:3001';
};

const resolveWsBase = () => {
  if (process.env.REACT_APP_BACKEND_WS) {
    return process.env.REACT_APP_BACKEND_WS.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    if (process.env.NODE_ENV === 'development') {
      return 'ws://localhost:3002';
    }
    const origin = window.location.origin.replace(/\/$/, '');
    return origin.replace(/^http/, 'ws');
  }

  return 'ws://localhost:3002';
};

const HTTP_BASE = resolveHttpBase();
const WS_BASE = resolveWsBase();
const API_URL = `${HTTP_BASE}/api`;

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.info('[kubernetesService] HTTP_BASE:', HTTP_BASE, 'WS_BASE:', WS_BASE);
  // eslint-disable-next-line no-console
  console.info('[kubernetesService] REACT_APP_BACKEND_HTTP:', process.env.REACT_APP_BACKEND_HTTP);
}

// Centralized HTTP/WebSocket client; wraps axios with base URLs and exposes the operations used across the UI.
class KubernetesService {
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });
    this.token = null;
    this.onUnauthorized = null;

    this.api.interceptors.response.use(
      response => response,
      (error) => {
        if (error?.response?.status === 401 && typeof this.onUnauthorized === 'function') {
          this.onUnauthorized(error);
        }
        return Promise.reject(error);
      }
    );
  }

  async getPods(params = {}) { const { data } = await this.api.get('/pods', { params }); return data; }
  async deletePod(ns, name) { const { data } = await this.api.delete(`/pods/${ns}/${name}`); return data; }
  async restartPod(ns, name) { const { data } = await this.api.post(`/pods/${ns}/${name}/restart`); return data; }
  async cleanupStandalone(ns = 'default') { const { data } = await this.api.delete(`/pods/cleanup/standalone?namespace=${ns}`); return data; }
  async getDashboardStats() { const { data } = await this.api.get('/dashboard/stats'); return data; }
  async getPodMetrics(ns = 'all') { const { data } = await this.api.get(`/metrics/pods?namespace=${ns}`); return data; }
  async getDeployments() { const { data } = await this.api.get('/deployments'); return data; }
  async createDeployment(payload) { const { data } = await this.api.post('/deployments', payload); return data; }
  async scaleDeployment(ns, name, replicas) { const { data } = await this.api.patch(`/deployments/${ns}/${name}/scale`, { replicas }); return data; }
  async restartDeployment(ns, name) { const { data } = await this.api.post(`/deployments/${ns}/${name}/restart`); return data; }
  async getDeploymentStatus(ns, name) { const { data } = await this.api.get(`/deployments/${ns}/${name}/status`); return data; }
  async deleteDeployment(ns, name) { const { data } = await this.api.delete(`/deployments/${ns}/${name}`); return data; }
  async getServices() { const { data } = await this.api.get('/services'); return data; }
  async getPodDetails(ns, name) { const { data } = await this.api.get(`/pods/${ns}/${name}`); return data; }
  async getPodEvents(ns, name) { const { data } = await this.api.get(`/pods/${ns}/${name}/events`); return data; }
  async describePod(ns, name) { const { data } = await this.api.get(`/pods/${ns}/${name}/describe`); return data; }
  async getMarketTicker() { const { data } = await this.api.get('/markets/ticker'); return data; }

  setUnauthorizedHandler(handler) {
    this.onUnauthorized = handler;
  }

  setAuthToken(token) {
    this.token = token;
    if (token) {
      this.api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common.Authorization;
    }
  }

  async login(username, password) {
    const { data } = await this.api.post('/auth/login', { username, password });
    if (data?.token) this.setAuthToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.api.post('/auth/logout');
    } catch (_) {
      // ignore logout errors
    }
    this.setAuthToken(null);
  }

  streamLogs(namespace, podName, container) {
    const params = new URLSearchParams({ type: 'logs', namespace, pod: podName });
    if (container) params.append('container', container);
    return new WebSocket(`${WS_BASE}/?${params.toString()}`);
  }

  openTerminal(namespace, podName, container) {
    const params = new URLSearchParams({ type: 'exec', namespace, pod: podName });
    if (container) params.append('container', container);
    return new WebSocket(`${WS_BASE}/?${params.toString()}`);
  }
}

const kubernetesService = new KubernetesService();
export default kubernetesService;
