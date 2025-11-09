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

*   A running K3s cluster.
*   Docker installed on your machine.
*   `kubectl` configured to access your K3s cluster.
*   Node.js 18+ (if you plan to run the backend or frontend locally for development).

### Build and Deploy

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Zenith.git
    cd Zenith
    ```
2.  **Build Docker Images:**
    Use the provided script to build the frontend and backend Docker images and import them into your K3s environment.
    ```bash
    ./scripts/build.sh
    ```
3.  **Deploy to K3s:**
    Apply the Kubernetes manifests to deploy Zenith to your cluster.
    ```bash
    ./scripts/deploy.sh
    ```
    This will deploy the backend, frontend, services, and RBAC rules.

4.  **Access the Dashboard:**
    After deployment, you can access Zenith via the NodePort service or through the Ingress if configured. The `deploy.sh` script will output the access URL.

## 🤝 Contributing

We welcome contributions! Please see our `CONTRIBUTING.md` (coming soon) for details on how to get involved.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.