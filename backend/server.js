import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import * as k8s from '@kubernetes/client-node';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3001;
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'admin';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 3600000);

// In-memory session table (token -> { user, expiresAt }); restart or multi-pod setups require shared storage.
const sessions = new Map();

const purgeExpiredSessions = () => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
};

const generateToken = () => crypto.randomBytes(32).toString('hex');

const validateToken = (token) => {
  if (!token || !sessions.has(token)) return false;
  const session = sessions.get(token);
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
};

// ==== K8s clients/state ====
let k8sApi = null;
let appsV1Api = null;
let kc = null;
let k8sError = null;

// ServiceAccount paths (in-cluster)
const SA_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const SA_CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
const K3S_DEFAULT_KUBECONFIG = '/etc/rancher/k3s/k3s.yaml';

let saToken = null;
let saCA = null;

function loadServiceAccount() {
  try { saToken = fs.readFileSync(SA_TOKEN_PATH, 'utf8').trim(); } catch (_) { saToken = null; }
  try { saCA = fs.readFileSync(SA_CA_PATH); } catch (_) { saCA = null; }
}

// Initializes kubeconfig (k3s file, in-cluster, or ~/.kube/config) and warms up API clients.
async function initializeClient() {
  try {
    console.log('📦 Caricamento kubeconfig...');
    kc = new k8s.KubeConfig();

    // 1) Prova file k3s sul nodo (se stai girando on-host)
    let loaded = false;
    try {
      if (fs.existsSync(K3S_DEFAULT_KUBECONFIG)) {
        kc.loadFromFile(K3S_DEFAULT_KUBECONFIG);
        console.log(`✅ Kubeconfig: ${K3S_DEFAULT_KUBECONFIG}`);
        loaded = true;
      }
    } catch (_) {}

    // 2) Prova in-cluster (se stai girando come pod)
    if (!loaded) {
      try {
        kc.loadFromCluster();
        console.log('✅ In-cluster config attiva');
        loaded = true;
      } catch (_) {}
    }

    // 3) Fallback: kubeconfig di default sul filesystem (~/.kube/config) per sviluppo
    if (!loaded) {
      kc.loadFromDefault();
      console.log('✅ Kubeconfig: default (~/.kube/config)');
    }

    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
    loadServiceAccount();

    // Sanity check
    const nsResp = await k8sApi.listNamespace();
    const namespaces = (nsResp.body?.items || []).map(ns => ns.metadata?.name).filter(Boolean);
    console.log('✅ Connesso a Kubernetes');
    console.log('✅ Namespaces:', namespaces.join(', '));
  } catch (e) {
    k8sError = e?.body?.message || e.message;
    console.error('❌ Errore Kubernetes:', k8sError);
    console.error('⚠️  Server continuerà senza K8s');
  }
}

function getK8sCredentialsFromKC(kcInst) {
  // Usa credenziali dal kubeconfig caricato (host/dev), fallback a in-cluster SA
  try {
    const cluster = kcInst.getCurrentCluster();
    const user = kcInst.getCurrentUser();
    const opts = { ca: undefined, cert: undefined, key: undefined, rejectUnauthorized: false };

    if (cluster?.caData) opts.ca = Buffer.from(cluster.caData, 'base64');
    else if (cluster?.caFile) opts.ca = fs.readFileSync(cluster.caFile);

    if (user?.certData) opts.cert = Buffer.from(user.certData, 'base64');
    else if (user?.certFile) opts.cert = fs.readFileSync(user.certFile);

    if (user?.keyData) opts.key = Buffer.from(user.keyData, 'base64');
    else if (user?.keyFile) opts.key = fs.readFileSync(user.keyFile);

    return opts;
  } catch {
    return { rejectUnauthorized: false };
  }
}

