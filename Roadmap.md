# Docker Integration Host — Learning Roadmap

## Project Goal

Build a **centralized multi-host Docker management dashboard** from scratch using **Go (backend)** and **TypeScript (frontend)**. This project mirrors:

- Docker daemon registration & connection testing
- Container lifecycle management (create, start, stop, delete)
- Network, volume, and image management
- WebSocket-based live container logs, stats, and interactive terminal
- JWT authentication with role-based access control
- Docker Compose and Kubernetes deployment

The original project was built with Django + React. We are rebuilding it with **Go + TypeScript** — a stack far more common in cloud-native/DevOps tooling.

---

## Prerequisites

Before starting, ensure you have:
- **Go 1.22+** installed (`go version`)
- **Node.js 22+** and npm installed (`node -v`, `npm -v`)
- **Docker** and **Docker Compose** installed (`docker version`, `docker compose version`)
- **PostgreSQL** client (`psql --version`) — or just the Docker image
- **kubectl** + **kind** (optional, for the K8s phase)
- Basic familiarity with REST APIs, Docker CLI, and React

---

## How to Use This Roadmap

Each step has **5 sections**:

| Section | Purpose |
|---|---|
| **Concepts to Explore** | What to research/watch/read before coding. Go deep on these. |
| **Research Commands** | Terminal commands to run for hands-on exploration. |
| **Build Commands** | Exact commands to scaffold, install deps, and compile. |
| **Coding Prompt** | Copy this prompt and give it to the AI to generate the code. |
| **Testing** | How to verify the step works before moving on. |

**Workflow**: Read the concepts → run the research commands → run the build commands → give the prompt to the AI → test everything → move to next step.

---

# PHASE 1 — Foundation & Environment

---

## Step 1: Understanding Docker Engine API & Socket Communication

### Concepts to Explore
- Docker Client-Server architecture
- `/var/run/docker.sock` — what it is, how it works (Unix socket)
- Docker Engine HTTP API v1.44 endpoint reference
- TCP vs Unix socket connections to Docker daemon
- Exposing Docker daemon on TCP port 2375 (unsecured) and 2376 (TLS)
- Docker contexts (`docker context ls`)
- **Search**: "Docker socket explained", "Docker Engine API tutorial", "docker.sock security implications"
- Read: https://docs.docker.com/engine/api/

### Research Commands
```bash
# Explore Docker socket
ls -la /var/run/docker.sock
curl --unix-socket /var/run/docker.sock http://localhost/version
curl --unix-socket /var/run/docker.sock http://localhost/containers/json?all=true
curl --unix-socket /var/run/docker.sock http://localhost/images/json

# Test Docker TCP (if you have dockerd TCP enabled)
# curl http://localhost:2375/version

# Inspect docker daemon config
docker info | head -30
docker system df

# List all containers including stopped
docker ps -a --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

### Build Commands
```bash
mkdir -p ~/projects/docker-dashboard
cd ~/projects/docker-dashboard
mkdir -p backend frontend infra

# Initialize Go module
cd backend
go mod init github.com/YOUR_USERNAME/docker-dashboard/backend

# Initialize React frontend with Vite
cd ../frontend
npm create vite@latest . -- --template react
npm install
```

### Coding Prompt
```
I am building a Docker management dashboard. First, write a simple Go script (main.go) that:
1. Uses the Docker Engine API via HTTP to list all containers (including stopped ones)
2. Lists all Docker images on the local machine
3. Prints both lists as formatted JSON to stdout

Use the standard Go net/http library — NO external Docker SDK for Go yet. 
Connect to the Docker daemon via the Unix socket at /var/run/docker.sock.
Include proper error handling.

Save this as backend/cmd/explore/main.go
```

### Testing
```bash
cd backend
go run ./cmd/explore/main.go | jq .
# Verify: you should see JSON output with your local containers and images
```

---

## Step 2: Project Scaffold — Monorepo Structure & Docker Compose Dev Environment

### Concepts to Explore
- Monorepo vs polyrepo structure for fullstack projects
- Multi-stage Docker builds
- Docker Compose `depends_on` with health checks
- Named volumes vs bind mounts for development hot-reload
- Traefik vs Nginx as reverse proxy for development
- Environment variable management in Docker Compose
- **Search**: "Go project layout standard", "multi-stage Dockerfile Go", "Docker Compose health check"

### Research Commands
```bash
# Explore multi-stage build examples
docker buildx version

# Test health checks in compose
docker compose --help | grep -A5 "health"

# Understand Go project layout conventions
go doc golang.org/x/tools/cmd/goimports
go env GOMODCACHE
```

### Build Commands
```bash
cd ~/projects/docker-dashboard

# Create project structure
mkdir -p backend/cmd/server
mkdir -p backend/internal/{config,database,handlers,middleware,models,services,ws}
mkdir -p backend/pkg/dockerclient
mkdir -p frontend/src/{components,pages,hooks,utils,services}
mkdir -p infra/compose
mkdir -p infra/k8s
mkdir -p scripts

# Create root docker-compose.yaml
touch docker-compose.yaml
touch Makefile
touch .env.example

# Create Dockerfiles
touch backend/Dockerfile
touch backend/Dockerfile.dev
touch frontend/Dockerfile
touch frontend/Dockerfile.dev
touch infra/compose/.env

# Initialize git (optional)
git init && touch .gitignore
```

### Coding Prompt
```
Create the following files for a Docker-based monorepo development environment:

1. ROOT docker-compose.yaml:
   - Service 'db': PostgreSQL 16-alpine, port 5432, health check (pg_isready), volume for data persistence
   - Service 'backend': Our Go backend, built from backend/Dockerfile.dev, port 8080, depends_on db (healthy), mount backend/ for hot-reload, env vars for DB connection
   - Service 'frontend': Node dev server, built from frontend/Dockerfile.dev, port 5173, mount frontend/src/ for hot-reload, env var VITE_API_BASE_URL=http://localhost:8080
   - All services on a shared bridge network named 'dd-network'
   - Named volume 'pgdata' for PostgreSQL

2. backend/Dockerfile.dev:
   - Use golang:1.22-alpine
   - Install air (Go live-reload tool)
   - Workdir /app, copy go.mod/go.sum, download deps
   - CMD: air

3. frontend/Dockerfile.dev:
   - Use node:22-alpine
   - Workdir /app, copy package.json, npm install
   - CMD: npm run dev -- --host 0.0.0.0

4. Makefile at root with targets:
   - dev-up: docker compose up -d
   - dev-down: docker compose down
   - dev-logs: docker compose logs -f
   - backend-shell: exec into backend container
   - db-reset: drop and recreate database
   - clean: remove containers, volumes, images

5. .env.example with:
   DATABASE_URL=postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable
   JWT_SECRET=change-me-in-production
```

### Testing
```bash
# Build and verify the dev environment
make dev-up
docker compose ps
# All 3 services should show "healthy" or "Up"
make dev-logs
# Ctrl+C after verifying no errors

# Verify PostgreSQL
docker compose exec backend go run ./cmd/server/main.go
# Should try (and probably fail) to connect — that's fine, we'll add the actual server later

make dev-down
```

---

## Step 3: Go Backend Skeleton — HTTP Server, Config, Logging

### Concepts to Explore
- `net/http` default ServeMux vs third-party routers (chi, gin, gorilla/mux)
- Why we use **chi** — lightweight, idiomatic, stdlib-compatible, middleware pattern
- Structured logging with `slog` (Go 1.21+ standard library)
- Configuration management: env vars vs config files vs 12-factor app
- Graceful shutdown: signal handling, draining connections, timeouts
- **Search**: "Go chi router tutorial", "Go slog structured logging", "Go graceful shutdown pattern"

### Research Commands
```bash
# Explore chi router
go doc github.com/go-chi/chi/v5

# Explore slog
go doc log/slog

# Understand Go signal handling
go doc os/signal
go doc context.WithTimeout
```

### Build Commands
```bash
cd backend

# Install chi and dependencies
go get github.com/go-chi/chi/v5
go get github.com/go-chi/cors
go get github.com/joho/godotenv
go get go.uber.org/zap  # alternative structured logger (let's use slog)

go mod tidy
```

### Coding Prompt
```
Build the Go backend server skeleton. Create these files:

1. backend/internal/config/config.go:
   - Struct 'Config' with fields: Port, DatabaseURL, JWTSecret, LogLevel
   - Function 'Load() *Config' that reads from environment variables with defaults
   - Use os.Getenv, provide sensible defaults

2. backend/internal/handlers/health.go:
   - Handler for GET /api/health that returns {"status": "ok", "timestamp": "..."} as JSON
   - Handler for GET /api/health/db that pings the database and returns status

3. backend/cmd/server/main.go:
   - Load config
   - Create chi router
   - Add middleware: chi.Logger, chi.Recoverer, CORS (allow localhost:5173)
   - Mount routes: GET /api/health, GET /api/health/db
   - Start HTTP server on config.Port
   - Implement graceful shutdown: catch SIGINT/SIGTERM, 10-second drain timeout
   - Use slog for structured logging throughout

4. backend/internal/database/database.go:
   - Function 'Connect(databaseURL string) (*sql.DB, error)'
   - Use database/sql with lib/pq driver
   - Connection pool settings (max open: 25, max idle: 5, max lifetime: 5min)
   - Ping to verify connection
   - Log success/failure with slog
```

### Testing
```bash
# Build and test health endpoint
make dev-up
docker compose exec backend go run ./cmd/server/main.go
# In another terminal
curl http://localhost:8080/api/health
curl http://localhost:8080/api/health/db
# Both should return 200 JSON

# Test graceful shutdown — Ctrl+C the running server, verify it logs "shutting down"
make dev-down
```

---

## Step 4: Database Schema — Migrations & Models

### Concepts to Explore
- Database migrations: schema vs state-based, up/down patterns
- golang-migrate library for SQL migrations
- PostgreSQL data types: UUID, JSONB, TIMESTAMPTZ, ENUMs
- Foreign key constraints and ON DELETE CASCADE
- Indexing strategies for lookup-heavy tables
- **Search**: "golang-migrate tutorial", "PostgreSQL UUID primary key", "Go database/sql prepared statements"

### Research Commands
```bash
# Install golang-migrate CLI
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create migration files
migrate create -ext sql -dir backend/migrations -seq init_schema

# Explore Go database/sql
go doc database/sql.DB.QueryRow
go doc database/sql.DB.Exec
```

### Build Commands
```bash
cd backend
mkdir -p migrations

# Get migrate library and postgres driver
go get github.com/golang-migrate/migrate/v4
go get github.com/golang-migrate/migrate/v4/database/postgres
go get github.com/golang-migrate/migrate/v4/source/file
go get github.com/lib/pq

go mod tidy
```

### Coding Prompt
```
Design and implement the complete database schema. Create these files:

1. backend/migrations/000001_init_schema.up.sql:
   Users table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - username VARCHAR(150) UNIQUE NOT NULL
   - email VARCHAR(255) UNIQUE NOT NULL
   - password_hash VARCHAR(255) NOT NULL
   - role VARCHAR(20) NOT NULL DEFAULT 'developer' CHECK (role IN ('admin','developer','viewer'))
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()

   DockerHosts table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - owner_id UUID REFERENCES users(id) ON DELETE CASCADE
   - name VARCHAR(255) NOT NULL
   - host_ip VARCHAR(45) NOT NULL
   - port INT NOT NULL DEFAULT 2375
   - protocol VARCHAR(10) NOT NULL DEFAULT 'tcp' CHECK (protocol IN ('tcp','unix','ssh'))
   - auth_type VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','tls','ssh'))
   - tls_ca TEXT, tls_cert TEXT, tls_key TEXT
   - ssh_user VARCHAR(100), ssh_key TEXT
   - is_active BOOLEAN DEFAULT false
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(owner_id, host_ip, port)

   Containers table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - docker_container_id VARCHAR(64) NOT NULL
   - name VARCHAR(255) NOT NULL
   - image VARCHAR(500) NOT NULL
   - status VARCHAR(50) NOT NULL DEFAULT 'created'
   - ports JSONB DEFAULT '[]'
   - host_id UUID REFERENCES docker_hosts(id) ON DELETE CASCADE
   - created_by UUID REFERENCES users(id)
   - editable_by JSONB DEFAULT '[]'  -- array of user UUIDs
   - viewable_by JSONB DEFAULT '[]'  -- array of user UUIDs
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(host_id, docker_container_id)

   Networks table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - docker_network_id VARCHAR(64) NOT NULL
   - name VARCHAR(255) NOT NULL
   - driver VARCHAR(50) NOT NULL DEFAULT 'bridge'
   - scope VARCHAR(20) NOT NULL DEFAULT 'local'
   - internal BOOLEAN DEFAULT false
   - host_id UUID REFERENCES docker_hosts(id) ON DELETE CASCADE
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(host_id, docker_network_id)

   Volumes table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - docker_volume_id VARCHAR(64)
   - name VARCHAR(255) NOT NULL
   - driver VARCHAR(50) NOT NULL DEFAULT 'local'
   - mountpoint TEXT
   - host_id UUID REFERENCES docker_hosts(id) ON DELETE CASCADE
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(host_id, name)

   Images table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - docker_image_id VARCHAR(128) NOT NULL
   - name VARCHAR(500) NOT NULL
   - tag VARCHAR(255) NOT NULL DEFAULT 'latest'
   - size BIGINT DEFAULT 0
   - host_id UUID REFERENCES docker_hosts(id) ON DELETE CASCADE
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE(host_id, docker_image_id)

