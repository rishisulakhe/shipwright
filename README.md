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
- **Production-ready** — Multi-stage Docker builds, Nginx reverse proxy, health checks

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


# Stop
make dev-down
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **PostgreSQL**: localhost:5432


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

---

## License

This project is private and proprietary.