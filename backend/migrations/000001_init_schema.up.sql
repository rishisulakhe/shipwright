CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'developer'
        CHECK (role IN ('admin', 'developer', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docker_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    host_ip VARCHAR(45) NOT NULL,
    port INT NOT NULL DEFAULT 2375,
    protocol VARCHAR(10) NOT NULL DEFAULT 'tcp'
        CHECK (protocol IN ('tcp', 'unix', 'ssh')),
    auth_type VARCHAR(10) NOT NULL DEFAULT 'none'
        CHECK (auth_type IN ('none', 'tls', 'ssh')),
    tls_ca TEXT,
    tls_cert TEXT,
    tls_key TEXT,
    ssh_user VARCHAR(100),
    ssh_key TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id, host_ip, port)
);

CREATE TABLE IF NOT EXISTS containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docker_container_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'created',
    ports JSONB NOT NULL DEFAULT '[]',
    host_id UUID NOT NULL REFERENCES docker_hosts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    editable_by JSONB NOT NULL DEFAULT '[]',
    viewable_by JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(host_id, docker_container_id)
);

CREATE TABLE IF NOT EXISTS networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docker_network_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    driver VARCHAR(50) NOT NULL DEFAULT 'bridge',
    scope VARCHAR(20) NOT NULL DEFAULT 'local',
    internal BOOLEAN NOT NULL DEFAULT false,
    host_id UUID NOT NULL REFERENCES docker_hosts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(host_id, docker_network_id)
);

CREATE TABLE IF NOT EXISTS volumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docker_volume_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    driver VARCHAR(50) NOT NULL DEFAULT 'local',
    mountpoint TEXT,
    host_id UUID NOT NULL REFERENCES docker_hosts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(host_id, name)
);

CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docker_image_id VARCHAR(128) NOT NULL,
    name VARCHAR(500) NOT NULL,
    tag VARCHAR(255) NOT NULL DEFAULT 'latest',
    size BIGINT NOT NULL DEFAULT 0,
    host_id UUID NOT NULL REFERENCES docker_hosts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(host_id, docker_image_id)
);

CREATE INDEX IF NOT EXISTS idx_docker_hosts_owner ON docker_hosts(owner_id);
CREATE INDEX IF NOT EXISTS idx_containers_host ON containers(host_id);
CREATE INDEX IF NOT EXISTS idx_containers_docker_id ON containers(host_id, docker_container_id);
CREATE INDEX IF NOT EXISTS idx_containers_created_by ON containers(created_by);
CREATE INDEX IF NOT EXISTS idx_networks_host ON networks(host_id);
CREATE INDEX IF NOT EXISTS idx_volumes_host ON volumes(host_id);
CREATE INDEX IF NOT EXISTS idx_images_host ON images(host_id);