2. backend/migrations/000001_init_schema.down.sql:
   DROP TABLE IF EXISTS images, volumes, networks, containers, docker_hosts, users CASCADE;

3. backend/internal/database/migrate.go:
   - Function 'RunMigrations(db *sql.DB, migrationsPath string) error'
   - Uses golang-migrate to apply up migrations on startup
   - Log migration version after applying

4. backend/internal/models/models.go:
   - Define Go structs matching ALL tables: User, DockerHost, Container, Network, Volume, Image
   - Use proper Go types (string, bool, int64, time.Time, sql.Null*)
   - Add JSON tags for each field (snake_case)
   - DB tag `db:"column_name"` for each field
```

### Testing
```bash
# Run migrations
make dev-up
docker compose exec backend psql postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable -c '\dt'
# Should show empty

docker compose exec backend go run ./cmd/migrate/main.go
# Then verify:
docker compose exec backend psql postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable -c '\dt'
# Should show 6 tables: users, docker_hosts, containers, networks, volumes, images

docker compose exec backend psql postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable -c '\d users'
# Verify column types and constraints
```

---

## Step 5: Repository Pattern — Data Access Layer

### Concepts to Explore
- Repository pattern: abstracting data access behind interfaces
- Why repositories matter for testing (mock interfaces)
- SQL query builders vs raw SQL vs ORMs (GORM) — we'll use raw SQL for learning
- Go `database/sql` patterns: QueryRow, Query, Exec, prepared statements, transactions
- NULL handling: `sql.NullString`, `sql.NullInt64`, COALESCE in SQL
- **Search**: "Go repository pattern database/sql", "Go sql.NullString vs pointer", "Go database transaction pattern"

### Research Commands
```bash
go doc database/sql.DB.QueryRowContext
go doc database/sql.Tx
go doc database/sql.NullString
```

### Build Commands
```bash
cd backend
mkdir -p internal/repository

# We already have database/sql and lib/pq, no new deps needed
```

### Coding Prompt
```
Implement the Repository pattern for data access. Create these files:

1. backend/internal/repository/user_repo.go:
   Interface UserRepository with methods:
   - Create(ctx, user *models.User) error — INSERT with RETURNING id, created_at
   - FindByID(ctx, id uuid.UUID) (*models.User, error)
   - FindByUsername(ctx, username string) (*models.User, error)
   - FindByEmail(ctx, email string) (*models.User, error)
   - List(ctx) ([]models.User, error)

   Implementation UserRepo struct holding *sql.DB
   Use context-aware methods (QueryRowContext, ExecContext)

2. backend/internal/repository/host_repo.go:
   Interface HostRepository with methods:
   - Create(ctx, host *models.DockerHost) error
   - FindByID(ctx, id uuid.UUID) (*models.DockerHost, error)
   - FindByOwner(ctx, ownerID uuid.UUID) ([]models.DockerHost, error)
   - ListAll(ctx) ([]models.DockerHost, error)
   - UpdateStatus(ctx, id uuid.UUID, active bool) error
   - Delete(ctx, id uuid.UUID) error

3. backend/internal/repository/container_repo.go:
   Interface ContainerRepository with methods:
   - Create(ctx, c *models.Container) error
   - FindByID(ctx, id uuid.UUID) (*models.Container, error)
   - FindByDockerID(ctx, hostID uuid.UUID, dockerID string) (*models.Container, error)
   - FindByHost(ctx, hostID uuid.UUID) ([]models.Container, error)
   - UpdateStatus(ctx, id uuid.UUID, status string) error
   - Delete(ctx, id uuid.UUID) error
   - ListAccessibleByUser(ctx, hostID, userID uuid.UUID) ([]models.Container, error)
     -- This query checks: container.created_by = userID OR userID = ANY(container.editable_by) OR userID = ANY(container.viewable_by) OR user is admin

4. backend/internal/repository/network_repo.go, volume_repo.go, image_repo.go:
   Interface with: Create, FindByID, FindByHost, Delete
   For Network: FindByName(hostID, name), FindByContainer(containerID)
   For Volume:   FindByName(hostID, name)
   For Image:    FindByDockerID(hostID, dockerID), DeleteByDockerID

5. backend/internal/repository/repository.go:
   - Struct 'Repositories' holding all repository interfaces
   - Constructor 'NewRepositories(db *sql.DB) *Repositories'
```

### Testing
```bash
cd backend

# Create a quick integration test (we'll formalize later)
cat > /tmp/repo_test.go << 'GOEOF'
# A small Go test that creates a user via the repo and reads it back
# (Do this after the AI generates the code)
GOEOF

make dev-up
docker compose exec backend go test ./internal/repository/... -v -count=1
# Should pass — creating, reading, listing users
```

---

# PHASE 2 — Authentication & Authorization

---

## Step 6: JWT Authentication — Registration & Login

### Concepts to Explore
- JWT structure: Header.Payload.Signature
- Access tokens vs refresh tokens — when to use which
- HMAC-SHA256 vs RSA signing
- Password hashing: bcrypt, argon2id, scrypt
- Claims: registered claims (iss, sub, exp, iat) vs custom claims
- Token storage: localStorage vs httpOnly cookies vs memory
- CSRF protection considerations for SPA + API
- **Search**: "JWT best practices 2024", "bcrypt vs argon2", "Go golang-jwt tutorial", "SPA JWT storage security"

### Research Commands
```bash
# Explore golang-jwt
go doc github.com/golang-jwt/jwt/v5

# Explore bcrypt
go doc golang.org/x/crypto/bcrypt

# Inspect a JWT
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U" | cut -d'.' -f2 | base64 -d 2>/dev/null; echo
```

### Build Commands
```bash
cd backend
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
go get github.com/google/uuid
go mod tidy
```

### Coding Prompt
```
Implement JWT authentication with registration and login. Create these files:

1. backend/internal/auth/password.go:
   - HashPassword(password string) (string, error) — uses bcrypt with cost 12
   - CheckPassword(hash, password string) error — verify password against hash

2. backend/internal/auth/jwt.go:
   - Struct 'Claims' embedding jwt.RegisteredClaims + custom fields: UserID, Username, Role
   - GenerateAccessToken(userID, username, role string, secret []byte) (string, error) — expires in 15 minutes
   - GenerateRefreshToken(userID string, secret []byte) (string, error) — expires in 7 days
   - ValidateToken(tokenStr string, secret []byte) (*Claims, error)

3. backend/internal/handlers/auth_handler.go:
   - Struct holding Repositories and JWTSecret
   
   POST /api/auth/register:
   - Accept JSON: {username, email, password, role}
   - Validate all fields non-empty, role in [admin,developer,viewer], email format
   - Check username/email uniqueness (return 409 conflict if taken)
   - Hash password, create user in DB
   - Return 201 with user object (no password_hash)

   POST /api/auth/login:
   - Accept JSON: {username, password}
   - Find user by username (return 401 if not found)
   - Check password (return 401 if wrong)
   - Generate access + refresh tokens
   - Return 200 JSON: {access_token, refresh_token, user: {id, username, email, role}}

   POST /api/auth/refresh:
   - Accept JSON: {refresh_token}
   - Validate refresh token
   - Find user by ID from claims, verify user still exists
   - Generate new access + refresh tokens
   - Return 200 with new tokens

