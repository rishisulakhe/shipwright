#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-shipwright}"

echo "=== Creating kind cluster ==="
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster '${CLUSTER_NAME}' already exists, skipping creation."
else
  kind create cluster --name "${CLUSTER_NAME}" --config deploy/kind-example/kind-cluster.yaml
fi

echo ""
echo "=== Installing ingress-nginx ==="
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo ""
echo "=== Waiting for ingress-nginx ==="
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

echo ""
echo "=== Building images ==="
docker build -t shipwright-backend:prod -f backend/Dockerfile backend
docker build -t shipwright-frontend:prod -f frontend/Dockerfile frontend

echo ""
echo "=== Loading images into kind ==="
kind load docker-image shipwright-backend:prod --name "${CLUSTER_NAME}"
kind load docker-image shipwright-frontend:prod --name "${CLUSTER_NAME}"

echo ""
echo "=== Applying manifests ==="
kubectl apply -f deploy/kind-example/namespace.yaml
kubectl apply -f deploy/kind-example/secret.yaml
kubectl apply -f deploy/kind-example/postgres-configmap.yaml
kubectl apply -f deploy/kind-example/postgres-service.yaml
kubectl apply -f deploy/kind-example/postgres-statefullset.yaml
kubectl apply -f deploy/kind-example/backend-service.yaml
kubectl apply -f deploy/kind-example/backend-deployment.yaml
kubectl apply -f deploy/kind-example/frontend-configmap.yaml
kubectl apply -f deploy/kind-example/frontend-service.yaml
kubectl apply -f deploy/kind-example/frontend-deployment.yaml
kubectl apply -f deploy/kind-example/ingress.yaml

echo ""
echo "=== Waiting for pods ==="
kubectl wait --namespace docker-dashboard \
  --for=condition=ready pod \
  --all \
  --timeout=300s

echo ""
echo "=== Starting port-forward for local access ==="
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80 &>/dev/null &
PF_PID=$!
echo "port-forward PID: $PF_PID"

echo ""
echo "=== Done ==="
echo "Add '127.0.0.1 docker-dash.local' to /etc/hosts"
echo "echo "127.0.0.1 docker-dash.local" | sudo tee -a /etc/hosts"
echo "Then open: http://docker-dash.local"
echo ""
echo "To stop: kill $PF_PID"
