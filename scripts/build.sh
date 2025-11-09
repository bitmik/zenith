#!/bin/bash
set -e

# Get the short Git commit hash as the version tag
VERSION_TAG=$(git rev-parse --short HEAD)
echo "🔨 Building Docker images for version: $VERSION_TAG"

# Build backend
echo "📦 Building backend..."
docker build -f docker/backend.Dockerfile -t k3s-dashboard-backend:$VERSION_TAG .

# Build frontend
echo "🎨 Building frontend..."
docker build --no-cache -f docker/frontend.Dockerfile -t k3s-dashboard-frontend:$VERSION_TAG .

# Import into k3s
echo "📥 Importing images into k3s..."
docker save k3s-dashboard-backend:$VERSION_TAG | sudo k3s ctr images import -
docker save k3s-dashboard-frontend:$VERSION_TAG | sudo k3s ctr images import -

echo "✅ Build complete for version $VERSION_TAG!"
docker images | grep k3s-dashboard