4. Wire these routes in main.go under /api/auth/*
```

### Testing
```bash
make dev-up
docker compose exec backend go run ./cmd/server/main.go &

# Test registration
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@test.com","password":"Test123!","role":"admin"}'

# Test login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Test123!"}'
# Save the access_token from the response

# Test token refresh
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<token from login>"}'

# Test duplicate registration (should fail with 409)
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@test.com","password":"Test123!","role":"admin"}'

# Test wrong password (should fail with 401)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'

pkill -f "go run" 2>/dev/null
```

---

## Step 7: Auth Middleware & Role-Based Access Control

### Concepts to Explore
- Middleware pattern in Go: wrapping http.Handler
- Extracting and validating Authorization header (Bearer token)
- Context values in Go (`context.WithValue`)
- Role hierarchy: admin > developer > viewer
- Permission checks: resource ownership vs role-based
- **Search**: "Go HTTP middleware pattern", "Go context.WithValue best practices", "Chi middleware chain order"

### Research Commands
```bash
go doc net/http.Handler
go doc context.WithValue

# Look at chi middleware source
cat $(go env GOMODCACHE)/github.com/go-chi/chi/v5@*/middleware/*.go | head -100
```

### Build Commands
```bash
# No new dependencies needed
```

### Coding Prompt
```
Implement JWT auth middleware and RBAC. Create these files:

1. backend/internal/middleware/auth.go:
   - Define context key types to avoid collisions

   Function 'AuthMiddleware(jwtSecret []byte) func(http.Handler) http.Handler':
   - Extract "Bearer <token>" from Authorization header
   - If missing/invalid, return 401 JSON {"error": "unauthorized"}
   - Parse and validate JWT token
   - Store Claims in request context using context.WithValue
   - Key functions: GetClaims(ctx), GetUserID(ctx), GetRole(ctx) — extract from context

   Function 'RequireRole(roles ...string) func(http.Handler) http.Handler':
   - Takes variadic allowed roles
   - Checks if user's role from context is in the allowed list
   - Returns 403 JSON {"error": "forbidden"} if not allowed

2. Wire middleware in main.go:
   - Apply AuthMiddleware to ALL /api/* routes except /api/auth/* and /api/health*
   - Example route groups:
     /api/auth/*      → no auth
     /api/admin/*     → AuthMiddleware + RequireRole("admin")
     /api/hosts/*     → AuthMiddleware (specific permission checks in handlers)

3. Add a test endpoint GET /api/me in a new handler:
   - Returns the authenticated user's info from JWT claims
   - Requires auth middleware
```

### Testing
```bash
docker compose exec backend go run ./cmd/server/main.go &

# Test unauthenticated request (should get 401)
curl http://localhost:8080/api/me

# Test authenticated request
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Test123!"}' | jq -r '.access_token')

curl http://localhost:8080/api/me -H "Authorization: Bearer $TOKEN"
# Should return user info from token

# Test invalid token
curl http://localhost:8080/api/me -H "Authorization: Bearer garbage"

# Test role-restricted endpoint (we'll create a test admin-only route)
curl http://localhost:8080/api/admin/test -H "Authorization: Bearer $TOKEN"
# Register a developer user and test they get 403 on admin routes

pkill -f "go run" 2>/dev/null
```

---

## Step 8: Docker SDK Integration in Go

### Concepts to Explore
- Official Docker Go SDK (`github.com/docker/docker/client`)
- Docker client initialization: from environment, from flags, manual connection
- API version negotiation
- Testing Docker connectivity with Ping
- Docker Go SDK types vs raw JSON responses
- Context usage with Docker SDK (timeouts)
- **Search**: "Docker Go SDK tutorial", "docker client golang connect remote daemon", "Docker Engine API version negotiation"

### Research Commands
```bash
# Explore Docker Go SDK
go doc github.com/docker/docker/client
go doc github.com/docker/docker/client.Client.ContainerList
go doc github.com/docker/docker/api/types

# Run a test container for exploration
docker run -d --name dd-test nginx:alpine
docker inspect dd-test | jq '.[0].NetworkSettings'
```

### Build Commands
```bash
cd backend
go get github.com/docker/docker/client
go get github.com/docker/docker/api/types
go get github.com/docker/docker/api/types/container
go get github.com/docker/docker/api/types/network
go get github.com/docker/docker/api/types/volume
go get github.com/docker/docker/api/types/image
go get github.com/docker/docker/api/types/filters
go mod tidy
```

### Coding Prompt
```
Create the Docker client abstraction layer. Create these files:

1. backend/pkg/dockerclient/client.go:
   Package dockerclient

   Struct 'DockerClient' wrapping *client.Client and metadata:
   - BaseURL string (e.g., "tcp://192.168.1.10:2375")
   - Client *client.Client

   Function 'NewClient(host string, port int, protocol string) (*DockerClient, error)':
   - Construct baseURL from protocol + host + port
   - If protocol is "unix", just use "/var/run/docker.sock"
   - Create Docker SDK client with client.WithHost(baseURL), client.WithAPIVersionNegotiation()
   - Return wrapped DockerClient

   Method 'Ping(ctx context.Context) error':
   - Calls client.Ping(ctx)
   - Returns error if daemon unreachable

   Method 'Close() error':
   - Closes the underlying HTTP connection

2. backend/pkg/dockerclient/container_ops.go:
   All methods on *DockerClient:

   ListContainers(ctx, all bool) ([]types.Container, error) — ContainerList with size=false
   InspectContainer(ctx, containerID string) (types.ContainerJSON, error)
   CreateContainer(ctx, config *container.Config, hostConfig *container.HostConfig, name string) (container.CreateResponse, error)
   StartContainer(ctx, containerID string, opts container.StartOptions) error
   StopContainer(ctx, containerID string, timeout *int) error
   RemoveContainer(ctx, containerID string, opts container.RemoveOptions) error
   ContainerLogs(ctx, containerID string, opts container.LogsOptions) (io.ReadCloser, error)
   ContainerStats(ctx, containerID string, stream bool) (types.ContainerStats, error)
   ExecCreate(ctx, containerID string, config types.ExecConfig) (types.IDResponse, error)

3. backend/pkg/dockerclient/network_ops.go:
   ListNetworks(ctx) ([]types.NetworkResource, error)
   InspectNetwork(ctx, networkID string) (types.NetworkResource, error)
   CreateNetwork(ctx, name string, opts types.NetworkCreate) (types.NetworkCreateResponse, error)
   RemoveNetwork(ctx, networkID string) error
   ConnectNetwork(ctx, networkID, containerID string, config *network.EndpointSettings) error
   DisconnectNetwork(ctx, networkID, containerID string, force bool) error

4. backend/pkg/dockerclient/volume_ops.go:
   ListVolumes(ctx) (volume.ListResponse, error)
   CreateVolume(ctx, opts volume.CreateOptions) (volume.Volume, error)
   RemoveVolume(ctx, volumeID string, force bool) error

5. backend/pkg/dockerclient/image_ops.go:
   ListImages(ctx, all bool) ([]image.Summary, error)
   PullImage(ctx, refStr string, opts image.PullOptions) (io.ReadCloser, error)
   RemoveImage(ctx, imageID string, opts image.RemoveOptions) ([]image.DeleteResponse, error)
```

### Testing
```bash
cd backend

# Create a small test program
cat > /tmp/docker_test.go << 'GOEOF'
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/YOUR_USERNAME/docker-dashboard/backend/pkg/dockerclient"
)

func main() {
    cl, err := dockerclient.NewClient("", 0, "unix")  // use local socket
    if err != nil {
        log.Fatal(err)
    }
    defer cl.Close()

    ctx := context.Background()
    if err := cl.Ping(ctx); err != nil {
        log.Fatal("Ping failed:", err)
    }
    fmt.Println("Ping OK!")

    containers, err := cl.ListContainers(ctx, true)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Found %d containers\n", len(containers))
    for _, c := range containers {
        fmt.Printf("  %s %s [%s]\n", c.ID[:12], c.Image, c.State)
    }
}
GOEOF

go run /tmp/docker_test.go
# Should list your local Docker containers

# Clean up test container
docker rm -f dd-test
```

---

## Step 9: Host Management API — Register & Connect to Remote Docker

### Concepts to Explore
- Remote Docker daemon exposure: `-H tcp://0.0.0.0:2375` (insecure) vs TLS
- Docker daemon configuration: `/etc/docker/daemon.json`
- SSH tunneling to remote Docker (`ssh -L 2375:localhost:2375 remote-host`)
- Docker contexts and SSH-based remote access
- Connection pooling and timeout strategies for remote Docker
- **Search**: "Expose Docker daemon TCP", "Docker TLS setup", "Connect to remote Docker daemon Go"

### Research Commands
```bash
# Explore how Docker contexts work
docker context ls
docker context create --help

# Test Docker daemon config
cat /etc/docker/daemon.json 2>/dev/null || echo "No daemon.json found"

# Simulate remote Docker — forward local socket to TCP for testing
socat TCP-LISTEN:2376,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock &
# Then connect to tcp://localhost:2376 as if it were remote
curl http://localhost:2376/version
# Kill socat after testing: pkill socat
```

### Build Commands
```bash
# No new deps needed — using our dockerclient package
```

### Coding Prompt
```
Implement the Docker Host management API. Create these files:

1. backend/internal/handlers/host_handler.go:
   Struct HostHandler holding Repositories and a map of active DockerClients

   POST /api/hosts — Create a Docker host:
   - Accept JSON: {name, host_ip, port, protocol, auth_type, tls_ca?, tls_cert?, tls_key?}
   - Authenticated user from JWT becomes owner
   - Attempt to connect: create DockerClient, call Ping()
   - If connection fails, return 400 with specific error (e.g., "connection refused", "timeout")
   - If connected, save host to DB with is_active=true
   - Return 201 with host object

   GET /api/hosts — List hosts for authenticated user:
   - If admin: return ALL hosts
   - If developer/viewer: return only hosts they own

   GET /api/hosts/{hostID} — Get host details:
   - Return host + live stats (container count, image count, network count, volume count)
   - Use DockerClient to fetch real-time counts from the daemon
   - Also return cached DB counts as fallback

   DELETE /api/hosts/{hostID} — Delete a host:
   - Verify user owns the host (or is admin)
   - Remove from DB

   POST /api/hosts/{hostID}/test-connection — Test connectivity:
   - Create DockerClient, call Ping()
   - Update is_active in DB
   - Return {connected: bool, error: string}

2. Implement proper error responses with a helper:
   backend/internal/handlers/errors.go:
   - JSONError(w, status, message string)
   - Handle common error patterns (host not found → 404, permission denied → 403)

3. Wire routes in router setup with auth middleware
```

### Testing
```bash
docker compose exec backend go run ./cmd/server/main.go &

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Test123!"}' | jq -r '.access_token')

# Register the local Docker as a host (using unix socket)
curl -X POST http://localhost:8080/api/hosts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Local Docker","host_ip":"localhost","port":2375,"protocol":"unix","auth_type":"none"}'
# May need to adjust for unix socket — or test with TCP

# For local Docker via socket, you may need to map /var/run/docker.sock into the container
# We'll handle that in docker-compose.yaml

# List hosts
curl http://localhost:8080/api/hosts -H "Authorization: Bearer $TOKEN" | jq .

# Test connection
curl -X POST http://localhost:8080/api/hosts/<host-id>/test-connection \
  -H "Authorization: Bearer $TOKEN" | jq .

pkill -f "go run" 2>/dev/null
```

---

# PHASE 3 — Frontend Foundation

---

## Step 10: React Frontend Setup — Vite, Router, Tailwind, Axios

### Concepts to Explore
- Vite vs CRA (Create React App) — why Vite is superior
- SPA routing with React Router v6+ (BrowserRouter, Routes, Route)
- Component organization: pages vs components vs layouts
- Axios interceptors for JWT token injection
- Tailwind CSS utility-first workflow
- Environment variables in Vite (`VITE_` prefix)
- **Search**: "React Router v6 tutorial 2024", "Axios interceptors JWT React", "Vite proxy configuration"

### Research Commands
```bash
# Explore Vite
npx vite --help

# Explore React Router
npm view react-router-dom version

# Check what we already have
cd frontend && ls -la
cat vite.config.js
```

### Build Commands
```bash
cd frontend

# Core dependencies
npm install react-router-dom axios

# Dev dependencies for Tailwind
npm install -D tailwindcss @tailwindcss/vite
# Or: npx tailwindcss init -p  (for older Tailwind v3)

# Check generated configs
ls tailwind.config.js postcss.config.js 2>/dev/null
```

### Coding Prompt
```
Set up the React frontend foundation. Create/modify these files:

1. frontend/tailwind.config.js:
   ```js
   /** @type {import('tailwindcss').Config} */
   export default {
     content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
     theme: { extend: {} },
     plugins: [],
   }
   ```

2. frontend/postcss.config.js:
   Standard Tailwind + autoprefixer config

3. frontend/src/index.css:
   Replace with:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   
   body {
     @apply bg-gray-900 text-gray-100 min-h-screen;
   }
   ```

4. frontend/src/services/api.ts:
   - Create axios instance with baseURL from VITE_API_BASE_URL env var
   - Request interceptor: add Authorization Bearer token from localStorage
   - Response interceptor: on 401, attempt token refresh (POST /api/auth/refresh), retry original request
   - If refresh also fails, clear tokens and redirect to /login
   - Export the configured axios instance as default

5. frontend/src/utils/auth.ts:
   - getAccessToken(): string | null
   - getRefreshToken(): string | null
   - setTokens(access, refresh): void
   - clearTokens(): void
   - parseJWT(token: string): {userId, username, role, exp} | null
   - isTokenExpired(token: string): boolean
   - getCurrentUser(): {userId, username, role} | null

6. frontend/src/App.tsx:
   - BrowserRouter wrapping everything
   - Routes:
     / → SplashPage
     /login → LoginPage
     /register → RegisterPage
     /dashboard → DashboardPage (protected)
     /hosts/:hostId → HostDetailPage (protected)
     /hosts/:hostId/containers/:containerId → ContainerDetailPage (protected)
     /hosts/create → CreateHostPage (protected)
   - ProtectedRoute wrapper component that checks token existence

7. frontend/src/components/Layout.tsx:
   - Navbar with: logo/title, navigation links, user info, logout button
   - Main content area with proper padding
   - Responsive sidebar navigation
```

### Testing
```bash
make dev-up
# Frontend should be available at http://localhost:5173
# Visit in browser — should see the home page (empty React app with Tailwind)
# Check browser console for any errors

# Test that the app compiles without errors
docker compose exec frontend npm run build
# Should produce dist/ folder without errors
```

---

## Step 11: Auth Pages — Login, Register, Splash Screen

### Concepts to Explore
- Controlled forms in React with useState
- Form validation patterns (client-side)
- React Router's useNavigate and useLocation
- Protected routes: redirect to login if unauthenticated
- Error handling in API calls (try/catch with typed errors)
- **Search**: "React form best practices", "React protected route pattern", "React Router redirect after login"

### Research Commands
```bash
# Explore React Router hooks
npm view react-router-dom | grep -i navigate
```

### Coding Prompt
```
Build authentication pages and protected routing. Create these files:

1. frontend/src/pages/SplashPage.tsx:
   - Hero section with project name "Docker Dashboard"
   - Brief tagline: "Manage multiple Docker hosts from one dashboard"
   - Two buttons: "Login" and "Register"
   - Clean, centered layout with dark theme styling
   - If user is already logged in, redirect to /dashboard

2. frontend/src/pages/LoginPage.tsx:
   - Form: username (text input), password (password input)
   - Submit button with loading state
   - Call POST /api/auth/login via our axios instance
   - On success: store tokens, redirect to /dashboard
   - On error: display error message below form
   - Link to register page

3. frontend/src/pages/RegisterPage.tsx:
   - Form: username, email, password, confirm password, role (select: admin/developer/viewer)
   - Client-side validation: passwords match, email format, all fields filled
   - Call POST /api/auth/register via our axios instance
   - On success: redirect to login with success message
   - On error: display field-specific errors

4. frontend/src/components/ProtectedRoute.tsx:
   - Checks if user has valid access token (exists AND not expired)
   - If not authenticated: redirect to /login, store intended destination
   - On login success, redirect back to intended destination
   - If authenticated: render children (use <Outlet /> pattern)

5. frontend/src/components/Navbar.tsx:
   - Dark theme navbar fixed to top
   - Left: app logo/name → links to /dashboard
   - Right: username -> logout button
   - Only rendered when user is authenticated (use auth state)
```

### Testing
```bash
# Frontend should be running at localhost:5173
# Test flow manually in browser:
# 1. Visit / → see splash page
# 2. Click Register → fill form → submit
# 3. Should redirect to login → enter credentials → submit
# 4. Should redirect to /dashboard (which will be empty for now)
# 5. Check localStorage for access_token and refresh_token
# 6. Logout → should redirect to splash page

# Test error cases:
# - Register with existing username → should show error
# - Login with wrong password → should show error
# - Try accessing /dashboard directly without login → should redirect to /login
```

---

## Step 12: Host Dashboard — List, Create, Delete Docker Hosts

### Concepts to Explore
- Data fetching in React: useEffect + useState pattern
- React Query / TanStack Query (optional, for caching) — let's use useEffect for learning
- Refresh tokens: catching 401 errors and automatically refreshing
- Modal components in React (portals vs inline)
- Confirmation dialogs for destructive actions
- **Search**: "React fetch data useEffect", "React modal pattern", "React confirmation dialog"

### Research Commands
```bash
# Explore useEffect patterns
# Read React docs on effects
npx react --help
```

### Coding Prompt
```
Build the host management dashboard. Create these files:

1. frontend/src/pages/DashboardPage.tsx:
   - On mount: fetch GET /api/hosts (authenticated)
   - Display hosts as cards in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
   - Each host card shows:
     - Host name (bold, large)
     - IP:port
     - Status badge: green "Active" / red "Inactive"
     - Resource counts: X containers, Y images, Z networks, W volumes
     - Click card → navigate to /hosts/{hostId}
   - "Add Host" button (top right) → navigate to /hosts/create
   - Loading skeleton while fetching
   - Empty state if no hosts: "No Docker hosts registered yet. Add your first host!"

