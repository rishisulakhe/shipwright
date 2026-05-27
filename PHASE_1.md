# Phase 1: Foundation & Environment — Deep Dive

## Overview

Phase 1 establishes the entire foundation of the Docker Management Dashboard. By the end of this phase, we have a fully scaffolded monorepo with a running Go backend server, a PostgreSQL database with a complete schema, and a clean data access layer built on the Repository pattern. Every subsequent phase — auth, Docker integration, WebSockets, frontend — builds directly on this foundation.

---

## Step 1: Understanding Docker Engine API & Socket Communication

### What was built
A standalone Go script (`backend/cmd/explore/main.go`) that connects to the Docker daemon via the Unix socket at `/var/run/docker.sock`, lists all containers and images, and prints them as formatted JSON.

### Key concepts

**Docker socket (`/var/run/docker.sock`)**

The Docker daemon exposes a REST API over a Unix domain socket. This is the primary communication channel between the Docker CLI and the daemon. The socket is a special file that behaves like a network endpoint — you can `curl --unix-socket` to it or connect via Go's `net/http` with a custom transport.

```
curl --unix-socket /var/run/docker.sock http://localhost/containers/json?all=true
```

This is the exact same API that `docker ps`, `docker images`, etc. use under the hood.

**TCP vs Unix sockets**

- **Unix socket** (`/var/run/docker.sock`): Local only, no network exposure, file-permission based access control. Default for Docker Desktop and most Linux installs.
- **TCP** (port 2375/2376): Network-accessible, allows remote management. Port 2375 is unencrypted (dangerous in production), 2376 requires TLS.

**Why this matters for our project**

Our dashboard will need to communicate with Docker daemons on remote hosts. Understanding the socket-to-TCP mapping is critical — when a host is registered as `tcp://192.168.1.10:2375`, our Go backend creates an HTTP client pointing at that URL instead of the local socket. The API is identical regardless of transport.

### Code architecture
```
backend/cmd/explore/main.go   — standalone script, ~80 lines
  ├── Creates http.Client with Unix socket transport
  ├── GET /containers/json?all=true  → []Container
  ├── GET /images/json               → []Image
  └── json.MarshalIndent to stdout
```

---

## Step 2: Project Scaffold — Monorepo Structure & Docker Compose Dev Environment

### What was built
A fully containerized development environment with three services (PostgreSQL, Go backend, React frontend) orchestrated via Docker Compose, plus a Makefile for common operations.

### Key concepts

**Monorepo structure**

```
shipwright/
├── backend/           # Go module (github.com/rishisulakhe/shipwright/backend)
│   ├── cmd/           # Application entry points (server, migrate)
│   ├── internal/      # Private packages (config, database, handlers, etc.)
│   └── pkg/           # Reusable packages (dockerclient)
├── frontend/          # Vite + React + TypeScript SPA
├── infra/             # Infrastructure configs (compose, k8s, monitoring)
├── scripts/           # Build, deploy, CI scripts
├── docker-compose.yaml
└── Makefile
```

The `internal/` vs `pkg/` distinction follows Go conventions:
- `internal/`: Not importable by code outside our module. Enforces encapsulation.
- `pkg/`: Reusable library code that could theoretically be imported by others.

**Docker Compose dev environment**

Three services connected on a shared bridge network (`dd-network`):

| Service | Image | Port | Key details |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | Health check via `pg_isready`, named volume `pgdata` for persistence |
| `backend` | Custom `Dockerfile.dev` | 8080 | `air` for live reload, mounts entire `./backend` as `/app`, Docker socket mounted for daemon access |
| `frontend` | Custom `Dockerfile.dev` | 5173 | Vite HMR, mounts `src/`, `public/`, and config files |

**Development Dockerfiles**

- `backend/Dockerfile.dev`: `golang:1.25-alpine` + `air` (live reload). Copies `go.mod`, downloads deps, copies source. `air` watches `.go` files and rebuilds on change.
- `frontend/Dockerfile.dev`: `node:22-alpine`. Copies `package.json`, runs `npm install`, starts Vite with `--host 0.0.0.0` to allow connections from outside the container.

**Docker socket mount**

The backend container mounts `/var/run/docker.sock:/var/run/docker.sock`. This is *required* for local Docker daemon access. Without it, the backend cannot list containers, create networks, or perform any Docker operations on the host machine. In production, this would be replaced by TCP connections to remote Docker hosts.

**Makefile targets**

