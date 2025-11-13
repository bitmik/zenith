#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy.sh --version <tag> [options]

Options:
  -v, --version <tag>         Version tag to deploy (required)
  -n, --namespace <name>      Target namespace (default: default)
      --backend-image <img>   Override backend image (default: k3s-dashboard-backend:<version>)
      --frontend-image <img>  Override frontend image (default: k3s-dashboard-frontend:<version>)
      --json                  Emit a JSON summary at the end
  -h, --help                  Show this help

You can still call './scripts/deploy.sh <version>' for backward compatibility.
EOF
}

VERSION_TAG=""
NAMESPACE="default"
BACKEND_IMAGE=""
FRONTEND_IMAGE=""
OUTPUT_JSON=false

positional_version=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version)
      VERSION_TAG="$2"; shift 2;;
    -n|--namespace)
      NAMESPACE="$2"; shift 2;;
    --backend-image)
      BACKEND_IMAGE="$2"; shift 2;;
    --frontend-image)
      FRONTEND_IMAGE="$2"; shift 2;;
    --json)
      OUTPUT_JSON=true; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      if [[ -z "$positional_version" ]]; then
        positional_version="$1"; shift;
      else
        echo "❌ Unknown argument: $1" >&2; usage; exit 1;
      fi;;
  esac
done

if [[ -z "$VERSION_TAG" && -n "$positional_version" ]]; then
  VERSION_TAG="$positional_version"
fi

if [[ -z "$VERSION_TAG" ]]; then
  echo "❌ Error: missing --version" >&2
  usage
  exit 1
fi

BACKEND_IMAGE_FINAL="${BACKEND_IMAGE:-k3s-dashboard-backend:$VERSION_TAG}"
FRONTEND_IMAGE_FINAL="${FRONTEND_IMAGE:-k3s-dashboard-frontend:$VERSION_TAG}"

echo "🚀 Deploying version $VERSION_TAG to namespace $NAMESPACE"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf -- "$TEMP_DIR"' EXIT

copy_manifests() {
  local src_dir=$1
  local dest_dir=$2
  mkdir -p "$dest_dir"
  cp -R "$src_dir"/* "$dest_dir"/
  find "$dest_dir" -type f -name '*.yaml' -print0 | while IFS= read -r -d '' file; do
    sed -i "s/__VERSION_TAG__/$VERSION_TAG/g" "$file"
    NAMESPACE="$NAMESPACE" perl -0pi -e 's/(namespace:\s*)default/$1$ENV{NAMESPACE}/g' "$file"
  done
}

echo "📝 Preparing manifests..."
copy_manifests k8s/deployments "$TEMP_DIR/deployments"
copy_manifests k8s/services "$TEMP_DIR/services"
copy_manifests k8s/rbac "$TEMP_DIR/rbac"

BACKEND_IMAGE_FINAL="$BACKEND_IMAGE_FINAL" perl -0pi -e 's|(image:\s*)k3s-dashboard-backend:\S+|$1$ENV{BACKEND_IMAGE_FINAL}|g' "$TEMP_DIR/deployments/backend-deployment.yaml"
FRONTEND_IMAGE_FINAL="$FRONTEND_IMAGE_FINAL" perl -0pi -e 's|(image:\s*)k3s-dashboard-frontend:\S+|$1$ENV{FRONTEND_IMAGE_FINAL}|g' "$TEMP_DIR/deployments/frontend-deployment.yaml"

echo "🔐 Applying RBAC"
kubectl apply -f "$TEMP_DIR/rbac"

echo "📦 Applying deployments"
kubectl apply -f "$TEMP_DIR/deployments"

echo "🌐 Applying services"
kubectl apply -f "$TEMP_DIR/services"

echo "📊 Rollout status"
kubectl rollout status deployment/k3s-dashboard-backend -n "$NAMESPACE" --timeout=60s || true
kubectl rollout status deployment/k3s-dashboard-frontend -n "$NAMESPACE" --timeout=60s || true

echo "✅ Deployment complete"

SUMMARY=$(cat <<JSON
{
  "status": "success",
  "version": "$VERSION_TAG",
  "namespace": "$NAMESPACE",
  "backendImage": "$BACKEND_IMAGE_FINAL",
  "frontendImage": "$FRONTEND_IMAGE_FINAL"
}
JSON
)

if [[ "$OUTPUT_JSON" == true ]]; then
  echo "$SUMMARY"
else
  echo "$SUMMARY"
  echo "💡 Usa --json per output machine-readable"
fi
