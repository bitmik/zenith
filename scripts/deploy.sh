#!/bin/bash
set -e

KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
KUBECTL="kubectl --kubeconfig $KUBECONFIG"

echo "🚀 Deploying K3s Dashboard to cluster..."

# Apply RBAC first
echo "🔐 Applying RBAC..."
sudo $KUBECTL apply -f k8s/rbac/

# Apply deployments
echo "📦 Deploying applications..."
sudo $KUBECTL apply -f k8s/deployments/

# Apply services
echo "🌐 Creating services..."
sudo $KUBECTL apply -f k8s/services/

# Optional: Apply ingress
# sudo $KUBECTL apply -f k8s/ingress/

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Checking status..."
sudo $KUBECTL get pods -l app=k3s-dashboard
echo ""
sudo $KUBECTL get svc -l app=k3s-dashboard
echo ""
echo "🌍 Access the dashboard at:"
echo "   http://$(hostname -I | awk '{print $1}'):30080"
echo ""
echo "📝 Logs:"
echo "   sudo $KUBECTL logs -l app=k3s-dashboard,component=backend -f"
echo "   sudo $KUBECTL logs -l app=k3s-dashboard,component=frontend -f"