2. frontend/src/pages/CreateHostPage.tsx:
   - Form fields:
     - Name (text, required)
     - Host IP (text, required)
     - Port (number, default 2375)
     - Protocol (select: tcp / unix / ssh, default tcp)
     - Authentication (select: none / tls / ssh)
     - TLS fields (shown conditionally): CA Cert (textarea), Client Cert, Client Key
     - SSH fields (shown conditionally): SSH User, SSH Key (textarea)
   - "Test Connection" button → POST /api/hosts/{hostId}/test-connection (after saving? or before)
     - Show spinner while testing
     - Show green success or red error
   - "Save Host" button → POST /api/hosts
   - On success: redirect to /dashboard
   - Back button → /dashboard

3. frontend/src/components/HostCard.tsx:
   - Reusable card component for host display
   - Props: host data, onClick handler
   - Shows name, IP, status indicator, resource counts

4. frontend/src/components/ConfirmDialog.tsx:
   - Reusable modal for confirmation
   - Props: isOpen, title, message, onConfirm, onCancel
   - Overlay + centered modal, dark theme
   - "Cancel" and "Confirm" buttons

5. frontend/src/components/LoadingSpinner.tsx:
   - Simple animated spinner component
   - Used in loading states throughout the app

6. frontend/src/hooks/useApi.ts:
   - Custom hook wrapping data fetching with loading/error states
   - Returns { data, loading, error, refetch }
   - Handles token refresh automatically via axios interceptor
```

### Testing
```bash
# In browser:
# 1. Login as admin
# 2. Visit /dashboard → should see empty state
# 3. Click "Add Host"
# 4. Fill in host details (for local Docker, you need /var/run/docker.sock mounted in backend container)
# 5. Test connection → should succeed or show specific error
# 6. Save → should redirect to dashboard with new host card
# 7. Click host card → should navigate to host detail (we'll build that next)

# Test error handling:
# - Try adding host with unreachable IP → should show connection error
# - Try duplicate host (same IP:port for same user) → should show error
```

---

# PHASE 4 — Docker Resource Management

---

## Step 13: Host Detail Page — Container Listing

### Concepts to Explore
- REST API design for nested resources: /hosts/{id}/containers
- Fetching data on route change with useEffect dependency arrays
- Table vs card layouts for resource lists
- Filtering and sorting on the client side
- **Search**: "React nested routes pattern", "REST API resource nesting best practices"

### Coding Prompt
```
Build the host detail and container listing pages. Create these files:

1. frontend/src/pages/HostDetailPage.tsx:
   - Use useParams to get hostId from URL
   - Fetch GET /api/hosts/{hostId} for host info (name, IP, status, resource counts)
   - Fetch GET /api/hosts/{hostId}/containers for container list
   - Display host info header (name, address, status dot, active/inactive)
   - Tab-like navigation or section cards for: Containers | Networks | Volumes | Images
   - Default to Containers tab
   - Each tab shows its resource list
   - "Back to Dashboard" link

2. frontend/src/pages/HostDetailPage.tsx (Containers tab — could be in-page, or separate component):
   - Table/card list of containers showing:
     - Container name
     - Docker container ID (truncated, first 12 chars)
     - Image name
     - Status (with colored badge: green=running, yellow=paused, grey=stopped, red=error)
     - Ports (formatted: 80:8080, 443→8443)
     - Created date (relative: "2 hours ago", "3 days ago")
   - Click row → navigate to /hosts/{hostId}/containers/{containerId}
   - "Create Container" button → opens CreateContainerPage or modal
   - Refresh button to reload list
   - Empty state: "No containers on this host"
   - Loading skeleton while fetching

3. frontend/src/hooks/useHost.ts:
   - Custom hook: useHost(hostId) returns { host, containers, loading, error, refresh }
   - Combines multiple API calls
   - Proper cleanup on unmount

4. frontend/src/utils/formatters.ts:
   - formatBytes(bytes: number): string → "1.5 GB", "256 MB"
   - formatRelativeTime(dateString: string): string → "2 hours ago"
   - formatPorts(ports: Port[]): string → "80:8080, 443:8443"
```

### Testing
```bash
# In browser:
# 1. Login → Dashboard → click on a host
# 2. Should see host details with container list
# 3. Verify container status colors match actual states
# 4. Click on a container → should navigate to container detail (empty for now)

# Test edge cases:
# - Host with no containers → show empty state
# - Host that is inactive → show warning banner
# - Refresh list after creating a container elsewhere

# Create some test containers for the list:
docker run -d --name test-nginx nginx:alpine
docker run -d --name test-redis redis:alpine
docker stop test-redis
# Refresh the page — should show 1 running, 1 stopped
```

---

## Step 14: Create Container & Container Operations

### Concepts to Explore
- Docker container create vs run
- Container configuration: image, ports, env vars, volumes, networks, restart policy
- HostConfig vs Config in Docker API
- Port binding format: "8080:80/tcp"
- Volume binding format: "/host/path:/container/path"
- Pulling images before container creation (or relying on Docker's auto-pull)
- **Search**: "Docker API create container", "Docker HostConfig port bindings", "Docker Go SDK ContainerCreate example"

### Coding Prompt
```
Implement container creation and basic operations. Create these files:

1. backend/internal/handlers/container_handler.go:

   POST /api/hosts/{hostID}/containers:
   - Accept JSON:
     {
       "name": "my-container",
       "image": "nginx:alpine",
       "ports": [{"container_port": 80, "host_port": 8080, "protocol": "tcp"}],
       "env_vars": {"ENV1": "val1"},
       "volumes": ["/host/path:/container/path"],
       "restart_policy": "unless-stopped",
       "network": "bridge",
       "start": true  // auto-start after creation
     }
   - Create DockerClient for the host
   - Pull image first (or just let Docker auto-pull on create)
   - Build container.Config and container.HostConfig
   - Call CreateContainer + StartContainer (if start=true)
   - Save container record to DB
   - Return 201 with container details

   POST /api/hosts/{hostID}/containers/{containerID}/start:
   - Start the container via Docker daemon
   - Update status in DB
   - Return 200

   POST /api/hosts/{hostID}/containers/{containerID}/stop:
   - Stop the container (with optional timeout query param)
   - Update status in DB
   - Return 200

   DELETE /api/hosts/{hostID}/containers/{containerID}:
   - Stop (if running), then remove from Docker
   - Delete record from DB
   - Return 204

2. frontend/src/pages/CreateContainerPage.tsx:
   - Form fields:
     - Container name (text, optional — Docker auto-generates if empty)
     - Image name (text, required, e.g., "nginx:alpine", "python:3.11-slim")
     - Port mappings: dynamic list of {containerPort, hostPort, protocol}
       - "Add Port" button to add new row
       - Remove button on each row
     - Environment variables: dynamic list of key-value pairs
       - "Add Env Var" button
     - Volume mounts: dynamic list of {hostPath, containerPath}
       - "Add Volume" button
     - Restart policy (select: no/always/on-failure/unless-stopped)
     - Network (select from available networks on host)
     - Auto-start checkbox (default: true)
   - Submit → POST /api/hosts/{hostID}/containers
   - On success: redirect to container detail page
   - Loading state during creation (image pull can take a while)

3. frontend/src/components/DynamicListInput.tsx:
   - Reusable component for dynamic key-value or multi-field list inputs
   - Used for ports, env vars, volume mounts
   - Add/remove rows
   - Props: items, onChange, addLabel, fields definition
```

### Testing
```bash
# Create a container via API
TOKEN=...
curl -X POST http://localhost:8080/api/hosts/<host-id>/containers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-web",
    "image": "nginx:alpine",
    "ports": [{"container_port": 80, "host_port": 8888, "protocol": "tcp"}],
    "start": true
  }'

# Verify container was created
docker ps -a --filter name=test-web

# Test start/stop
curl -X POST http://localhost:8080/api/hosts/<host-id>/containers/<container-id>/stop \
  -H "Authorization: Bearer $TOKEN"
# Check docker ps to verify

# Test delete
curl -X DELETE http://localhost:8080/api/hosts/<host-id>/containers/<container-id> \
  -H "Authorization: Bearer $TOKEN"
# Container should be gone
```

---

## Step 15: Network & Volume Management

### Concepts to Explore
- Docker network drivers: bridge, host, overlay, macvlan, none
- Network scopes: local vs swarm
- Connecting containers to networks at runtime vs at creation
- Docker volumes: named volumes vs bind mounts
- Volume drivers and mountpoints
- **Search**: "Docker network types explained", "Docker volumes vs bind mounts", "Docker networking deep dive"

### Coding Prompt
```
Implement network and volume management APIs and frontend. Create:

1. backend/internal/handlers/network_handler.go:

   GET /api/hosts/{hostID}/networks — list networks on a host
   POST /api/hosts/{hostID}/networks — create network
     - Accept: {name, driver, subnet?, gateway?, internal?, attachable?}
   DELETE /api/networks/{networkID} — remove network
   GET /api/hosts/{hostID}/containers/{containerID}/networks — container's connected networks
   POST /api/networks/{networkID}/connect — connect container to network
     - Accept: {container_id}
   POST /api/networks/{networkID}/disconnect — disconnect container

2. backend/internal/handlers/volume_handler.go:

   GET /api/hosts/{hostID}/volumes — list volumes
   POST /api/hosts/{hostID}/volumes — create volume
     - Accept: {name, driver, driver_opts?, labels?}
   DELETE /api/volumes/{volumeID} — remove volume

3. frontend/src/pages/ManageNetworksPage.tsx:
   - List networks table: name, driver, scope, container count
   - "Create Network" button → opens form/modal
   - Delete button with confirmation
   - Click network → show details (connected containers)
   - Connect/disconnect container from network

4. frontend/src/pages/CreateNetworkPage.tsx (or modal component):
   - Form: name, driver (select), subnet, gateway, internal (checkbox)

5. frontend/src/pages/ManageVolumesPage.tsx:
   - List volumes: name, driver, mountpoint
   - "Create Volume" button → opens form/modal
   - Delete button with confirmation (warn if volume is in use)

6. frontend/src/pages/CreateVolumePage.tsx (or modal):
   - Form: name, driver, labels (key-value pairs)
```

### Testing
```bash
# Test network creation
TOKEN=...
curl -X POST http://localhost:8080/api/hosts/<host-id>/networks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-network","driver":"bridge"}'

# Verify in Docker
docker network ls | grep test-network

# Test connecting container to network
curl -X POST http://localhost:8080/api/networks/<network-id>/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"container_id":"<container-id>"}'

# Test volume creation
curl -X POST http://localhost:8080/api/hosts/<host-id>/volumes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-volume","driver":"local"}'

docker volume ls | grep test-volume

# Test frontend navigation
# Click through Networks and Volumes tabs on host detail page
```

---

## Step 16: Image Management — List, Pull, Delete

### Concepts to Explore
- Docker image naming: repository:tag format
- Image layers and layer caching
- Pulling from registries: Docker Hub, ECR, GCR, private registries
- Image size calculation and disk usage
- Pruning unused images
- **Search**: "Docker image registry pull API", "Docker image layers explained", "Docker pull from private registry"

### Coding Prompt
```
Implement image management APIs and frontend. Create:

1. backend/internal/handlers/image_handler.go:

   GET /api/hosts/{hostID}/images — list all images with sizes
   POST /api/hosts/{hostID}/images/pull — pull image from registry
     - Accept: {image: "nginx:alpine", registry_auth?: {username, password, serveraddress}}
     - Stream pull progress (chunked response or just wait for completion)
     - Save pulled image record to DB
     - Return image details
   DELETE /api/hosts/{hostID}/images/{imageID} — remove image from Docker and DB

2. frontend/src/pages/ManageImagesPage.tsx:
   - Table: repository:tag, image ID (truncated), size, created date
   - Search/filter by image name
   - "Pull Image" button → opens modal/form
   - Delete button with confirmation

3. frontend/src/pages/CreateImagePage.tsx (or PullImageModal):
   - Form: image name (e.g., "python:3.11-slim")
   - Registry credentials (optional, collapsible): username, password, server
   - "Pull Image" button → POST /api/hosts/{hostID}/images/pull
   - Show pull progress (or spinner with estimated time)
   - On success: close modal, refresh image list
```

### Testing
```bash
# Test image list
TOKEN=...
curl http://localhost:8080/api/hosts/<host-id>/images -H "Authorization: Bearer $TOKEN" | jq .

# Test pull image
curl -X POST http://localhost:8080/api/hosts/<host-id>/images/pull \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image":"alpine:3.19"}'

# Verify
docker images | grep alpine

# Test delete
curl -X DELETE http://localhost:8080/api/hosts/<host-id>/images/<image-id> \
  -H "Authorization: Bearer $TOKEN"

# Frontend:
# Visit Images tab on host detail → should list images
# Pull a new image → should appear in list
```

---

# PHASE 5 — Real-Time Features (WebSockets)

---

## Step 17: WebSocket Fundamentals in Go

### Concepts to Explore
- WebSocket protocol: Upgrade handshake, frames, ping/pong
- WebSocket vs SSE (Server-Sent Events) vs polling
- gorilla/websocket library for Go
- WebSocket in Go: read loop, write loop, channels
- Client connection management: map of connected clients
- Graceful WebSocket shutdown
- **Search**: "Go gorilla/websocket tutorial", "WebSocket protocol RFC 6455", "Go WebSocket chat example", "WebSocket authentication JWT"

### Research Commands
```bash
# Explore gorilla/websocket
go doc github.com/gorilla/websocket