| Target | Command | Purpose |
|---|---|---|
| `dev-up` | `docker-compose up -d --build` | Start all services |
| `dev-down` | `docker-compose down` | Stop all services |
| `dev-logs` | `docker-compose logs -f` | Tail all logs |
| `backend-shell` | `docker-compose exec backend sh` | Shell into backend |
| `db-reset` | Down volumes, recreate DB | Fresh database |
| `clean` | Down, remove volumes, prune images | Full cleanup |

### Decisions & trade-offs

- **Why `docker-compose` (hyphen) vs `docker compose` (space)?** The installed Docker engine (v29.5.1) doesn't include the Compose plugin. We use the standalone `docker-compose` binary (v5.1.4) installed in `~/.local/bin`.
- **Why mount source dirs instead of COPY?** Mounting enables hot-reload — both `air` (Go) and Vite (React) detect file changes on the host and rebuild automatically.
- **Why `golang:1.25-alpine`?** The latest `air` requires Go >= 1.25. Our local Go is 1.26.3, but 1.25 is the latest stable Docker image. The `go.mod` specifies `go 1.25.0` to match.

---

## Step 3: Go Backend Skeleton — HTTP Server, Config, Logging

### What was built
A production-ready Go HTTP server with chi router, structured logging (slog), CORS configuration, graceful shutdown, and database connectivity.

### Key concepts

**Chi router (`go-chi/chi/v5`)**

Chi is a lightweight, idiomatic, `net/http`-compatible router. Unlike heavyweight frameworks (Gin, Echo), Chi builds on the standard library's `http.Handler` interface. This means all standard middleware works, and there's no lock-in to a custom context type.

Key features we use:
- `chi.NewRouter()` — creates a new mux
- `r.Get("/api/health", handler)` — route registration
- `r.Use(middleware)` — global middleware chain
- Route grouping with `r.Route("/api", ...)` (used later)

**Middleware chain**

The middleware executes in order for every request:

```
Request → RequestID → RealIP → Logger → Recoverer → CORS → Handler
```

Each middleware serves a specific purpose:
- **RequestID**: Generates/injects `X-Request-ID` header for tracing
- **RealIP**: Parses `X-Forwarded-For`, `X-Real-IP` for proxy environments
- **Logger**: Structured request logging (method, path, status, duration)
- **Recoverer**: Catches panics, logs stack traces, returns 500
- **CORS**: Allows cross-origin requests from `localhost:5173` (Vite dev server)

**Structured logging with `log/slog`**

Go 1.21+ includes `log/slog` — a structured logging package in the standard library. We configure it with:
- JSON output (machine-parseable, works well with log aggregators)
- Configurable log level via `LOG_LEVEL` env var (debug/info/warn/error)
- Key-value pairs for context (`"error", err`, `"port", port`)

The pattern used throughout:
```go
slog.Info("server starting", "port", cfg.Port)
slog.Error("database connection failed", "error", err)
```

**Graceful shutdown**

The server listens for `SIGINT` (Ctrl+C) and `SIGTERM` (Docker stop). On receiving either:
1. Log "shutting down"
2. Create a context with 10-second timeout
3. Call `srv.Shutdown(ctx)` — stops accepting new connections, waits for active requests to finish
4. If shutdown exceeds 10s, force exit

This prevents:
- Dropped in-flight requests
- Corrupted database state from abrupt termination
- WebSocket connection leaks (important for Phase 5)

**Configuration management**

`Config` struct with 4 fields, loaded from environment variables with sensible defaults:

| Field | Env Var | Default | Purpose |
|---|---|---|---|
| `Port` | `PORT` | `8080` | HTTP listen port |
| `DatabaseURL` | `DATABASE_URL` | `postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable` | PostgreSQL connection string |
| `JWTSecret` | `JWT_SECRET` | `change-me-in-production` | HMAC signing key for JWT tokens |
| `LogLevel` | `LOG_LEVEL` | `info` | Minimum log level |

**Database connection (`internal/database/database.go`)**

The `Connect` function uses `database/sql` with the `lib/pq` PostgreSQL driver. Connection pool is configured:
- **Max open connections**: 25 (enough for concurrent requests, not enough to overwhelm the DB)
- **Max idle connections**: 5 (keeps connections warm without wasting resources)
- **Max lifetime**: 5 minutes (prevents stale connections, works with load balancers)
- **Ping on connect**: Verifies the database is reachable before proceeding

### Code architecture
```
backend/
├── cmd/server/main.go              — entry point, wires everything
├── internal/
│   ├── config/config.go            — Config struct, Load() from env vars
│   ├── database/database.go        — Connect(), connection pool config
│   └── handlers/health.go          — HealthHandler with /api/health, /api/health/db
```