// ==== Middleware ====
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:4200',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://192.168.0.156:30080'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// ==== AUTH MIDDLEWARE ====
app.use((req, res, next) => {
  // Skip auth for non-API routes, health check, auth endpoints, and CORS preflight
  if (!req.path.startsWith('/api') || req.method === 'OPTIONS') return next();
  if (req.path === '/api/status' || req.path.startsWith('/api/auth')) return next();

  purgeExpiredSessions();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  req.user = sessions.get(token)?.user || 'system';
  return next();
});

// ==== AUTH ROUTES ====
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Credenziali mancanti' });
  }
  if (username !== DASHBOARD_USER || password !== DASHBOARD_PASS) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const token = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { user: username, expiresAt });
  return res.json({ token, expiresAt });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token && sessions.has(token)) {
    sessions.delete(token);
  }
  return res.json({ success: true });
});

// ==== STATUS ====
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    kubernetes: k8sApi ? 'connected' : 'disconnected',
    error: k8sError || null
  });
});

// ==== DASHBOARD STATS ====
app.get('/api/dashboard/stats', async (_req, res) => {
  if (!k8sApi || !appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const [podsResp, deploymentsResp, servicesResp, namespacesResp] = await Promise.all([
      k8sApi.listPodForAllNamespaces(),
      appsV1Api.listDeploymentForAllNamespaces(),
      k8sApi.listServiceForAllNamespaces(),
      k8sApi.listNamespace()
    ]);

    const pods = podsResp.body?.items || [];
    const deployments = deploymentsResp.body?.items || [];
    const services = servicesResp.body?.items || [];
    const namespaces = namespacesResp.body?.items || [];

    const stats = {
      namespaces: {
        total: namespaces.length,
        list: namespaces.map(ns => ns.metadata?.name).filter(Boolean)
      },
      pods: {
        total: pods.length,
        running: pods.filter(p => p.status?.phase === 'Running').length,
        pending: pods.filter(p => p.status?.phase === 'Pending').length,
        failed: pods.filter(p => p.status?.phase === 'Failed').length,
        byNamespace: {}
      },
      deployments: { total: deployments.length, byNamespace: {} },
      services: { total: services.length, byNamespace: {} }
    };

    namespaces.forEach(ns => {
      const nsName = ns.metadata?.name || '';
      stats.pods.byNamespace[nsName] = pods.filter(p => p.metadata?.namespace === nsName).length;
      stats.deployments.byNamespace[nsName] = deployments.filter(d => d.metadata?.namespace === nsName).length;
      stats.services.byNamespace[nsName] = services.filter(s => s.metadata?.namespace === nsName).length;
    });

    res.json(stats);
  } catch (e) {
    console.error('❌ Errore dashboard:', e.message);
    res.status(500).json({ error: 'Errore recupero statistiche' });
  }
});

// ==== METRICS (tollerante/rapida) ====
app.get('/api/metrics/pods', async (req, res) => {
  if (!kc) return res.json({ items: [] });

  try {
    const namespace = req.query.namespace || 'default';
    const baseUrl = kc.getCurrentCluster()?.server;
    if (!baseUrl) return res.json({ items: [] });

    const metricsPath = namespace === 'all'
      ? '/apis/metrics.k8s.io/v1beta1/pods'
      : `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`;

    const parsedUrl = new URL(baseUrl);
    // Preferisci SA in-cluster se disponibile
    let requestOptions = {};
    if (saToken && saCA) {
      requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: metricsPath,
        method: 'GET',
        headers: { Authorization: `Bearer ${saToken}` },
        ca: saCA,
        rejectUnauthorized: true
      };
    } else {
      // fallback a credenziali da kubeconfig caricato
      const credentials = getK8sCredentialsFromKC(kc);
      requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: metricsPath,
        method: 'GET',
        ...credentials
      };
    }

    const data = await new Promise((resolve) => {
      const r = https.request(requestOptions, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (response.statusCode === 200) {
            try { resolve(JSON.parse(body)); } catch { resolve({ items: [] }); }
          } else {
            console.warn(`⚠️  Metrics API ${response.statusCode}: ${body}`);
            resolve({ items: [] });
          }
        });
      });
      r.on('error', () => resolve({ items: [] }));
      r.setTimeout(3000, () => { try { r.destroy(); } catch {} resolve({ items: [] }); });
      r.end();
    });

    res.json(data);
  } catch (e) {
    console.error('❌ Errore metriche pod:', e.message);
    res.json({ items: [] });
  }
});