# Test a WebSocket connection manually
# (install websocat: go install github.com/vi/websocat/cmd/websocat@latest)
websocat ws://echo.websocket.org 2>/dev/null || echo "websocat not installed"
```

### Build Commands
```bash
cd backend
go get github.com/gorilla/websocket
go mod tidy
```

### Coding Prompt
```
Build the WebSocket infrastructure. Create these files:

1. backend/internal/ws/hub.go:
   - Struct 'Hub' (connection manager):
     - clients map[*Client]bool
     - broadcast chan []byte
     - register/unregister chan *Client
   - Run() goroutine: select on channels
   - Methods: Register, Unregister, Broadcast

2. backend/internal/ws/client.go:
   - Struct 'Client':
     - conn *websocket.Conn
     - hub *Hub
     - send chan []byte
     - userID uuid.UUID
     - role string
   - ReadPump() goroutine: reads messages, handles close
   - WritePump() goroutine: writes from send channel, handles ping

3. backend/internal/ws/upgrader.go:
   - Configure gorilla/websocket.Upgrader:
     - CheckOrigin: allow all origins (for dev)
     - Read/Write buffer sizes
   - Function 'HandleWebSocket(hub *Hub, jwtSecret []byte) http.HandlerFunc':
     - Upgrade HTTP to WebSocket
     - Extract JWT token from query param (?token=xxx)
     - Validate token, get user info
     - Create Client, register with Hub
     - Start ReadPump and WritePump goroutines

4. backend/internal/handlers/ws_handler.go:
   - Simple echo test: whatever client sends, server echoes back
   - Mount at GET /api/ws
   - Support token auth via query param: ws://host:8080/api/ws?token=xxx

5. Update main.go to:
   - Create Hub and run it
   - Mount WebSocket handler
```

### Testing
```bash
make dev-up
docker compose exec backend go run ./cmd/server/main.go &

# Get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Test123!"}' | jq -r '.access_token')

# Test with websocat
echo "Hello WebSocket!" | websocat ws://localhost:8080/api/ws?token=$TOKEN
# Should echo back "Hello WebSocket!"

# Test without token (should fail)
echo "Hello" | websocat ws://localhost:8080/api/ws
# Should close with error

# Test with invalid token
echo "Hello" | websocat "ws://localhost:8080/api/ws?token=invalid"
# Should close with error

pkill -f "go run" 2>/dev/null
```

---

## Step 18: Streaming Container Logs via WebSocket

### Concepts to Explore
- Docker log streaming: `container.Logs(stream=true, follow=true)`
- Docker log drivers: json-file, journald, syslog, fluentd
- Log options: tail, since, until, timestamps
- Goroutine lifecycle: starting and stopping log readers
- Cleanup: closing Docker log readers on WebSocket disconnect
- **Search**: "Docker logs API stream", "Docker Go SDK ContainerLogs", "Go goroutine cancellation pattern"

### Coding Prompt
```
Implement live container log streaming. Create:

1. backend/internal/ws/log_consumer.go:
   - Endpoint: /api/ws/containers/{containerID}/logs
   
   On WebSocket connect:
   - Extract hostID and containerID from URL
   - Authenticate user via token
   - Create DockerClient for the host
   - Call ContainerLogs with follow=true, tail=100, timestamps=true
   - Spawn goroutine: read log stream line-by-line, send each line over WebSocket
   - Use context.WithCancel for cleanup on disconnect
   - Handle container not found, log driver errors gracefully
   
   On WebSocket message from client:
   - "stop" → stop streaming but keep connection
   - "resume" → resume streaming
   - "tail=N" → restart streaming with new tail value

   Graceful shutdown:
   - When WebSocket closes → cancel the log reading context
   - Close the Docker log reader

2. backend/internal/handlers/logs_handler.go (REST fallback):
   - GET /api/hosts/{hostID}/containers/{containerID}/logs:
     - Query params: tail (default 100), since, until, timestamps (bool)
     - Return logs as JSON array of lines
     - For quick log snapshots without WebSocket

3. frontend/src/pages/ContainerDetailPage.tsx (Logging section):
   - "View Logs" button → opens modal/slide-out panel
   - WebSocket connection to /api/ws/containers/{containerID}/logs?token=xxx
   - Terminal-style display: monospace font, green text on black background
   - Auto-scroll to bottom (with toggle to pause auto-scroll)
   - Controls: Stop streaming, Resume, Download logs
   - Search/filter within log buffer
   - Clean connection on component unmount

4. frontend/src/hooks/useWebSocket.ts:
   - Custom hook for WebSocket connections
   - Handles connect/disconnect/reconnect logic
   - Returns: { sendMessage, lastMessage, readyState, connect, disconnect }
   - Auto-reconnect with exponential backoff (max 5 retries)
   - Cleanup on unmount
```

### Testing
```bash
# Start a long-running test container
docker run -d --name log-test alpine:latest sh -c 'while true; do echo "Log line $(date)"; sleep 1; done'

# Test REST logs
TOKEN=...
curl "http://localhost:8080/api/hosts/<host-id>/containers/<container-id>/logs?tail=10&timestamps=true" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test WebSocket logs
websocat "ws://localhost:8080/api/ws/containers/<container-id>/logs?token=$TOKEN"
# Should see log lines streaming in real-time

# Test frontend:
# Navigate to container detail → click "View Logs"
# Should see live log streaming in terminal-style view

# Cleanup
docker rm -f log-test
```

---

## Step 19: Real-Time Container Stats with Chart.js

### Concepts to Explore
- Docker stats API: CPU %, memory usage, network I/O, block I/O, PIDs
- CPU calculation: total_usage / system_cpu_usage * num_cores
- Memory calculation: usage - cache vs limit
- Chart.js with React: dynamic chart updates
- Performance: chart update frequency vs rendering overhead
- **Search**: "Docker stats API CPU calculation", "Chart.js real-time line chart React", "Docker container resource monitoring"

### Coding Prompt
```
Implement real-time container statistics streaming. Create:

1. backend/internal/ws/stats_consumer.go:
   - Endpoint: /api/ws/containers/{containerID}/stats
   
   On connect:
   - Authenticate + authorize user
   - Create DockerClient
   - Call ContainerStats with stream=true
   - Spawn goroutine: decode JSON stats stream every 2 seconds
   - For each stats entry, compute:
     - cpu_percent: (cpu_delta / system_delta) * num_cpus * 100
     - memory_usage: used - cache
     - memory_percent: (used / limit) * 100
     - network_rx, network_tx
     - block_read, block_write
     - pids_current
   - Send structured JSON over WebSocket: {timestamp, cpu, memory, memoryPercent, netRx, netTx, pids}
   - Cancel stream on disconnect

2. frontend/src/components/StatsPanel.tsx:
   - WebSocket connection to stats endpoint
   - Real-time Chart.js line charts:
     - CPU % (0-100%, auto-scale Y axis)
     - Memory usage (MB, with limit line)
     - Network I/O (KB/s, two lines: RX green, TX blue)
   - Charts update in real-time, showing last 60 data points (2 min of data at 2s interval)
   - Current value displayed as large number above each chart
   - Stats panel in expandable section on container detail page

3. frontend/src/components/LiveChart.tsx:
   - Reusable Chart.js wrapper for real-time data
   - Props: data, labels, config (colors, max points, update interval)
   - Handles chart.js instance lifecycle (create/update/destroy)
   - Responsive: adapts to container width
```

### Testing
```bash
# Start a container that uses resources
docker run -d --name stats-test nginx:alpine

# Test WebSocket stats
TOKEN=...
websocat "ws://localhost:8080/api/ws/containers/<container-id>/stats?token=$TOKEN"
# Should see JSON stats streaming every 2 seconds

# Verify CPU/memory values are reasonable
# Generate some CPU load on the container:
docker exec stats-test sh -c 'for i in $(seq 4); do yes > /dev/null & done'
# Watch CPU spike in stats

# Cleanup
docker rm -f stats-test

# Frontend:
# Open container detail → stats panel should show live charts
# Verify charts update smoothly
```

---

## Step 20: Interactive Terminal (Docker Exec) via WebSocket

### Concepts to Explore
- Docker exec: interactive vs non-interactive
- TTY vs non-TTY sessions
- Docker exec socket: stdin, stdout, stderr multiplexing
- Docker multiplex protocol: 8-byte header (stream type + length)
- Terminal emulation: xterm.js for browser-based terminals
- PTY allocation for exec sessions
- **Search**: "Docker exec API interactive", "Docker attach vs exec", "xterm.js WebSocket backend", "Docker demultiplex stream protocol"

### Research Commands
```bash
# Test exec manually
docker exec -it <container-id> /bin/sh
docker exec <container-id> ls -la  # non-interactive

# Explore Docker exec protocol
docker exec --help
```

### Build Commands
```bash
cd frontend
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

### Coding Prompt
```
Implement the interactive container terminal. Create:

1. backend/internal/ws/terminal_consumer.go:
   - Endpoint: /api/ws/containers/{containerID}/exec
   
   Step 1: Create exec instance on connect:
   - ExecConfig: AttachStdin=true, AttachStdout=true, AttachStderr=true, Tty=true, Cmd=["/bin/sh"]
   
   Step 2: Attach to exec:
   - conn, err := client.ContainerExecAttach(ctx, execID, types.ExecStartCheck{Tty: true})
   - Use the docker attach connection (Conn) for bidirectional I/O
   
   Step 3: Bidirectional streaming:
   - Goroutine 1: Read from WebSocket → write to Docker exec stdin
   - Goroutine 2: Read from Docker exec stdout → write to WebSocket
   - Handle Docker multiplex protocol: the 8-byte header (1 byte stream type + 3 bytes padding + 4 bytes size)
   - OR use types.StdCopy if using docker attach response reader
   
   Step 4: Resize terminal:
   - Listen for resize messages from client: {type: "resize", cols: 80, rows: 24}
   - Call ExecResize with new dimensions

   On disconnect:
   - Close exec connection
   - Clean up

2. frontend/src/components/Terminal.tsx:
   - Use @xterm/xterm and @xterm/addon-fit
   - On mount: create xterm.js Terminal instance, attach to DOM
   - Use fit addon to auto-resize terminal
   - WebSocket connection to exec endpoint
   - Forward xterm input to WebSocket, forward WebSocket messages to xterm
   - Listen for resize events from fit addon → send resize messages
   - Dark theme (default xterm)
   - "Open Terminal" button on container detail page → expands terminal panel

3. frontend/src/hooks/useTerminal.ts:
   - Custom hook managing terminal lifecycle
   - Handles WebSocket connection to exec endpoint
   - Manages xterm.js instance
   - Cleanup: disconnect socket, dispose terminal on unmount
   - Reconnect handling
```

### Testing
```bash
# Start a test container
docker run -d --name term-test alpine:latest sleep infinity

# Test exec API via REST
TOKEN=...
curl -X POST http://localhost:8080/api/hosts/<host-id>/containers/<container-id>/exec \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cmd": "echo hello world"}'
# Should return output

# Test WebSocket terminal
websocat "ws://localhost:8080/api/ws/containers/<container-id>/exec?token=$TOKEN"
# Type "ls" → should see directory listing
# Type "whoami" → should see "root"
# Type "exit" → should close

# Test with resize
# In a WebSocket client that supports resize messages

# Frontend:
# Navigate to container → click "Open Terminal"
# Should see xterm.js terminal
# Type commands → should work
# Verify resize works when resizing the browser window

# Cleanup
docker rm -f term-test
```

---

## Step 21: Container Detail Page — All-in-One Management View

### Concepts to Explore
- Complex component composition in React
- State management across multiple WebSocket connections
- Tab-based layout with lazy-loading panels
- Managing multiple WebSocket lifecycles (logs, stats, terminal)
- Performance: avoiding unnecessary re-renders
- **Search**: "React complex page layout patterns", "React WebSocket connection pool", "React.memo and useMemo for WebSocket data"

### Coding Prompt
```
Build the comprehensive container detail page. Create/modify:

1. frontend/src/pages/ContainerDetailPage.tsx:
   This is the centerpiece — combine all features into one view.

   Header section:
   - Container name + Docker ID (truncated)
   - Status badge (colored: running/stopped/paused)
   - Image name + tag
   - Host name (link back to host detail)
   - Quick actions: Start, Stop, Delete (with confirmation)

   Tab layout (or accordion panels):
   
   Tab 1: Overview
   - Full container info: created date, platform, restart policy
   - Ports table: host port → container port/protocol
   - Environment variables table
   - Labels table

   Tab 2: Stats (live)
   - CPU % gauge + line chart (last 2 min)
   - Memory usage bar + line chart
   - Network I/O chart (RX/TX)
   - Current PIDs count

   Tab 3: Logs (live)
   - Terminal-style log viewer
   - Controls: stop/resume, clear, download
   - Timestamp toggle

   Tab 4: Terminal
   - xterm.js embedded terminal
   - Full interactive shell

   Tab 5: Networks
   - List of connected networks with IP addresses
   - Connect to network (select from available)
   - Disconnect button

   Tab 6: Volumes
   - Associated volumes from DB
   - Active bind mounts from Docker inspect
   - Manage volume attachments

   Lazy load tabs — only connect WebSocket when tab is active
   Clean up WebSocket connections when switching tabs

2. frontend/src/components/ContainerActions.tsx:
   - Start/Stop/Restart buttons with loading states
   - Delete button with confirmation dialog
   - Disabled states based on current status (can't start running container, etc.)

3. frontend/src/components/InfoTable.tsx:
   - Reusable key-value table component
   - Dark theme styled table
```

