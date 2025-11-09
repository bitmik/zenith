#!/bin/bash
set -e

VERSION_TAG=$1

if [ -z "$VERSION_TAG" ]; then
  echo "❌ Error: No version tag provided."
  echo "Usage: ./scripts/deploy.sh <version_tag>"
  exit 1
fi

echo "🚀 Deploying K3s Dashboard version $VERSION_TAG to cluster..."

# Create a temporary directory for modified manifests
TEMP_DIR=$(mktemp -d)
trap 'rm -rf -- "$TEMP_DIR"' EXIT

# Replace placeholder with the actual version tag
echo "📝 Preparing manifests for version $VERSION_TAG..."
sed "s/__VERSION_TAG__/$VERSION_TAG/g" k8s/deployments/backend-deployment.yaml > $TEMP_DIR/backend-deployment.yaml
sed "s/__VERSION_TAG__/$VERSION_TAG/g" k8s/deployments/frontend-deployment.yaml > $TEMP_DIR/frontend-deployment.yaml

# Apply RBAC first
echo "🔐 Applying RBAC..."
kubectl apply -f k8s/rbac/

# Apply deployments from the temporary directory
echo "📦 Deploying applications..."
kubectl apply -f $TEMP_DIR/

# Apply services
echo "🌐 Creating services..."
kubectl apply -f k8s/services/

# Optional: Apply ingress
# kubectl apply -f k8s/ingress/

echo ""
echo "✅ Deployment of version $VERSION_TAG complete!"
echo "   Run 'kubectl rollout status deployment/k3s-dashboard-frontend' to check progress."
echo ""
echo "📊 Checking status..."
kubectl get pods -l app=k3s-dashboard
echo ""
kubectl get svc -l app=k3s-dashboard
echo ""
echo "🌍 Access the dashboard at:"
echo "   http://$(hostname -I | awk '{print $1}'):30080"
echo ""
echo "📝 Logs:"
echo "   kubectl logs -l app=k3s-dashboard,component=backend -f"
echo "   kubectl logs -l app=k3s-dashboard,component=frontend -f"
