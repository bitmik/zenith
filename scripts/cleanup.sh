#!/bin/bash
set -e

echo "🧹 Cleaning up K3s Dashboard..."

kubectl delete -f k8s/services/ --ignore-not-found=true
kubectl delete -f k8s/deployments/ --ignore-not-found=true
kubectl delete -f k8s/rbac/ --ignore-not-found=true

echo "✅ Cleanup complete!"
