#!/bin/bash
set -e

echo "🔨 Building Docker images..."

# Build backend
echo "📦 Building backend..."
docker build -f docker/backend.Dockerfile -t k3s-dashboard-backend:latest .

# Build frontend
echo "🎨 Building frontend..."
docker build -f docker/frontend.Dockerfile -t k3s-dashboard-frontend:latest .

# Import into k3s
echo "📥 Importing images into k3s..."
docker save k3s-dashboard-backend:latest | sudo k3s ctr images import -
docker save k3s-dashboard-frontend:latest | sudo k3s ctr images import -

echo "✅ Build complete!"
docker images | grep k3s-dashboard