### Testing
```bash
# Manual integration test:
# 1. Create a container with ports, env vars, volumes, custom network
docker run -d --name full-test \
  -p 9999:80 \
  -e TEST_VAR=hello \
  -v test-vol:/data \
  nginx:alpine

# 2. Navigate to container detail page
# 3. Verify each tab:
#    - Overview: shows all info correctly
#    - Stats: live charts updating
#    - Logs: shows nginx logs
#    - Terminal: can exec into container
#    - Networks: shows bridge network
#    - Volumes: shows test-vol

# 4. Test start/stop/delete from UI
# 5. Test edge cases: rapidly switching tabs, closing browser during WS connection

docker rm -f full-test
docker volume rm test-vol
```

---

# PHASE 6 — Production Readiness

---

## Step 22: Docker Compose Production Setup & Multi-Stage Builds

### Concepts to Explore
- Multi-stage Docker builds for Go: builder stage + scratch/alpine runtime
- Distroless images vs Alpine vs scratch
- Multi-stage builds for React: build stage + Nginx serve stage
- Docker image optimization: layer caching, .dockerignore, buildkit
- Nginx configuration: gzip, cache headers, SPA routing, proxy_pass for API
- **Search**: "Go multi-stage Docker build", "Docker scratch vs alpine for Go", "Nginx SPA configuration", "Docker layer caching optimization"

### Research Commands
```bash
# Explore multi-stage build
docker buildx ls

# Check image sizes
docker images | head -20

# Explore scratch image
docker pull scratch 2>&1 || echo "scratch is virtual — no pull needed"
```

### Coding Prompt
```
Create production Dockerfiles and Docker Compose setup. Create:

1. backend/Dockerfile (multi-stage production build):
   ```dockerfile
   # Stage 1: Build
   FROM golang:1.22-alpine AS builder
   RUN apk add --no-cache git ca-certificates
   WORKDIR /app
   COPY go.mod go.sum ./
   RUN go mod download
   COPY . .
   RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server ./cmd/server
   
   # Stage 2: Run
   FROM alpine:3.20
   RUN apk add --no-cache ca-certificates curl
   COPY --from=builder /server /usr/local/bin/server
   COPY migrations/ /migrations/
   USER 1000:1000
   EXPOSE 8080
   HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/api/health || exit 1
   ENTRYPOINT ["/usr/local/bin/server"]
   ```

2. frontend/Dockerfile (multi-stage):
   ```dockerfile
   # Stage 1: Build React app
   FROM node:22-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   
   # Stage 2: Serve with Nginx
   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

3. frontend/nginx.conf:
   ```nginx
   server {
     listen 80;
     server_name localhost;
     gzip on;
     gzip_types text/css application/javascript application/json image/svg+xml;
     
     root /usr/share/nginx/html;
     index index.html;
     
     # SPA routing: all non-file routes to index.html
     location / {
       try_files $uri $uri/ /index.html;
     }
     
     # API proxy to backend
     location /api/ {
       proxy_pass http://backend:8080;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
     
     # WebSocket proxy
     location /api/ws/ {
       proxy_pass http://backend:8080;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_read_timeout 3600s;
       proxy_send_timeout 3600s;
     }
     
     # Cache static assets
     location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
     }
   }
   ```

4. docker-compose.prod.yaml (root level):
   - db: PostgreSQL with health check
   - backend: our Go image, depends_on db, env vars from .env file
   - frontend: Nginx serving React + proxying to backend, depends_on backend
   - All on dd-network bridge network
   - Volumes for pgdata (named volume)
   
5. .env.production:
   - DATABASE_URL, JWT_SECRET, etc.
   - Document that JWT_SECRET must be changed

6. scripts/build.sh:
   ```bash
   #!/bin/bash
   docker compose -f docker-compose.prod.yaml build
   ```
```

### Testing
```bash
# Build production images
chmod +x scripts/build.sh
./scripts/build.sh

# Check image sizes
docker images | grep docker-dashboard

# Start production stack
docker compose -f docker-compose.prod.yaml up -d
docker compose -f docker-compose.prod.yaml ps

# Verify health checks
curl http://localhost/api/health

# Test full SPA + API proxy flow
curl http://localhost/  # should return HTML
curl http://localhost/api/health  # should proxy to backend

# Clean up
docker compose -f docker-compose.prod.yaml down
```

---

## Step 23: Kubernetes Deployment (Kind)

### Concepts to Explore
- Kind: Kubernetes in Docker — creating clusters, nodes, mounting host paths
- Kubernetes objects: Deployment, Service, StatefulSet, ConfigMap, Secret, Ingress, PVC
- Init containers for database migrations
- NGINX Ingress Controller for Kind
- hostPath volumes for Docker socket mounting
- Kubernetes security contexts: privileged containers, runAsUser
- **Search**: "Kind cluster tutorial", "Kubernetes StatefulSet PostgreSQL", "K8s init container migrations", "NGINX Ingress Kind setup"

### Research Commands
```bash
# Check kind installation
kind version

# Create a test cluster
kind create cluster --name test --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
EOF

kubectl cluster-info --context kind-test
kind delete cluster --name test
```

### Coding Prompt
```
Create Kubernetes manifests for the full deployment. Create:

1. infra/k8s/namespace.yaml:
   ```yaml
   apiVersion: v1
   kind: Namespace
   metadata:
     name: docker-dashboard
   ```

2. infra/k8s/postgres/
   - postgres-configmap.yaml: DB name, user
   - postgres-secret.yaml: password (base64 encoded)
   - postgres-statefulset.yaml:
     StatefulSet with 1 replica
     container: postgres:16-alpine, port 5432
     env vars from ConfigMap and Secret
     volumeClaimTemplate: 1Gi PVC
     liveness and readiness probes: pg_isready
   - postgres-service.yaml: ClusterIP, port 5432, headless? No (keep ClusterIP)

3. infra/k8s/backend/
   - backend-configmap.yaml: JWT_SECRET, database URL
   - backend-deployment.yaml:
     2 replicas
     Init container: run database migrations (same image, command: ./server --migrate)
     Main container: our Go backend image, port 8080
     Volume: mount /var/run/docker.sock from host (hostPath)
     Security context: privileged=false, but Docker socket group access
     env vars from ConfigMap
     liveness/readiness probes: GET /api/health
   - backend-service.yaml: ClusterIP, port 8080
   - backend-hpa.yaml (optional): HorizontalPodAutoscaler, min 2, max 5, target CPU 70%

4. infra/k8s/frontend/
   - frontend-deployment.yaml:
     2 replicas (when behind Ingress with sticky sessions disabled)
     container: our frontend image (nginx), port 80
     liveness/readiness probes: GET /
     env vars for API URL (if needed at runtime vs build time)
   - frontend-service.yaml: ClusterIP, port 80

5. infra/k8s/ingress.yaml:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: docker-dashboard-ingress
     namespace: docker-dashboard
     annotations:
       nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
       nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
       nginx.ingress.kubernetes.io/websocket-services: "backend-service"
   spec:
     ingressClassName: nginx
     rules:
     - host: docker-dash.local
       http:
         paths:
         - path: /api/ws
           pathType: Prefix
           backend: {service: backend-service, port: 8080}
         - path: /api
           pathType: Prefix
           backend: {service: backend-service, port: 8080}
         - path: /
           pathType: Prefix
           backend: {service: frontend-service, port: 80}
   ```

6. infra/k8s/kind-config.yaml:
   Kind cluster config with 1 control plane + 2 workers
   Mount /var/run/docker.sock on all nodes for Docker access

7. scripts/deploy-k8s.sh:
   ```bash
   #!/bin/bash
   set -e
   
   # Build and push images (to kind registry or as local images)
   docker compose -f docker-compose.prod.yaml build
   
   # Load images into kind
   kind load docker-image docker-dashboard-backend:latest --name docker-dash
   kind load docker-image docker-dashboard-frontend:latest --name docker-dash
   
   # Apply manifests
   kubectl apply -f infra/k8s/namespace.yaml
   kubectl apply -f infra/k8s/postgres/
   kubectl apply -f infra/k8s/backend/
   kubectl apply -f infra/k8s/frontend/
   kubectl apply -f infra/k8s/ingress.yaml
   
   # Wait for readiness
   kubectl wait --for=condition=ready pod -l app=postgres -n docker-dashboard --timeout=120s
   kubectl wait --for=condition=ready pod -l app=backend -n docker-dashboard --timeout=120s
   kubectl wait --for=condition=ready pod -l app=frontend -n docker-dashboard --timeout=60s
   
   echo "Deployment complete! Access at http://docker-dash.local"
   ```

8. scripts/destroy-k8s.sh:
   ```bash
   #!/bin/bash
   kubectl delete namespace docker-dashboard
   ```

9. Makefile additions:
   - k8s-deploy: Run deploy-k8s.sh
   - k8s-destroy: Run destroy-k8s.sh
   - k8s-logs: kubectl logs -n docker-dashboard -l app=backend
   - k8s-status: kubectl get all -n docker-dashboard
```

### Testing
```bash
# Deploy to Kind
make k8s-deploy

# Check status
make k8s-status

# Check logs
make k8s-logs

# Port-forward for testing
kubectl port-forward -n docker-dashboard svc/frontend-service 8080:80
# In another terminal:
curl http://localhost:8080/
curl http://localhost:8080/api/health

# Test with Ingress
# Add to /etc/hosts: 127.0.0.1 docker-dash.local
# Then access http://docker-dash.local in browser

# Verify WebSocket works through ingress
TOKEN=...
# Test WS connection

# Clean up
make k8s-destroy
```

---

## Step 24: Error Handling, Logging & Observability

### Concepts to Explore
- Structured logging best practices: log levels, context, correlation IDs
- Error handling patterns in Go: wrapping errors, sentinel errors, custom error types
- Request ID middleware for tracing
- Log aggregation: stdout/stderr in containers → kubectl logs / docker logs
- Health check endpoints: liveness vs readiness probes
- **Search**: "Go error wrapping best practices", "slog structured logging patterns", "Request ID middleware Go"

### Coding Prompt
```
Improve error handling and observability. Create/modify:

1. backend/internal/middleware/request_id.go:
   - Generate X-Request-ID for each request (UUID or use incoming header)
   - Add to response headers
   - Store in context for slog usage

2. backend/internal/middleware/logger.go:
   - Structured logging middleware using slog
   - Log: method, path, status, duration, request_id, user_id (if authenticated)
   - Log at appropriate levels: >=500 error, >=400 warn, <400 info

3. backend/internal/middleware/recovery.go:
   - Panic recovery middleware
   - Log full stack trace with slog
   - Return 500 JSON response (not raw text)

4. Update all handlers to:
   - Use structured logging with request_id
   - Return consistent JSON error responses
   - Don't leak internal error details to clients
   - Log full error details on server side

5. backend/internal/handlers/errors.go (refine):
   - AppError struct: StatusCode, Message, Internal error
   - Typed constructors: ErrNotFound, ErrUnauthorized, ErrForbidden, ErrBadRequest, ErrConflict
   - respondError(w, r, err) — writes JSON, logs full error

6. Create a metrics endpoint (optional, for future Prometheus):
   - GET /api/metrics → basic counters: total_requests, active_websockets, containers_managed
```

### Testing
```bash
# Test structured logging
make dev-up
docker compose logs backend | grep "request_id"

# Test error responses
curl http://localhost:8080/api/hosts/nonexistent-id \
  -H "Authorization: Bearer $TOKEN"
# Should return JSON error with request_id

# Test panic recovery
# (Add a test endpoint that panics, verify 500 response, not crash)

# Check X-Request-ID header in responses
curl -v http://localhost:8080/api/health 2>&1 | grep -i request-id
```

---

## Step 25: Testing — Backend Unit & Integration Tests

### Concepts to Explore
- Go testing: table-driven tests, subtests, test helpers
- httptest package for HTTP handler testing
- sqlmock or testcontainers for database testing
- Testing Docker operations: mock Docker client or use testcontainers
- Test coverage: `go test -cover`
- Testing WebSocket handlers
- **Search**: "Go table-driven tests", "Go httptest handler testing", "Go testcontainers postgres", "Go mock Docker client"

### Research Commands
```bash
go doc testing.T
go doc net/http/httptest.NewServer

# Install test dependencies
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres

# Check test coverage
go test ./... -cover
```