### API endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/api/health` | None | `{"status":"ok","timestamp":"..."}` |
| `GET` | `/api/health/db` | None | `{"status":"ok","timestamp":"..."}` or `503 {"status":"error",...}` |

---

## Step 4: Database Schema — Migrations & Models

### What was built
A complete PostgreSQL schema with 6 tables, versioned SQL migration files (up/down), a migration runner, and corresponding Go model structs.

### Key concepts

**Database migrations**

We use `golang-migrate/migrate` — an industry-standard migration library for Go. Migrations are versioned SQL files applied in sequence:

```
migrations/
├── 000001_init_schema.up.sql    — CREATE TABLE statements
└── 000001_init_schema.down.sql  — DROP TABLE statements (for rollback)
```

The `schema_migrations` table tracks which version is currently applied and whether the migration is "dirty" (failed mid-application).

**Migration runner (`cmd/migrate/main.go`)**

A standalone binary that:
1. Loads `.env` file via `godotenv`
2. Connects to the database
3. Applies all pending `up` migrations
4. Logs the final migration version

Run via: `go run ./cmd/migrate/main.go` inside the backend container.

### Schema design

The schema models the core domain entities of a Docker management system:

```
users ──┬── docker_hosts ──┬── containers
        │                  ├── networks
        │                  ├── volumes
        │                  └── images
        └── containers (created_by FK)
```

**Table: `users`**

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` | Unique identifier |
| `username` | `VARCHAR(150)` | UNIQUE, NOT NULL | Login name |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Contact email |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt hash (never expose via JSON — `json:"-"`) |
| `role` | `VARCHAR(20)` | CHECK(admin/developer/viewer), DEFAULT 'developer' | RBAC role |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Record update time |

**Table: `docker_hosts`**

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | `UUID` | PK | Unique identifier |
| `owner_id` | `UUID` | FK → users(id) ON DELETE CASCADE | Owning user |
| `name` | `VARCHAR(255)` | NOT NULL | Human-readable label |
| `host_ip` | `VARCHAR(45)` | NOT NULL | IPv4 or IPv6 address |
| `port` | `INT` | DEFAULT 2375 | Docker daemon port |
| `protocol` | `VARCHAR(10)` | CHECK(tcp/unix/ssh), DEFAULT 'tcp' | Connection protocol |
| `auth_type` | `VARCHAR(10)` | CHECK(none/tls/ssh), DEFAULT 'none' | Auth method |
| `tls_ca/cert/key` | `TEXT` | Nullable | TLS auth material |
| `ssh_user/key` | `VARCHAR(100)/TEXT` | Nullable | SSH auth material |
| `is_active` | `BOOLEAN` | DEFAULT false | Connection health |
| UNIQUE | `(owner_id, host_ip, port)` | — | Prevents duplicate registrations |

**Table: `containers`**

| Column | Type | Purpose |
|---|---|---|
| `docker_container_id` | `VARCHAR(64)` | Docker's native container ID |
| `ports` | `JSONB` DEFAULT '[]' | Array of `{container_port, host_port, protocol}` |
| `host_id` | `UUID` FK | Which Docker host this container runs on |
| `created_by` | `UUID` FK | Who created this container |
| `editable_by` | `JSONB` DEFAULT '[]' | Array of user UUIDs with edit access |
| `viewable_by` | `JSONB` DEFAULT '[]' | Array of user UUIDs with view access |
| UNIQUE | `(host_id, docker_container_id)` | One record per Docker container |

The `editable_by`/`viewable_by` JSONB columns implement fine-grained access control beyond role-based auth. An admin can grant specific users access to specific containers.

**Table: `networks`**

Tracks Docker networks. Key columns: `docker_network_id`, `name`, `driver` (bridge/host/overlay), `scope` (local/swarm), `internal` flag.

**Table: `volumes`**

Tracks Docker volumes. Key columns: `docker_volume_id` (nullable — named volumes may not have an ID), `name`, `driver`, `mountpoint`.

**Table: `images`**

Tracks Docker images. Key columns: `docker_image_id`, `name`, `tag`, `size` (bytes).

### Go models (`internal/models/models.go`)

Each table has a corresponding Go struct with:
- **JSON tags** (`json:"field_name"`): Control serialization. `json:"-"` excludes `password_hash` from API responses.
- **DB tags** (`db:"column_name"`): Map struct fields to database columns (used by sqlx if we adopt it later).
- **Proper null handling**: `sql.NullString` for nullable TEXT columns, `sql.NullUUID` (from `google/uuid`) for nullable UUID FKs, `json.RawMessage` for JSONB columns.

### Indexes

Strategic indexes are created for query performance:

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_docker_hosts_owner` | `docker_hosts` | `owner_id` | Fast lookup of a user's hosts |
| `idx_containers_host` | `containers` | `host_id` | List containers on a specific host |
| `idx_containers_docker_id` | `containers` | `(host_id, docker_container_id)` | Find container by Docker ID |
| `idx_containers_created_by` | `containers` | `created_by` | Find containers created by a user |
| `idx_networks_host` | `networks` | `host_id` | List networks on a host |
| `idx_volumes_host` | `volumes` | `host_id` | List volumes on a host |
| `idx_images_host` | `images` | `host_id` | List images on a host |