// ==== PODS ====
app.get('/api/pods', async (_req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile', message: k8sError });
  try {
    const podsResp = await k8sApi.listPodForAllNamespaces();
    const items = podsResp.body?.items || [];
    const pods = items.map(pod => {
      const ownerReferences = pod.metadata?.ownerReferences || [];
      const isManaged = ownerReferences.some(o => ['ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job'].includes(o.kind));
      return {
        name: pod.metadata?.name || '',
        namespace: pod.metadata?.namespace || '',
        status: pod.status?.phase || 'Unknown',
        creationTimestamp: pod.metadata?.creationTimestamp || null,
        isManaged,
        ownerKind: ownerReferences[0]?.kind || null,
        labels: pod.metadata?.labels || {}
      };
    });
    res.json(pods);
  } catch (e) {
    console.error('❌ Errore pods:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Errore recupero pod' });
  }
});

app.post('/api/pods', async (_req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const namespace = 'default';
    const podName = `nginx-pod-${Date.now()}`;
    const podManifest = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: podName, labels: { app: 'nginx', type: 'standalone' } },
      spec: {
        containers: [{ name: 'nginx', image: 'nginx:latest', ports: [{ containerPort: 80 }] }]
      }
    };
    await k8sApi.createNamespacedPod(namespace, podManifest);
    res.status(201).json({ message: `Pod ${podName} creato`, name: podName });
  } catch (e) {
    console.error('❌ Errore create pod:', e);
    res.status(500).json({ error: 'Creazione pod fallita', details: e.message });
  }
});

app.post('/api/pods/:namespace/:name/restart', async (req, res) => {
  if (!k8sApi || !appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const podResp = await k8sApi.readNamespacedPod(name, namespace);
    const pod = podResp.body;
    const ownerReferences = pod.metadata?.ownerReferences || [];
    const replicaSetOwner = ownerReferences.find(o => o.kind === 'ReplicaSet');

    if (replicaSetOwner) {
      const rsName = replicaSetOwner.name;
      const deploymentName = rsName.substring(0, rsName.lastIndexOf('-'));
      const patch = {
        spec: {
          template: {
            metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } }
          }
        }
      };
      await appsV1Api.patchNamespacedDeployment(
        deploymentName,
        namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );
      res.json({ message: `Deployment ${deploymentName} riavviato`, deploymentName, method: 'rollout-restart' });
    } else {
      await k8sApi.deleteNamespacedPod(name, namespace);
      res.json({ message: `Pod standalone ${name} eliminato`, method: 'delete-only' });
    }
  } catch (e) {
    console.error('❌ Errore restart:', e);
    res.status(500).json({ error: 'Riavvio fallito', details: e.message });
  }
});

app.delete('/api/pods/:namespace/:name', async (req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    await k8sApi.deleteNamespacedPod(name, namespace);
    res.json({ message: `Pod ${name} eliminato` });
  } catch (e) {
    console.error('❌ Errore delete pod:', e.message);
    res.status(500).json({ error: 'Eliminazione fallita', details: e.message });
  }
});

app.delete('/api/pods/cleanup/standalone', async (req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const namespace = req.query.namespace || 'default';
    const podsResp = await k8sApi.listNamespacedPod(namespace);
    const items = podsResp.body?.items || [];
    const standalonePods = items.filter(pod => {
      const ownerReferences = pod.metadata?.ownerReferences || [];
      return ownerReferences.length === 0 && pod.metadata?.name?.startsWith('nginx-pod-');
    });
    await Promise.all(standalonePods.map(p => k8sApi.deleteNamespacedPod(p.metadata.name, namespace)));
    res.json({ message: `${standalonePods.length} pod standalone eliminati`, count: standalonePods.length });
  } catch (e) {
    console.error('❌ Errore cleanup:', e);
    res.status(500).json({ error: 'Cleanup fallito' });
  }
});

