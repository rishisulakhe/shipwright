# Kubernetes (kind) — Optional Learning Path

This directory contains Kubernetes manifests for running Shipwright on a local [kind](https://kind.sigs.k8s.io/) cluster. This is an **optional, educational deployment path** — not the primary recommended way to run Shipwright.

## What this is

A self-contained example for learning how to deploy a Go + React app on Kubernetes with:

- PostgreSQL StatefulSet with persistent storage
- Backend Deployment with init containers for DB migrations
- Frontend with Nginx ConfigMap for SPA routing
- Ingress NGINX for HTTP/WebSocket routing
- Secrets for sensitive configuration

## Prerequisites

- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- Docker (for building images)

## Quick start

```bash
cd shipwright

# 1. Create the secrets file
cp deploy/kind-example/secret.yaml.example deploy/kind-example/secret.yaml
# Edit secret.yaml — replace CHANGE_ME values with base64-encoded strings
#   echo -n "your-postgres-password" | base64
#   echo -n "your-jwt-secret" | base64
#   Database URL format: postgres://user:pass@postgres-service:5432/dockerdash?sslmode=disable

# 2. Deploy
bash scripts/k8s-deploy.sh

# 3. Access (requires /etc/hosts entry)
echo "127.0.0.1 docker-dash.local" | sudo tee -a /etc/hosts
open http://docker-dash.local
```

## Cleanup

```bash
kind delete cluster --name shipwright
```

## Manifests

| File | Purpose |
|---|---|
| `namespace.yaml` | `docker-dashboard` namespace |
| `postgres-configmap.yaml` | Non-sensitive DB config (DB name, user, migrations path) |
| `postgres-service.yaml` | ClusterIP for PostgreSQL |
| `postgres-statefullset.yaml` | StatefulSet with 1Gi persistent volume |
| `backend-deployment.yaml` | Go backend (2 replicas, init container for migrations) |
| `backend-service.yaml` | ClusterIP for backend API |
| `frontend-configmap.yaml` | Nginx override for K8s (static-only, no proxy_pass) |
| `frontend-deployment.yaml` | React frontend with Nginx |
| `frontend-service.yaml` | ClusterIP for frontend |
| `ingress.yaml` | Ingress NGINX routing |
| `kind-cluster.yaml` | kind cluster configuration |
| `secret.yaml.example` | Template for sensitive values (JWT_SECRET, DB password) |

## Limitations

- Docker socket is mounted as a **hostPath** volume — containers can access the host Docker daemon directly. This is acceptable for a local learning cluster but **not recommended for production Kubernetes**.
- No horizontal pod autoscaling configured
- Single PostgreSQL replica (no high availability)
- Kind-specific ingress setup (won't work on EKS/GKE/AKS without modifications)

## Recommended alternative

For production use, see the **Docker Compose production stack** (`docker-compose.prod.yaml`) which is the primary supported deployment method.
