# Zenith - K3s Dashboard

🚀 **Zenith** is a modern, intuitive, and powerful Kubernetes dashboard specifically designed for K3s clusters. It provides a comprehensive, real-time view and management interface for your containerized applications, bringing clarity and control to your edge or lightweight Kubernetes deployments.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 📊 **Real-time Monitoring** - CPU, memory, and pod status at a glance.
- 📜 **Live Log Streaming** - Stream logs directly from any pod in real-time.
- 💻 **Interactive Terminal Access** - Get an interactive shell inside your containers.
- 🌐 **Service & Ingress Management** - View and manage service endpoints and ingress rules.
- 🔄 **Deployment & Pod Management** - Easily restart, delete, and scale deployments and individual pods.
- 🎨 **Modern UI with Tailwind CSS** - A beautiful and responsive user interface, including Dark Mode.
- 🔍 **Advanced Search & Filtering** - Quickly find resources by name, namespace, or labels.
- ⚡ **Automatic Refresh** - Keeps your dashboard data up-to-date without manual intervention.

## 🛠️ Technologies Used

**Frontend:**
*   React.js
*   Tailwind CSS
*   Xterm.js (for terminal emulation)

**Backend:**
*   Node.js (Express.js)
*   WebSockets
*   @kubernetes/client-node (Kubernetes API client)

**Deployment:**
*   Docker
*   Kubernetes (K3s specific)

## 🚀 Getting Started

To get Zenith up and running on your K3s cluster, follow these steps:

### Prerequisites

* A running K3s cluster with `kubectl` configured.
* Docker installed on your workstation (for building the images or running locally).
* Node.js 18+ if you plan to run the backend/frontend outside of Kubernetes.

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Zenith.git
cd Zenith
```

### 2. Build & import images

The helper script builds both images, tags them, and imports them into the local K3s registries:

```bash
./scripts/build.sh
```

> Tip: the script prints the resulting tag (e.g. `5eef13b`). You will need it in the next step.

### 3. Configure backend credentials

The backend now enforces authentication. Provide the credentials via a Kubernetes Secret so pods can load them at startup:

```bash
kubectl delete secret k3s-dashboard-credentials -n default --ignore-not-found
kubectl create secret generic k3s-dashboard-credentials \
  --from-literal=DASHBOARD_USER=admin \
  --from-literal=DASHBOARD_PASS=admin \
  -n default
```

Optional: override the session TTL (default 1h) by editing `k8s/deployments/backend-deployment.yaml` and adjusting `SESSION_TTL_MS`.

### 4. Deploy to K3s

Use the deployment script and pass the tag emitted during the build:

```bash
./scripts/deploy.sh --version 5eef13b
# or shorthand
./scripts/deploy.sh 5eef13b
```

Options:

| Flag | Description |
|------|-------------|
| `--namespace` | Deploy to a different namespace (default `default`). |
| `--backend-image`, `--frontend-image` | Override image references if you are pulling from a registry. |
| `--json` | Print a machine-readable summary. |

Internally the script templates manifests (`k8s/*`), applies RBAC, deployments and services, and waits for both rollouts to finish.

### 5. Frontend environment (optional)

If you serve the React app from a different origin, set the target backend URLs in `frontend/.env`:

```ini
REACT_APP_BACKEND_HTTP=http://192.168.0.156:30080
REACT_APP_BACKEND_WS=ws://192.168.0.156:30080
```

Then rebuild the frontend (`npm run build` or rerun `./scripts/build.sh`) so the values are baked into the bundle.

### 6. Access the dashboard

The default installation exposes Zenith via:

* `http://localhost:30080` (NodePort)
* or the hostname configured in `k8s/ingress/ingress.yaml` (if you enabled the ingress).

Log in with the credentials stored in `k3s-dashboard-credentials` (defaults: `admin / admin`). When the backend restarts all sessions are cleared, so each user must log in again.

> **Scaling note:** the backend keeps sessions in memory. Run a single pod or enable sticky sessions; otherwise a request may hit a replica that does not know the token and return 401.

### 7. Local development

* **Backend:** `cd backend && npm install && npm start` (reads `.env` for credentials).
* **Frontend:** `cd frontend && npm install && npm start` (proxies to the backend defined in `REACT_APP_BACKEND_HTTP`).
* **kubectl helpers:** `scripts/cleanup.sh` tears down temporary pods/services created from the UI.

## 🤝 Contributing

We welcome contributions! Please see our `CONTRIBUTING.md` (coming soon) for details on how to get involved.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