---

## Step 5: Repository Pattern — Data Access Layer

### What was built
A complete Repository pattern implementation with 6 repository interfaces (User, Host, Container, Network, Volume, Image) and concrete implementations using raw SQL via `database/sql`.

### Key concepts

**Repository pattern**

The Repository pattern abstracts data access behind interfaces. This provides three key benefits:

1. **Testability**: Mock the interface in handler tests instead of needing a real database
2. **Separation of concerns**: Handlers don't write SQL — they call repository methods
3. **Consistency**: All data access follows the same pattern (context-aware, consistent error handling)

**Interface-driven design**

Every repository follows this pattern:
```go
type XRepository interface {
    Create(ctx context.Context, x *models.X) error
    FindByID(ctx context.Context, id uuid.UUID) (*models.X, error)
    FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.X, error)
    Delete(ctx context.Context, id uuid.UUID) error
    // ... domain-specific methods
}

type XRepo struct {
    db *sql.DB
}

func NewXRepo(db *sql.DB) *XRepo {
    return &XRepo{db: db}
}
```

**Why raw SQL (not ORM)?**

We intentionally use raw SQL with `database/sql` instead of an ORM like GORM. This teaches:
- How parameterized queries work (prevents SQL injection)
- How to use `QueryRowContext`, `ExecContext`, `QueryContext`
- How to handle NULL values with `sql.NullString`, `sql.NullUUID`
- How to scan results into structs
- Transaction patterns

ORMs hide these details. Learning them is essential for any Go developer working with databases.

**Context-aware methods**

All repository methods accept `context.Context`:
```go
func (r *UserRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error)
```

This enables:
- **Request cancellation**: If a client disconnects, the DB query is cancelled
- **Timeouts**: Set query deadlines via `context.WithTimeout`
- **Tracing**: Pass trace IDs through context (Phase 6)

**Aggregator: `Repositories` struct**

```go
type Repositories struct {
    Users      UserRepository
    Hosts      HostRepository
    Containers ContainerRepository
    Networks   NetworkRepository
    Volumes    VolumeRepository
    Images     ImageRepository
}
```

Constructed via `NewRepositories(db)` — a single struct that provides all data access. Handlers receive this, enabling them to call any repository.

### Repository-specific details

**UserRepository**

| Method | SQL Pattern | Notes |
|---|---|---|
| `Create` | `INSERT ... RETURNING id, created_at, updated_at` | `RETURNING` populates the struct after creation |
| `FindByID` | `SELECT ... WHERE id = $1` | Returns nil + `sql.ErrNoRows` if not found |
| `FindByUsername` | `SELECT ... WHERE username = $1` | Used during login to look up user |
| `FindByEmail` | `SELECT ... WHERE email = $1` | Used during registration to check uniqueness |
| `List` | `SELECT ... ORDER BY created_at DESC` | Returns all users (admin use) |

**HostRepository**

| Method | SQL Pattern | Notes |
|---|---|---|
| `Create` | `INSERT ... RETURNING id, created_at, updated_at` | Handles nullable TLS/SSH fields with `sql.NullString` |
| `FindByOwner` | `SELECT ... WHERE owner_id = $1` | Developer/viewer see only their own hosts |
| `ListAll` | `SELECT ... ORDER BY created_at DESC` | Admin sees all hosts |
| `UpdateStatus` | `UPDATE ... SET is_active = $1, updated_at = NOW()` | Toogles connection health after ping test |
| `Delete` | `DELETE ... WHERE id = $1` | Cascade deletes containers, networks, etc. |

**ContainerRepository**