app.get('/api/pods/:namespace/:name', async (req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const podResp = await k8sApi.readNamespacedPod(name, namespace);
    const pod = podResp.body || {};
    const containers = (pod.spec?.containers || []).map(container => ({
      name: container.name,
      image: container.image,
      ports: container.ports || [],
      env: container.env || [],
      resources: container.resources || {}
    }));
    const initContainers = (pod.spec?.initContainers || []).map(container => ({
      name: container.name,
      image: container.image,
      ports: container.ports || [],
      env: container.env || [],
      resources: container.resources || {}
    }));
    const containerStatuses = pod.status?.containerStatuses || [];
    res.json({
      containers,
      initContainers,
      metadata: {
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        labels: pod.metadata?.labels,
        annotations: pod.metadata?.annotations,
        creationTimestamp: pod.metadata?.creationTimestamp,
        ownerReferences: pod.metadata?.ownerReferences || []
      },
      spec: {
        nodeName: pod.spec?.nodeName,
        serviceAccountName: pod.spec?.serviceAccountName,
        restartPolicy: pod.spec?.restartPolicy
      },
      status: {
        phase: pod.status?.phase,
        podIP: pod.status?.podIP,
        hostIP: pod.status?.hostIP,
        startTime: pod.status?.startTime,
        conditions: pod.status?.conditions || [],
        containerStatuses
      }
    });
  } catch (e) {
    console.error('❌ Errore pod details:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Dettagli pod non disponibili' });
  }
});

// Fetches events for a single pod; the API is noisy so we compress it into a slim shape for the UI.
async function fetchPodEvents(namespace, name) {
  if (!k8sApi) return [];
  const eventsResp = await k8sApi.listNamespacedEvent(
    namespace,
    undefined,
    undefined,
    undefined,
    `involvedObject.name=${name}`
  );
  const items = eventsResp.body?.items || [];
  return items.map(event => ({
    type: event.type || 'Normal',
    reason: event.reason || 'Evento',
    message: event.message || '',
    count: event.count || 1,
    firstTimestamp: event.firstTimestamp || event.eventTime || null,
    lastTimestamp: event.lastTimestamp || event.eventTime || null,
    source: event.source?.component || null
  }));
}

app.get('/api/pods/:namespace/:name/events', async (req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const events = await fetchPodEvents(namespace, name);
    res.json(events);
  } catch (e) {
    console.error('❌ Errore events:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Eventi non disponibili' });
  }
});

app.get('/api/pods/:namespace/:name/describe', async (req, res) => {
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const base = kubectlAuthArgs();
    const args = [...base, 'describe', 'pod', name, '-n', namespace];
    const output = await runKubectl(args);
    res.json({ output });
  } catch (e) {
    console.error('❌ Errore describe pod:', e.message);
    res.status(500).json({ error: 'Describe non disponibile', details: e.message });
  }
});

// ==== DEPLOYMENTS ====
app.get('/api/deployments', async (_req, res) => {
  if (!appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const deploymentsResp = await appsV1Api.listDeploymentForAllNamespaces();
    const items = deploymentsResp.body?.items || [];
    const deployments = items.map(dep => ({
      name: dep.metadata?.name || '',
      namespace: dep.metadata?.namespace || '',
      replicas: dep.spec?.replicas || 0,
      readyReplicas: dep.status?.readyReplicas || 0,
      availableReplicas: dep.status?.availableReplicas || 0,
      updatedReplicas: dep.status?.updatedReplicas || 0,
      creationTimestamp: dep.metadata?.creationTimestamp || null
    }));
    res.json(deployments);
  } catch (e) {
    console.error('❌ Errore deployments:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Errore recupero deployment' });
  }
});