### Coding Prompt
```
Write comprehensive tests. Create these files:

1. backend/internal/handlers/auth_handler_test.go:
   - Table-driven test for POST /api/auth/register:
     - Valid registration → 201
     - Missing username → 400
     - Duplicate username → 409
     - Invalid role → 400
     - Short password → 400
   - Test for POST /api/auth/login:
     - Correct credentials → 200 with tokens
     - Wrong password → 401
     - Non-existent user → 401
   - Use httptest with a real test database (testcontainers-postgres)

2. backend/internal/handlers/host_handler_test.go:
   - Test create host: valid request, connection failure, duplicate
   - Test list hosts: admin sees all, developer sees own
   - Test delete: own host, other's host (forbidden)

3. backend/internal/middleware/auth_test.go:
   - Test valid token → passes middleware, claims in context
   - Test missing Authorization header → 401
   - Test invalid token → 401
   - Test expired token → 401
   - Test wrong role → 403

4. backend/internal/repository/ tests:
   - CRUD tests for each repository
   - Concurrency test: parallel reads/writes

5. backend/pkg/dockerclient/mock_client.go:
   - Mock DockerClient interface for testing
   - Predefined responses for containers, networks, etc.
   - Used in handler tests that don't need real Docker

6. backend/internal/ws/ tests:
   - Test WebSocket connection with valid token → 101 upgrade
   - Test connection without token → close
   - Test echo message → received back

7. Makefile additions:
   - test: go test ./... -v -count=1
   - test-cover: go test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out
   - test-integration: go test -tags=integration ./... -v
```

### Testing
```bash
# Run all tests
make test

# Check coverage
make test-cover

# Run integration tests (with testcontainers)
make test-integration

# Target: >70% code coverage
```

---

## Step 26: Frontend Testing — Component & E2E Tests

### Concepts to Explore
- React Testing Library for component testing
- Vitest as test runner (built into Vite)
- Mocking API calls with MSW (Mock Service Worker)
- Testing React Router navigation
- Testing WebSocket interactions
- Playwright for E2E testing
- **Search**: "React Testing Library tutorial", "Vitest React setup", "MSW mock API React", "Playwright React E2E"

### Research Commands
```bash
# Check what's installed
cd frontend && cat package.json | grep -E 'vitest|testing-library'

# Explore testing setup
npx vitest --help
```

### Coding Prompt
```
Set up and write frontend tests. Create:

1. frontend/vitest.config.js (or modify existing):
   Test environment: jsdom
   Setup file for global mocks

2. frontend/src/test/setup.ts:
   - Mock axios
   - Mock WebSocket
   - Mock localStorage
   - MSW server setup

3. frontend/src/test/mocks/handlers.ts:
   - Mock API handlers for: login, register, hosts list, containers list, etc.
   - Return realistic data

4. frontend/src/pages/LoginPage.test.tsx:
   - Renders login form
   - Shows error on invalid credentials
   - Redirects on successful login
   - Validates required fields

5. frontend/src/pages/DashboardPage.test.tsx:
   - Shows loading state initially
   - Shows host cards when data loads
   - Shows empty state when no hosts
   - Shows error state when API fails

6. frontend/src/components/ProtectedRoute.test.tsx:
   - Redirects to login when not authenticated
   - Renders children when authenticated
   - Redirects to intended page after login

7. frontend/src/components/ConfirmDialog.test.tsx:
   - Renders with title and message
   - Calls onConfirm when confirm clicked
   - Calls onCancel when cancel clicked

8. E2E tests with Playwright (optional but recommended):
   - tests/e2e/auth.spec.ts: login flow, register flow
   - tests/e2e/hosts.spec.ts: create host, list hosts, delete host
   - tests/e2e/containers.spec.ts: create, start, stop, delete container

9. package.json scripts:
   - test: vitest run
   - test:watch: vitest
   - test:e2e: npx playwright test
   - test:coverage: vitest run --coverage
```

### Testing
```bash
cd frontend

# Run unit tests
npm test

# Watch mode for development
npm run test:watch

# E2E tests (after setting up Playwright)
npx playwright install
npm run test:e2e

# Target: All component tests passing, >60% line coverage
```

---

## Step 27: Rate Limiting, Input Validation & Security Hardening

### Concepts to Explore
- Rate limiting strategies: token bucket, sliding window, fixed window
- Go rate limiter: `golang.org/x/time/rate` or middleware packages
- Input validation in Go: using struct tags + validator library
- SQL injection prevention: parameterized queries (already using database/sql)
- CORS configuration for production
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- JWT best practices: short-lived access tokens, token rotation
- **Search**: "Go rate limiter middleware", "Go validator library", "OWASP API security top 10", "Security headers for SPAs"

### Research Commands
```bash
go doc golang.org/x/time/rate
go doc github.com/go-playground/validator/v10
```

### Coding Prompt
```
Add security hardening. Create/modify:

1. backend/internal/middleware/rate_limiter.go:
   - Token bucket rate limiter (golang.org/x/time/rate)
   - Per-IP tracking (sync.Map of IP → *rate.Limiter)
   - Configurable: 100 requests per minute per IP
   - Special lower limits for auth endpoints (10 req/min for /api/auth/login)
   - Return 429 Too Many Requests with Retry-After header

2. backend/internal/validators/ validators.go:
   - Struct validation using go-playground/validator
   - Custom validators: dockerImage (regex for image:tag), portRange (1-65535), hostIP format
   - Validation error to JSON response helper
   - Validate incoming request bodies in all handlers

3. Update all handlers to validate input:
   - Register: username length, email format, password complexity (min 8, 1 upper, 1 number)
   - Create host: valid IP, valid port range, protocol must be tcp/unix/ssh
   - Create container: valid image name, valid port mappings

4. backend/internal/middleware/security_headers.go:
   - Set response headers:
     - X-Content-Type-Options: nosniff
     - X-Frame-Options: DENY
     - X-XSS-Protection: 1; mode=block
     - Content-Security-Policy: default-src 'self'
     - Strict-Transport-Security: max-age=31536000; includeSubDomains

5. backend/internal/middleware/cors.go (update):
   - Restrict allowed origins in production
   - Allow methods: GET, POST, PUT, DELETE, OPTIONS
   - Allow headers: Authorization, Content-Type
   - MaxAge: 86400

6. Password policy enforcement:
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 number
   - Optionally: 1 special character

7. Add graceful shutdown improvements:
   - Drain WebSocket connections on shutdown
   - Close database connection pool
   - Close all Docker client connections
```

### Testing
```bash
# Test rate limiting
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/auth/login -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
done
# Should see 429 after ~10 requests

# Test security headers
curl -I http://localhost:8080/api/health 2>&1 | grep -E 'X-|Content-Security'

# Test input validation
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"a","email":"invalid","password":"short","role":"hacker"}'
# Should return validation errors for all fields

# Test password complexity
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"simple","role":"developer"}'
# Should reject: password too weak
```

---

## Step 28: CI/CD Pipeline — GitHub Actions

### Concepts to Explore
- GitHub Actions workflow syntax: triggers, jobs, steps, matrix
- Docker Buildx for multi-platform images
- Caching strategies: Go modules cache, Docker layer cache, npm cache
- Automated testing in CI: running PostgreSQL as a service container
- Semantic versioning and image tagging
- **Search**: "GitHub Actions Go CI", "Docker Buildx GitHub Actions", "GitHub Actions cache Go modules", "GitHub Actions PostgreSQL service"

### Coding Prompt
```
Create the CI/CD pipeline. Create:

1. .github/workflows/ci.yaml:
   ```yaml
   name: CI
   
   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main]
   
   jobs:
     backend-test:
       runs-on: ubuntu-latest
       services:
         postgres:
           image: postgres:16-alpine
           env: {POSTGRES_USER: test, POSTGRES_PASSWORD: test, POSTGRES_DB: test}
           ports: ['5432:5432']
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-go@v5
           with: {go-version: '1.22'}
         - name: Cache Go modules
           uses: actions/cache@v4
           with:
             path: ~/go/pkg/mod
             key: ${{ runner.os }}-go-${{ hashFiles('backend/go.sum') }}
         - name: Test
           working-directory: backend
           run: go test ./... -v -coverprofile=coverage.out
         - name: Upload coverage
           uses: actions/upload-artifact@v4
           with: {name: coverage, path: backend/coverage.out}
   
     frontend-test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: {node-version: '22'}
         - name: Cache npm
           uses: actions/cache@v4
           with:
             path: ~/.npm
             key: ${{ runner.os }}-node-${{ hashFiles('frontend/package-lock.json') }}
         - name: Install & Test
           working-directory: frontend
           run: |
             npm ci
             npm run test -- --coverage
             npm run build
   
     lint:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-go@v5
           with: {go-version: '1.22'}
         - name: Go lint
           uses: golangci/golangci-lint-action@v6
           with: {working-directory: backend}
         - uses: actions/setup-node@v4
           with: {node-version: '22'}
         - name: Frontend lint
           working-directory: frontend
           run: npx eslint src/
   
     build-and-push:
       needs: [backend-test, frontend-test, lint]
       if: github.ref == 'refs/heads/main'
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: docker/setup-buildx-action@v3
         - uses: docker/login-action@v3
           with:
             registry: ghcr.io
             username: ${{ github.actor }}
             password: ${{ secrets.GITHUB_TOKEN }}
         - name: Build and push backend
           uses: docker/build-push-action@v5
           with:
             context: ./backend
             push: true
             tags: ghcr.io/${{ github.repository }}/backend:${{ github.sha }},ghcr.io/${{ github.repository }}/backend:latest
             cache-from: type=gha
             cache-to: type=gha,mode=max
         - name: Build and push frontend
           uses: docker/build-push-action@v5
           with:
             context: ./frontend
             push: true
             tags: ghcr.io/${{ github.repository }}/frontend:${{ github.sha }},ghcr.io/${{ github.repository }}/frontend:latest
             cache-from: type=gha
             cache-to: type=gha,mode=max
   ```

2. backend/.golangci.yml:
   ```yaml
   linters:
     enable:
       - errcheck
       - gosimple
       - govet
       - ineffassign
       - staticcheck
       - unused
       - gofmt
       - misspell
       - gosec
   ```

3. frontend/.eslintrc.json (update if needed):
   TypeScript-aware linting
```

### Testing
```bash
# Test locally before pushing
cd backend && golangci-lint run ./...
cd frontend && npx eslint src/

# Push to GitHub (if using git)
# git add . && git commit -m "Add CI/CD pipeline"
# git push origin main
# Check GitHub Actions tab for workflow run
```

---

## Step 29: Documentation & Project Polish

### Concepts to Explore
- API documentation: OpenAPI/Swagger specification
- README structure: badges, quick start, architecture, API reference
- Architecture Decision Records (ADRs)
- Code comments and GoDoc
- **Search**: "OpenAPI Go generation", "swaggo/swag Go annotations", "Good README examples", "Architecture Decision Records"