| Method | SQL Pattern | Notes |
|---|---|---|
| `ListAccessibleByUser` | Complex WHERE clause | Checks: `created_by = $user OR editable_by @> $user OR viewable_by @> $user` |
| `Create` | `INSERT ... RETURNING id, created_at, updated_at` | Handles JSONB defaults for ports, editable_by, viewable_by |
| `UpdateStatus` | `UPDATE ... SET status = $1, updated_at = NOW()` | Called after start/stop/delete operations |

The `ListAccessibleByUser` method uses PostgreSQL's `@>` (contains) operator on JSONB columns. The query:
```sql
WHERE host_id = $1 AND (
    created_by = $2
    OR editable_by @> $3::jsonb
    OR viewable_by @> $3::jsonb
)
```
Where `$3` is `["<user-uuid>"]` — checks if the user's UUID appears in the JSONB array. This avoids the need for a separate junction table.

**NetworkRepository**

Additional methods beyond CRUD: `FindByDockerID`, `FindByName` — for looking up networks by Docker's native identifiers.

**VolumeRepository**

Additional method: `FindByName` — volumes are often referenced by name, not ID.

**ImageRepository**

Additional method: `DeleteByDockerID` — allows deleting an image record by Docker's image ID without first looking up our internal UUID.

### Dependency graph

```
main.go
  ├── config.Load()
  ├── database.Connect(cfg.DatabaseURL)
  ├── repository.NewRepositories(db)
  │     ├── NewUserRepo(db)
  │     ├── NewHostRepo(db)
  │     ├── NewContainerRepo(db)
  │     ├── NewNetworkRepo(db)
  │     ├── NewVolumeRepo(db)
  │     └── NewImageRepo(db)
  ├── handlers.HealthHandler{DB: db}
  ├── chi.NewRouter() + middleware
  └── http.Server + graceful shutdown
```

The `Repositories` struct is constructed but not yet wired into handlers — that comes in Phase 2 (auth handlers will need `UserRepository`).

---

## Testing Results

All Phase 1 components were tested end-to-end:

| Test | Result |
|---|---|
| `make dev-up` — all 3 services start | **PASS** (db healthy, backend up, frontend up) |
| `GET /api/health` | **PASS** — `{"status":"ok"}` |
| `GET /api/health/db` | **PASS** — database reachable |
| `go build ./...` | **PASS** — zero compilation errors |
| `migrate` — schema creation | **PASS** — 6 tables + schema_migrations |
| Table schemas verification | **PASS** — all columns, constraints, FKs, indexes correct |
| `UserRepo.Create` | **PASS** — user created with auto-generated UUID |
| `UserRepo.FindByID` | **PASS** — retrieved correct user |
| `UserRepo.FindByUsername` | **PASS** — found by username |
| `UserRepo.List` | **PASS** — returned all users |

---

## File inventory

```
backend/
├── Dockerfile.dev                         # Go dev container with air
├── .air.toml                              # Air live-reload config
├── go.mod                                 # Module: github.com/rishisulakhe/shipwright/backend
├── go.sum                                 # Dependency checksums
├── cmd/
│   ├── server/main.go                     # HTTP server entry point
│   └── migrate/main.go                    # Migration runner
├── internal/
│   ├── config/config.go                   # Config struct + Load()
│   ├── database/
│   │   ├── database.go                    # Connect() with pool settings
│   │   └── migrate.go                     # RunMigrations()
│   ├── handlers/health.go                 # Health + DB health endpoints
│   ├── models/models.go                   # 6 model structs + PortMapping
│   └── repository/
│       ├── repository.go                  # Repositories aggregator
│       ├── user_repo.go                   # UserRepository
│       ├── host_repo.go                   # HostRepository
│       ├── container_repo.go              # ContainerRepository
│       ├── network_repo.go                # NetworkRepository
│       ├── volume_repo.go                 # VolumeRepository
│       └── image_repo.go                  # ImageRepository
└── migrations/
    ├── 000001_init_schema.up.sql          # 6 CREATE TABLE + 7 CREATE INDEX
    └── 000001_init_schema.down.sql        # 6 DROP TABLE CASCADE
```

Plus root-level files: `docker-compose.yaml`, `Makefile`, `.env.example`, `.gitignore`

---

## What's Next (Phase 2)

Phase 2 adds authentication and authorization:
- **Step 6**: JWT registration, login, token refresh + bcrypt password hashing
- **Step 7**: Auth middleware + role-based access control (admin/developer/viewer)

The `UserRepository` built in Step 5 will be wired into the auth handlers. The `JWTSecret` from config will be used to sign tokens.