app.post('/api/deployments', async (req, res) => {
  if (!appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const { name, image, replicas, port } = req.body;
    const namespace = 'default';
    const deploymentName = name || `nginx-deployment-${Date.now()}`;
    const containerImage = image || 'nginx:latest';
    const replicaCount = replicas ?? 2;
    const containerPort = port ?? 80;

    const deploymentManifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: deploymentName, labels: { app: deploymentName } },
      spec: {
        replicas: Number(replicaCount),
        selector: { matchLabels: { app: deploymentName } },
        template: {
          metadata: { labels: { app: deploymentName } },
          spec: {
            containers: [{ name: deploymentName, image: containerImage, ports: [{ containerPort }] }]
          }
        }
      }
    };

    await appsV1Api.createNamespacedDeployment(namespace, deploymentManifest);
    res.status(201).json({ message: `Deployment ${deploymentName} creato`, name: deploymentName, replicas: Number(replicaCount) });
  } catch (e) {
    console.error('❌ Errore create deployment:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Creazione deployment fallita' });
  }
});

app.patch('/api/deployments/:namespace/:name/scale', async (req, res) => {
  if (!appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  const replicas = req.body.replicas;
  if (!namespace || !name || replicas === undefined) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const patch = { spec: { replicas: parseInt(replicas, 10) } };
    await appsV1Api.patchNamespacedDeployment(
      name,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
    );
    res.json({ message: `Deployment ${name} scalato a ${replicas} replicas` });
  } catch (e) {
    console.error('❌ Errore scale deployment:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Scaling fallito' });
  }
});

app.post('/api/deployments/:namespace/:name/restart', async (req, res) => {
  if (!appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
            }
          }
        }
      }
    };

    await appsV1Api.patchNamespacedDeployment(
      name,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
    );
    res.json({ message: `Deployment ${name} riavviato` });
  } catch (e) {
    console.error('❌ Errore restart deployment:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Riavvio deployment fallito' });
  }
});

app.get('/api/deployments/:namespace/:name/status', async (req, res) => {
  if (!appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const depResp = await appsV1Api.readNamespacedDeployment(name, namespace);
    const dep = depResp.body || {};
    const desiredReplicas = dep.spec?.replicas ?? 0;
    const updatedReplicas = dep.status?.updatedReplicas || 0;
    const readyReplicas = dep.status?.readyReplicas || 0;
    const availableReplicas = dep.status?.availableReplicas || 0;
    const conditions = dep.status?.conditions || [];
    const rolloutComplete = updatedReplicas === desiredReplicas && availableReplicas === desiredReplicas;
    res.json({
      name,
      namespace,
      desiredReplicas,
      updatedReplicas,
      readyReplicas,
      availableReplicas,
      conditions,
      rolloutComplete
    });
  } catch (e) {
    console.error('❌ Errore status deployment:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Status deployment non disponibile' });
  }
});

app.delete('/api/deployments/:namespace/:name', async (req, res) => {
  if (!appsV1Api) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    await appsV1Api.deleteNamespacedDeployment(name, namespace);
    res.json({ message: `Deployment ${name} eliminato` });
  } catch (e) {
    console.error('❌ Errore delete deployment:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Eliminazione deployment fallita' });
  }
});

// ==== SERVICES ====
app.get('/api/services', async (_req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const servicesResp = await k8sApi.listServiceForAllNamespaces();
    const items = servicesResp.body?.items || [];
    const services = items.map(svc => ({
      name: svc.metadata?.name || '',
      namespace: svc.metadata?.namespace || '',
      type: svc.spec?.type || 'ClusterIP',
      clusterIP: svc.spec?.clusterIP || '',
      externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip || null,
      ports: (svc.spec?.ports || []).map(p => ({
        port: p.port,
        targetPort: p.targetPort,
        nodePort: p.nodePort || null,
        protocol: p.protocol || 'TCP'
      }))
    }));
    res.json(services);
  } catch (e) {
    console.error('❌ Errore services:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Errore recupero servizi' });
  }
});