### Coding Prompt
```
Add comprehensive documentation. Create:

1. README.md (at root level):
   ```markdown
   # Docker Dashboard
   
   [![CI](https://github.com/USER/docker-dashboard/actions/workflows/ci.yaml/badge.svg)](https://...)
   [![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://go.dev/)
   [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
   [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
   
   A self-hosted, centralized dashboard for managing multiple Docker hosts from a single UI. 
   Monitor containers, stream live logs, open interactive terminals, manage networks, 
   volumes, and images — all through a modern web interface.
   
   ## Features
   - Multi-host Docker management
   - Container lifecycle management (create, start, stop, delete)
   - Live container log streaming (WebSocket)
   - Live resource monitoring with charts (CPU, memory, network, disk)
   - Interactive terminal (xterm.js + Docker exec + WebSocket)
   - Network & volume management
   - Image pulling and management
   - JWT-based authentication with RBAC (admin/developer/viewer)
   - Docker Compose & Kubernetes deployment support
   
   ## Architecture
   [Architecture diagram or description]
   
   ## Quick Start
   [Docker Compose quick start with copy-paste commands]
   
   ## API Documentation
   [Link to OpenAPI docs or summary]
   
   ## Development
   [Development setup instructions]
   
   ## Deployment
   [Docker Compose and K8s deployment instructions]
   
   ## Tech Stack
   | Layer | Technology | Purpose |
   |---|---|---|
   | Backend | Go, chi, gorilla/websocket | REST API + WebSocket server |
   | Frontend | React, TypeScript, Vite, Tailwind, Chart.js, xterm.js | SPA |
   | Database | PostgreSQL 16 | State storage |
   | Container | Docker, Docker Compose, Kubernetes | Deployment |
   | CI/CD | GitHub Actions | Testing, building, pushing |
   ```

2. docs/API.md (or integrate swagger):
   - Full API reference with request/response examples
   - Authentication flow
   - WebSocket endpoints

3. Add swagger annotations to Go handlers:
   ```go
   // @Summary Register a new user
   // @Description Register with username, email, password, and role
   // @Tags auth
   // @Accept json
   // @Produce json
   // @Param request body RegisterRequest true "Registration details"
   // @Success 201 {object} UserResponse
   // @Failure 400 {object} ErrorResponse
   // @Failure 409 {object} ErrorResponse
   // @Router /api/auth/register [post]
   ```

4. Generate swagger.json or serve Swagger UI at /api/docs

5. docs/ARCHITECTURE.md:
   - C4 diagrams or component descriptions
   - Data flow diagrams
   - Database schema diagram
   - Key design decisions and trade-offs

6. CODEOWNERS file (if using GitHub with team)

7. LICENSE file (MIT)
```

### Testing
```bash
# Verify README renders correctly (GitHub preview or local markdown viewer)
# Test all quick-start commands from README
# Someone should be able to clone and run with just docker compose up

# Verify swagger docs
curl http://localhost:8080/api/docs/swagger.json | jq .
# Visit http://localhost:8080/api/docs in browser (if serving Swagger UI)
```

---

## Step 30: Advanced Features — Docker Compose Stack Management

### Concepts to Explore
- Docker Compose file parsing
- Multi-container application management
- Stack deploy (similar to `docker stack deploy`)
- Parsing docker-compose.yaml and creating all containers at once
- **Search**: "Docker compose Go library", "Parse docker-compose.yaml in Go"

### Coding Prompt
```
Add Docker Compose stack management (bonus feature). Create:

1. backend/internal/handlers/stack_handler.go:
   
   POST /api/hosts/{hostID}/stacks/deploy:
   - Accept: {name, compose_content: "<yaml string>"}
   - Parse compose file
   - Create networks defined in compose
   - Create volumes defined in compose
   - Pull images for all services
   - Create containers with proper configs
   - Return stack summary

   GET /api/hosts/{hostID}/stacks — list deployed stacks
   DELETE /api/hosts/{hostID}/stacks/{stackID} — tear down a stack

2. backend/pkg/dockerclient/compose.go:
   - Compose file parser (using compose-go or manual parsing)
   - Service → container config mapper
   - Dependency order resolution

3. frontend/src/pages/StackDeployPage.tsx:
   - Text area for pasting docker-compose.yaml
   - "Deploy Stack" button
   - Stack monitoring view

(Install libcompose or compose-go for parsing)
go get github.com/compose-spec/compose-go/v2
```

---

## Step 31: Monitoring & Alerting (Loki + Grafana or Basic)

### Concepts to Explore
- Centralized logging with Loki or ELK stack
- Metrics with Prometheus + Grafana
- Container health monitoring
- Alert rules: container stopped, high CPU, host unreachable
- **Search**: "Prometheus Go client", "Loki Docker logging", "Grafana Docker monitoring dashboard"

### Coding Prompt
```
Add basic monitoring capabilities. Create:

1. docker-compose.monitoring.yaml:
   - Prometheus service: scrape backend metrics
   - Grafana service: pre-configured dashboards
   
2. backend/internal/middleware/metrics.go:
   - Prometheus metrics using prometheus/client_golang:
     - http_requests_total{method, path, status}
     - http_request_duration_seconds
     - active_websocket_connections
     - containers_managed_total{host, status}
   - Expose at GET /api/metrics

3. infra/monitoring/
   - prometheus.yml: scrape configs
   - grafana-dashboards/: pre-built dashboard JSON for Docker monitoring
```

---

## Step 32: Final Integration Test, Performance Audit & Deployment

### Concepts to Explore
- Load testing with k6 or wrk
- Database query optimization: EXPLAIN ANALYZE, missing indexes
- Go profiling: pprof
- React performance: React DevTools Profiler, Lighthouse
- Docker image optimization: dive tool
- **Search**: "k6 load testing API", "Go pprof profiling", "dive Docker image analysis", "React performance optimization"

### Coding Prompt
```
Final polish and performance passes. Create:

1. scripts/load-test.js (k6 script):
   - Authenticate
   - List hosts
   - List containers
   - Stream logs via WebSocket
   - Test with 10, 50, 100 concurrent users

2. scripts/profile.sh:
   - Enable pprof on backend
   - Run load test
   - Collect CPU and memory profiles
   - Generate flame graphs

3. Performance improvements:
   - Database query optimization: add missing indexes
   - Connection pooling tuning
   - React: useMemo/useCallback where needed
   - Lazy load routes (React.lazy + Suspense)
   - Image optimization with dive

4. Final checklist:
   - All tests passing (backend + frontend)
   - Lint passing
   - Security scan passing (gosec, npm audit)
   - Docker images optimized
   - Documentation complete
   - CI/CD pipeline green

5. scripts/final-verify.sh:
   ```bash
   #!/bin/bash
   set -e
   
   echo "=== Running backend tests ==="
   cd backend && go test ./... -cover && cd ..
   
   echo "=== Running frontend tests ==="
   cd frontend && npm test && cd ..
   
   echo "=== Running linters ==="
   cd backend && golangci-lint run ./... && cd ..
   cd frontend && npx eslint src/ && cd ..
   
   echo "=== Building Docker images ==="
   docker compose -f docker-compose.prod.yaml build
   
   echo "=== Starting production stack ==="
   docker compose -f docker-compose.prod.yaml up -d
   sleep 10
   
   echo "=== Health checks ==="
   curl -f http://localhost/api/health || exit 1
   curl -f http://localhost/ || exit 1
   
   echo "=== All checks passed! ==="
   ```
```

### Testing
```bash
# Final verification
chmod +x scripts/final-verify.sh
./scripts/final-verify.sh

# Load test
k6 run scripts/load-test.js

# Analyze Docker images
dive docker-dashboard-backend:latest
dive docker-dashboard-frontend:latest

# Lighthouse audit (run against frontend)
# Use Chrome DevTools → Lighthouse → Generate report
```

---

# Complete File Structure

By the end of this roadmap, your project should look like:

```
docker-dashboard/
├── README.md
├── LICENSE
├── Makefile
├── .env.example
├── .env.production
├── docker-compose.yaml            # Development
├── docker-compose.prod.yaml       # Production
├── docker-compose.monitoring.yaml # Monitoring stack
├── .github/
│   └── workflows/
│       └── ci.yaml
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── swagger.yaml
├── scripts/
│   ├── build.sh
│   ├── deploy-k8s.sh
│   ├── destroy-k8s.sh
│   ├── load-test.js
│   ├── profile.sh
│   └── final-verify.sh
├── backend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── go.mod
│   ├── go.sum
│   ├── .air.toml
│   ├── .golangci.yml
│   ├── cmd/
│   │   ├── server/
│   │   │   └── main.go
│   │   ├── explore/
│   │   │   └── main.go
│   │   └── migrate/
│   │       └── main.go
│   ├── internal/
│   │   ├── auth/
│   │   │   ├── jwt.go
│   │   │   └── password.go
│   │   ├── config/
│   │   │   └── config.go
│   │   ├── database/
│   │   │   ├── database.go
│   │   │   └── migrate.go
│   │   ├── handlers/
│   │   │   ├── auth_handler.go
│   │   │   ├── container_handler.go
│   │   │   ├── health.go
│   │   │   ├── host_handler.go
│   │   │   ├── image_handler.go
│   │   │   ├── logs_handler.go
│   │   │   ├── network_handler.go
│   │   │   ├── stack_handler.go
│   │   │   ├── volume_handler.go
│   │   │   ├── ws_handler.go
│   │   │   └── errors.go
│   │   ├── middleware/
│   │   │   ├── auth.go
│   │   │   ├── cors.go
│   │   │   ├── logger.go
│   │   │   ├── rate_limiter.go
│   │   │   ├── recovery.go
│   │   │   ├── request_id.go
│   │   │   ├── security_headers.go
│   │   │   └── metrics.go
│   │   ├── models/
│   │   │   └── models.go
│   │   ├── repository/
│   │   │   ├── repository.go
│   │   │   ├── user_repo.go
│   │   │   ├── host_repo.go
│   │   │   ├── container_repo.go
│   │   │   ├── network_repo.go
│   │   │   ├── volume_repo.go
│   │   │   └── image_repo.go
│   │   ├── validators/
│   │   │   └── validators.go
│   │   └── ws/
│   │       ├── client.go
│   │       ├── hub.go
│   │       ├── upgrader.go
│   │       ├── log_consumer.go
│   │       ├── stats_consumer.go
│   │       └── terminal_consumer.go
│   ├── pkg/
│   │   └── dockerclient/
│   │       ├── client.go
│   │       ├── container_ops.go
│   │       ├── network_ops.go
│   │       ├── volume_ops.go
│   │       ├── image_ops.go
│   │       ├── compose.go
│   │       └── mock_client.go
│   └── migrations/
│       ├── 000001_init_schema.up.sql
│       └── 000001_init_schema.down.sql
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   ├── vitest.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── config.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Navbar.tsx
│       │   ├── ProtectedRoute.tsx
│       │   ├── HostCard.tsx
│       │   ├── ConfirmDialog.tsx
│       │   ├── LoadingSpinner.tsx
│       │   ├── DynamicListInput.tsx
│       │   ├── InfoTable.tsx
│       │   ├── ContainerActions.tsx
│       │   ├── StatsPanel.tsx
│       │   ├── LiveChart.tsx
│       │   └── Terminal.tsx
│       ├── hooks/
│       │   ├── useApi.ts
│       │   ├── useAuth.ts
│       │   ├── useHost.ts
│       │   ├── useWebSocket.ts
│       │   └── useTerminal.ts
│       ├── pages/
│       │   ├── SplashPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── CreateHostPage.tsx
│       │   ├── HostDetailPage.tsx
│       │   ├── ContainerDetailPage.tsx
│       │   ├── CreateContainerPage.tsx
│       │   ├── ManageNetworksPage.tsx
│       │   ├── CreateNetworkPage.tsx
│       │   ├── ManageVolumesPage.tsx
│       │   ├── CreateVolumePage.tsx
│       │   ├── ManageImagesPage.tsx
│       │   ├── CreateImagePage.tsx
│       │   └── StackDeployPage.tsx
│       ├── services/
│       │   └── api.ts
│       ├── utils/
│       │   ├── auth.ts
│       │   └── formatters.ts
│       └── test/
│           ├── setup.ts
│           └── mocks/
│               └── handlers.ts
├── infra/
│   ├── compose/
│   │   └── .env
│   ├── k8s/
│   │   ├── kind-config.yaml
│   │   ├── namespace.yaml
│   │   ├── postgres/
│   │   │   ├── postgres-configmap.yaml
│   │   │   ├── postgres-secret.yaml
│   │   │   ├── postgres-statefulset.yaml
│   │   │   └── postgres-service.yaml
│   │   ├── backend/
│   │   │   ├── backend-configmap.yaml
│   │   │   ├── backend-deployment.yaml
│   │   │   ├── backend-service.yaml
│   │   │   └── backend-hpa.yaml
│   │   ├── frontend/
│   │   │   ├── frontend-deployment.yaml
│   │   │   └── frontend-service.yaml
│   │   └── ingress.yaml
│   └── monitoring/
│       ├── prometheus.yml
│       └── grafana-dashboards/
│           └── docker-overview.json
└── tests/
    └── e2e/
        ├── auth.spec.ts
        ├── hosts.spec.ts
        └── containers.spec.ts
```

---

# Learning Timeline Estimate

| Phase | Steps | Estimated Time (for mid-level dev) |
|---|---|---|
| Phase 1 — Foundation | 1-5 | 4-6 days |
| Phase 2 — Auth & RBAC | 6-7 | 2-3 days |
| Phase 3 — Docker Integration | 8-9 | 2-3 days |
| Phase 4 — Frontend Foundation | 10-12 | 3-4 days |
| Phase 5 — Resource Management | 13-16 | 4-5 days |
| Phase 6 — Real-Time (WebSockets) | 17-21 | 5-7 days |
| Phase 7 — Production | 22-24 | 3-4 days |
| Phase 8 — Testing | 25-26 | 3-4 days |
| Phase 9 — Security & CI/CD | 27-29 | 3-4 days |
| Phase 10 — Advanced & Polish | 30-32 | 3-5 days |

**Total: ~30-45 days** (2-3 hours per day, at a comfortable pace)

---

# Key Takeaways from This Project

1. **Docker SDK speaks HTTP/Unix sockets** — you don't need Docker CLI installed on the backend, just the Go SDK and socket/TCP access.

2. **Database mirrors Docker state** — PostgreSQL acts as a cache + metadata store. Docker daemon is the source of truth for live operations.

3. **WebSockets for streaming** — REST for CRUD, WebSockets for logs/stats/terminal. This pattern is used by Docker Desktop, Portainer, and most container UIs.

4. **Go + Docker SDK is a natural fit** — Docker itself is written in Go. The Go SDK is first-class and idiomatic.

5. **Security is hard** — Exposing Docker API (even via proxy) requires careful RBAC, rate limiting, and input validation. A compromised container management API = compromised Docker host.

---

## Next Steps

1. Start at **Step 1** — read the concepts, run the research commands, then give me the coding prompt
2. Work through each step sequentially — each step builds on the previous
3. Test thoroughly at each step before moving on
4. When stuck, go back to "Concepts to Explore" and dive deeper
5. The `/home/rishisulakhe/projects/Docker-Integration-Host-main` codebase is your reference — study how the Django version solved each problem, then build the Go+TypeScript equivalent

Good luck! This is a portfolio-grade project that demonstrates deep understanding of Docker, Go, TypeScript, WebSockets, Kubernetes, and full-stack DevOps engineering.
