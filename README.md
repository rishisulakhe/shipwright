# Shipwright

A centralized multi-host Docker management dashboard built with **Go** and **React/TypeScript**. Monitor and manage containers, images, networks, and volumes across multiple Docker hosts from a single web interface — similar to Portainer, but designed for simplicity and a modern glassmorphism UI.

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-28-2496ED?logo=docker)

---

## Features

- **Multi-host management** — Register Unix socket, TCP, or SSH Docker hosts
- **Container lifecycle** — Create, start, stop, and remove containers with port mappings
- **Real-time logs** — Stream container logs via WebSocket with tail control
- **Live stats** — CPU, memory, network, and block I/O charts updated in real-time
- **Interactive terminal** — Browser-based shell via xterm.js and Docker exec
- **Network management** — Create, delete, connect/disconnect containers from networks
- **Volume management** — Create and remove volumes
- **Image management** — Pull and delete images; dangling images filtered by default
- **Role-based access** — Admin, developer, and viewer roles with JWT authentication
- **Glassmorphism UI** — Dark theme with blur effects, animated background, and gradient accents
- **Production-ready** — Multi-stage Docker builds, Nginx reverse proxy, health checks

---

## Tech Stack

### Backend

| Component | Technology |
|-----------|-----------|
| Language | Go 1.25 |
| Router | Chi v5 |
| Database | PostgreSQL 16 |
| Auth | JWT (HS256, 15min access / 7d refresh) |
| Password | bcrypt (cost 12) |
| Migrations | golang-migrate |
| Docker SDK | Docker Engine v28 |
| WebSocket | gorilla/websocket |
| Testing | net/http/httptest, PostgreSQL test DB |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React 19 |
| Language | TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| HTTP | Axios (with token refresh queue) |
| Charts | Chart.js + react-chartjs-2 |
| Terminal | xterm.js v6 |
| Icons | Lucide React |
| Linting | ESLint v10 |

---

## Project Structure

```
shipwright/
├── .github/workflows/       # CI/CD pipelines
│   ├── ci.yml               # Lint, test, build validation
│   └── cd.yml               # Build & push Docker images to GHCR
├── backend/
│   ├── cmd/
│   │   ├── server/main.go   # HTTP server entrypoint + route wiring
│   │   └── migrate/main.go  # Standalone migration runner
│   ├── internal/
│   │   ├── auth/            # JWT generation/validation, bcrypt hashing
│   │   ├── config/          # Environment variable loading
│   │   ├── database/        # PostgreSQL connection + migrations
│   │   ├── handlers/        # HTTP handlers (auth, host, container, network, volume, image, logs)
│   │   ├── middleware/       # Auth middleware (JWT Bearer), RBAC (RequireRole)
│   │   ├── models/          # Data models (User, DockerHost, Container, Network, Volume, Image)
│   │   ├── repository/      # Repository pattern (interfaces + PostgreSQL implementations)
│   │   ├── testhelpers/     # Test DB setup, auth helpers, HTTP helpers
│   │   └── ws/              # WebSocket handlers (hub, log stream, stats stream, terminal)
│   ├── pkg/dockerclient/    # Docker SDK wrapper + DockerProvider interface + mock
│   ├── migrations/          # SQL migration files
│   ├── Dockerfile           # Multi-stage production build (→ alpine:3.22, ~11MB)
│   ├── Dockerfile.dev       # Development build with Air hot-reload
│   ├── .air.toml             # Air configuration
│   └── .golangci.yml         # Linter configuration
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components (Navbar, LiveChart, Terminal, StatsPanel, etc.)
│   │   ├── hooks/            # Custom hooks (useApi, useAuth, useHost, useWebSocket)
│   │   ├── pages/            # Page components (Splash, Login, Register, Dashboard, HostDetail, etc.)
│   │   ├── services/         # Axios instance with JWT interceptor
│   │   └── utils/            # Formatters, auth helpers
│   ├── nginx.conf            # Production reverse proxy (SPA + API/WS proxy)
│   ├── Dockerfile            # Multi-stage production build (→ nginx:1.27-alpine, ~21MB)
│   ├── Dockerfile.dev        # Development build with Vite HMR
│   └── eslint.config.js      # ESLint flat config
├── docker-compose.yaml       # Development stack
├── docker-compose.prod.yaml  # Production stack
├── .env.production           # Production environment variables
├── Makefile                  # Build, test, lint, and Docker commands
└── scripts/build.sh          # Production build helper
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20+)
- [Docker Compose](https://docs.docker.com/compose/install/) (standalone v2+)

### Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/shipwright.git
cd shipwright

# Start the development stack
make dev-up

# View logs
make dev-logs

# Stop
make dev-down
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **PostgreSQL**: localhost:5432

Default test users:
- **Admin**: `admin` / `Test123!`
- **Developer**: `dev1` / `Dev12345!`

### Production

```bash
# Build and start production stack
make prod-up