app.post('/api/services', async (req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  try {
    const { deploymentName, port, targetPort, type, nodePort } = req.body;
    const namespace = 'default';
    const serviceName = `${deploymentName}-service`;

    const ports = [{
      port: Number(port || 80),
      targetPort: targetPort || 80,
      protocol: 'TCP',
      ...(type === 'NodePort' && nodePort ? { nodePort: Number(nodePort) } : {})
    }];

    const serviceManifest = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: serviceName, labels: { app: deploymentName } },
      spec: {
        type: type || 'ClusterIP',
        selector: { app: deploymentName },
        ports
      }
    };

    await k8sApi.createNamespacedService(namespace, serviceManifest);
    res.status(201).json({ message: `Service ${serviceName} creato`, name: serviceName, type: type || 'ClusterIP' });
  } catch (e) {
    console.error('❌ Errore create service:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Creazione service fallita' });
  }
});

app.delete('/api/services/:namespace/:name', async (req, res) => {
  if (!k8sApi) return res.status(503).json({ error: 'Kubernetes non disponibile' });
  const namespace = String(req.params.namespace || '');
  const name = String(req.params.name || '');
  if (!namespace || !name) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    await k8sApi.deleteNamespacedService(name, namespace);
    res.json({ message: `Service ${name} eliminato` });
  } catch (e) {
    console.error('❌ Errore delete service:', e?.body?.message || e.message);
    res.status(500).json({ error: 'Eliminazione service fallita' });
  }
});

// ==== WEBSOCKET SERVER separato (porta 3002) ====
const WS_PORT = Number(process.env.WS_PORT || 3002);
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  console.log('🔌 Nuova connessione WebSocket');
  try {
    const url = new URL(req.url || '', `ws://localhost:${WS_PORT}`);
    const type = url.searchParams.get('type');
    const namespace = url.searchParams.get('namespace');
    const pod = url.searchParams.get('pod');
    const container = url.searchParams.get('container');

    console.log(`🔌 WebSocket ${type} - ${namespace}/${pod}`);

    if (!type || !namespace || !pod) {
      ws.send('ERROR: Parametri mancanti\n');
      ws.close();
      return;
    }

    if (type === 'logs') {
      handleLogStream(ws, namespace, pod, container);
    } else if (type === 'exec') {
      handleExec(ws, namespace, pod, container);
    } else {
      ws.send(`ERROR: Tipo non valido: ${type}\n`);
      ws.close();
    }
  } catch (e) {
    console.error('❌ Errore connessione WebSocket:', e);
    if (ws.readyState === 1) ws.send(`ERROR: ${e.message}\n`);
    ws.close();
  }
});

wss.on('listening', () => {
  console.log(`🔌 WebSocket server su ws://0.0.0.0:${WS_PORT}`);
});

wss.on('error', (error) => {
  console.error('❌ WebSocket Server Error:', error);
});

// Costruisce argomenti auth per kubectl (preferisci SA in-cluster; fallback kubeconfig file)
function kubectlAuthArgs() {
  const args = [];
  // Se SA presente, usa server e token/CA (kubectl richiede server esplicito)
  try {
    // Prova a dedurre il server dall’oggetto kc
    const server = kc?.getCurrentCluster()?.server;
    if (saToken && saCA && server) {
      const u = new URL(server);
      const host = u.hostname;
      const port = u.port || (u.protocol === 'https:' ? '443' : '80');
      args.push(`--server=${u.protocol}//${host}:${port}`);
      args.push(`--token=${saToken}`);
      // Scrivi la CA in un path noto (già montato in SA_CA_PATH)
      if (fs.existsSync(SA_CA_PATH)) args.push(`--certificate-authority=${SA_CA_PATH}`);
      return args;
    }
  } catch (_) {}

  // Fallback: se esiste kubeconfig di k3s nel container (esecuzione on-host)
  if (fs.existsSync(K3S_DEFAULT_KUBECONFIG)) {
    args.push(`--kubeconfig=${K3S_DEFAULT_KUBECONFIG}`);
  }
  return args;
}

