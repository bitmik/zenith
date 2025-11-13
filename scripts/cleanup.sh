#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/cleanup.sh [options]

Options:
  -n, --namespace <name>   Target namespace (default: default)
      --json               Emit a JSON summary
  -h, --help               Show this help
EOF
}

NAMESPACE="default"
OUTPUT_JSON=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--namespace)
      NAMESPACE="$2"; shift 2;;
    --json)
      OUTPUT_JSON=true; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "❌ Unknown argument: $1" >&2
      usage
      exit 1;;
  esac
done

echo "🧹 Cleaning up namespace $NAMESPACE"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf -- "$TEMP_DIR"' EXIT

copy_manifests() {
  local src_dir=$1
  local dest_dir=$2
  mkdir -p "$dest_dir"
  cp -R "$src_dir"/* "$dest_dir"/
  find "$dest_dir" -type f -name '*.yaml' -print0 | while IFS= read -r -d '' file; do
    NAMESPACE="$NAMESPACE" perl -0pi -e 's/(namespace:\s*)default/$1$ENV{NAMESPACE}/g' "$file"
  done
}

copy_manifests k8s/services "$TEMP_DIR/services"
copy_manifests k8s/deployments "$TEMP_DIR/deployments"
copy_manifests k8s/rbac "$TEMP_DIR/rbac"

kubectl delete -f "$TEMP_DIR/services" --ignore-not-found=true
kubectl delete -f "$TEMP_DIR/deployments" --ignore-not-found=true
kubectl delete -f "$TEMP_DIR/rbac" --ignore-not-found=true

SUMMARY=$(cat <<JSON
{
  "status": "success",
  "namespace": "$NAMESPACE"
}
JSON
)

echo "✅ Cleanup complete"
if [[ "$OUTPUT_JSON" == true ]]; then
  echo "$SUMMARY"
else
  echo "$SUMMARY"
fi