# View production logs
make prod-logs

# Stop production stack
make prod-down
```

Production will be available at **http://localhost** (port 80) with Nginx reverse proxying API and WebSocket requests to the backend.

> **Important**: Change `JWT_SECRET` in `.env.production` before deploying to production.

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/health/db` | Database health check |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and get access/refresh tokens |
| `POST` | `/api/auth/refresh` | Refresh access token |

### Authenticated Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | Get current user info |
| `POST` | `/api/hosts` | Register a Docker host |
| `GET` | `/api/hosts` | List hosts (admin: all, others: own) |
| `GET` | `/api/hosts/{hostID}` | Get host details with live stats |
| `DELETE` | `/api/hosts/{hostID}` | Delete a host (owner or admin) |
| `POST` | `/api/hosts/{hostID}/test-connection` | Test Docker daemon connectivity |
| `GET` | `/api/hosts/{hostID}/containers` | List containers |
| `GET` | `/api/hosts/{hostID}/containers/{id}` | Inspect container |
| `POST` | `/api/hosts/{hostID}/containers` | Create container |
| `POST` | `/api/hosts/{hostID}/containers/{id}/start` | Start container |
| `POST` | `/api/hosts/{hostID}/containers/{id}/stop` | Stop container |
| `DELETE` | `/api/hosts/{hostID}/containers/{id}` | Remove container |
| `GET` | `/api/hosts/{hostID}/containers/{id}/logs` | Get container logs (REST) |
| `GET` | `/api/hosts/{hostID}/networks` | List networks |
| `GET` | `/api/hosts/{hostID}/networks/{id}` | Inspect network |
| `POST` | `/api/hosts/{hostID}/networks` | Create network |
| `DELETE` | `/api/hosts/{hostID}/networks/{id}` | Delete network |
| `POST` | `/api/hosts/{hostID}/networks/{id}/connect` | Connect container to network |
| `POST` | `/api/hosts/{hostID}/networks/{id}/disconnect` | Disconnect container from network |
| `GET` | `/api/hosts/{hostID}/volumes` | List volumes |
| `POST` | `/api/hosts/{hostID}/volumes` | Create volume |
| `DELETE` | `/api/hosts/{hostID}/volumes/{name}` | Delete volume |
| `GET` | `/api/hosts/{hostID}/images` | List images (dangling filtered by default) |
| `GET` | `/api/hosts/{hostID}/images?dangling=true` | List all images including dangling |
| `POST` | `/api/hosts/{hostID}/images/pull` | Pull an image |
| `DELETE` | `/api/hosts/{hostID}/images/{id}` | Delete an image |

### WebSocket Endpoints

All WebSocket endpoints require JWT authentication via `?token=<jwt>` query parameter.

| Path | Description |
|------|-------------|
| `/api/ws` | General echo hub |
| `/api/ws/hosts/{hostID}/containers/{id}/logs` | Stream container logs |
| `/api/ws/hosts/{hostID}/containers/{id}/stats` | Stream container stats |
| `/api/ws/hosts/{hostID}/containers/{id}/exec` | Interactive terminal |

---

## Testing

### Prerequisites

The integration tests require a running PostgreSQL database. The development Docker Compose stack includes one.