// Convenience helper to exec kubectl commands and capture stdout/stderr (used for describe/exec/logs).
function runKubectl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('kubectl', args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(stdout);
      return reject(new Error(stderr || `kubectl exited with code ${code}`));
    });
  });
}

function handleLogStream(ws, namespace, pod, container) {
  console.log(`📜 Streaming logs: ${namespace}/${pod}`);
  const base = kubectlAuthArgs();
  const args = [
    ...base,
    'logs',
    pod,
    '-n', namespace,
    '--follow',
    '--tail=100'
  ];
  if (container) args.push('-c', container);
  console.log('📜 Eseguendo:', 'kubectl', args.join(' '));

  const child = spawn('kubectl', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (d) => { if (ws.readyState === 1) ws.send(d.toString()); });
  child.stderr.on('data', (d) => { if (ws.readyState === 1) ws.send(`ERROR: ${d.toString()}`); });

  const cleanup = () => { try { child.kill('SIGTERM'); } catch (_) {} };
  child.on('close', (code) => { if (ws.readyState === 1) ws.send(`\n--- Stream terminato (${code}) ---\n`); ws.close(); });
  child.on('error', (e) => { if (ws.readyState === 1) ws.send(`ERROR: ${e.message}\n`); ws.close(); });

  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

function handleExec(ws, namespace, pod, container) {
  console.log(`💻 Opening shell: ${namespace}/${pod}`);
  const base = kubectlAuthArgs();
  const args = [
    ...base,
    'exec',
    '-i',
    pod,
    '-n', namespace
  ];
  if (container) args.push('-c', container);
  args.push('--', 'sh');
  console.log('💻 Eseguendo:', 'kubectl', args.join(' '));

  const child = spawn('kubectl', args, { stdio: ['pipe', 'pipe', 'pipe'] });

  // prompt iniziale
  setTimeout(() => { if (ws.readyState === 1) ws.send(`🔌 Connesso a ${pod}\n# `); }, 100);

  ws.on('message', (data) => { if (child.stdin.writable) child.stdin.write(data); });
  child.stdout.on('data', (d) => { if (ws.readyState === 1) ws.send(d.toString()); });
  child.stderr.on('data', (d) => { if (ws.readyState === 1) ws.send(d.toString()); });

  const cleanup = () => { try { child.kill('SIGTERM'); } catch (_) {} };
  child.on('close', (code) => { if (ws.readyState === 1) ws.send(`\n--- Shell terminata (${code}) ---\n`); ws.close(); });
  child.on('error', (e) => { if (ws.readyState === 1) ws.send(`ERROR: ${e.message}\n`); ws.close(); });

  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

// ==== Error handlers (sempre in fondo) ====
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato', path: req.url });
});

app.use((err, _req, res, _next) => {
  console.error('❌ Error middleware:', err);
  res.status(err.status || 500).json({ error: err.message || 'Errore interno' });
});

// ==== Avvio server ====
async function startServer() {
  await initializeClient();
  http.createServer(app).listen(PORT, () => {
    console.log(`\n🚀 Server HTTP su http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket server su ws://0.0.0.0:${WS_PORT}`);
    console.log(k8sApi ? '✅ Kubernetes OK\n' : '⚠️  Kubernetes NON connesso\n');
  });
}

process.on('uncaughtException', (err) => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('❌ Unhandled Rejection:', promise, reason));

startServer().catch(err => {
  console.error('❌ Errore avvio:', err);
  process.exit(1);
});