### Run Tests

```bash
# All backend tests
make test

# Tests with coverage report
make test-cover

# Lint both backend and frontend
make lint

# Backend lint only
make lint-backend

# Frontend lint only
make lint-frontend
```

### Test Coverage

| Package | Coverage |
|---------|----------|
| `internal/auth` | 84.8% |
| `internal/middleware` | 91.7% |
| `internal/handlers` | Integration tests (real DB) |
| `internal/repository` | 30.1% |

---

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | `postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable` | PostgreSQL connection string |
| `JWT_SECRET` | `change-me-in-production` | HMAC-SHA256 signing key (change in production!) |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

### Frontend (Build-time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend API base URL (empty in production = same-origin via Nginx) |

---

## Docker Images

| Image | Base | Size |
|-------|------|------|
| `shipwright-backend:prod` | alpine:3.22 | ~11 MB |
| `shipwright-frontend:prod` | nginx:1.27-alpine | ~21 MB |
| `shipwright-backend:dev` | golang:1.25-alpine | ~900 MB |
| `shipwright-frontend:dev` | node:22-alpine | ~530 MB |

Production images use multi-stage builds with minimal attack surface. The backend runs as a static binary on Alpine Linux.

---

## CI/CD

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push and PR to `main`:

1. **Backend Lint** — golangci-lint with 5m timeout
2. **Backend Test** — Go tests with PostgreSQL service container, race detector, coverage
3. **Frontend Lint** — ESLint + TypeScript type checking
4. **Frontend Build** — `npm run build` validation
5. **Docker Build** — Validates both production images build successfully

### Continuous Deployment (`.github/workflows/cd.yml`)

Runs on push to `main` and version tags (`v*`):

1. Build and push Docker images to **GitHub Container Registry** (ghcr.io)
2. Tag images with version (on releases) or commit SHA (on `main`)
3. Layer caching via GitHub Actions cache

---

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev-up` | Start development stack |
| `make dev-down` | Stop development stack |
| `make dev-logs` | Tail development logs |
| `make backend-shell` | Shell into backend container |
| `make db-reset` | Reset database schema |
| `make clean` | Remove containers, volumes, and prune images |
| `make prod-build` | Build production images |
| `make prod-up` | Start production stack |
| `make prod-down` | Stop production stack |
| `make prod-logs` | Tail production logs |
| `make test` | Run all backend tests |
| `make test-cover` | Run tests with HTML coverage report |
| `make test-integration` | Run integration tests |
| `make lint` | Run all linters |
| `make lint-backend` | Run golangci-lint |
| `make lint-frontend` | Run ESLint |

---

## Architecture

### Authentication Flow

1. User registers via `POST /api/auth/register` with username, email, password, and role
2. Login via `POST /api/auth/login` returns access token (15min) and refresh token (7d)
3. Access token sent as `Authorization: Bearer <token>` header on authenticated requests
4. On 401, frontend axios interceptor refreshes token via `POST /api/auth/refresh`
5. WebSocket auth uses `?token=<access_token>` query parameter

### WebSocket Architecture

- **Hub pattern** — Central hub registers/unregisters clients and broadcasts messages
- **Log streaming** — Docker `ContainerLogs` with follow mode, stripped 8-byte header, sent as JSON `{type, content}`
- **Stats streaming** — Docker `ContainerStats` with CPU% from delta, sent as JSON with memory/network/block metrics
- **Terminal** — Docker exec create with `/bin/sh` fallback, bidirectional WS↔Docker TTY

### Docker Client Architecture

The `DockerProvider` interface abstracts all Docker operations, with a `MockDockerClient` implementation for testing:

```
DockerProvider (interface)
├── Ping, Close
├── Container operations (List, Inspect, Create, Start, Stop, Remove, Logs, Stats, Exec)
├── Image operations (List, Pull, Remove)
├── Network operations (List, Inspect, Create, Remove, Connect, Disconnect)
└── Volume operations (List, Create, Remove)
```

---

## License

This project is licensed under the MIT License.