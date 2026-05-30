package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type NullString struct {
	sql.NullString
}

func (ns NullString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.String)
}

func (ns *NullString) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		ns.Valid = false
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	ns.String = s
	ns.Valid = true
	return nil
}

type User struct {
	ID           uuid.UUID  `json:"id"            db:"id"`
	Username     string     `json:"username"      db:"username"`
	Email        string     `json:"email"         db:"email"`
	PasswordHash string     `json:"-"             db:"password_hash"`
	Role         string     `json:"role"          db:"role"`
	CreatedAt    time.Time  `json:"created_at"    db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"    db:"updated_at"`
}

type DockerHost struct {
	ID        uuid.UUID      `json:"id"          db:"id"`
	OwnerID   uuid.UUID      `json:"owner_id"    db:"owner_id"`
	Name      string         `json:"name"        db:"name"`
	HostIP    string         `json:"host_ip"     db:"host_ip"`
	Port      int            `json:"port"        db:"port"`
	Protocol  string         `json:"protocol"    db:"protocol"`
	AuthType  string         `json:"auth_type"   db:"auth_type"`
	TLSCA     NullString `json:"tls_ca"      db:"tls_ca"`
	TLSCert   NullString `json:"tls_cert"    db:"tls_cert"`
	TLSKey    NullString `json:"tls_key"     db:"tls_key"`
	SSHUser   NullString `json:"ssh_user"    db:"ssh_user"`
	SSHKey    NullString `json:"ssh_key"     db:"ssh_key"`
	IsActive  bool           `json:"is_active"   db:"is_active"`
	CreatedAt time.Time      `json:"created_at"  db:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"  db:"updated_at"`
}

type Container struct {
	ID                 uuid.UUID       `json:"id"                   db:"id"`
	DockerContainerID  string          `json:"docker_container_id"  db:"docker_container_id"`
	Name               string          `json:"name"                 db:"name"`
	Image              string          `json:"image"                db:"image"`
	Status             string          `json:"status"               db:"status"`
	Ports              json.RawMessage `json:"ports"                db:"ports"`
	HostID             uuid.UUID       `json:"host_id"              db:"host_id"`
	CreatedBy          uuid.NullUUID   `json:"created_by"           db:"created_by"`
	EditableBy         json.RawMessage `json:"editable_by"          db:"editable_by"`
	ViewableBy         json.RawMessage `json:"viewable_by"          db:"viewable_by"`
	CreatedAt          time.Time       `json:"created_at"           db:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"           db:"updated_at"`
}

type Network struct {
	ID              uuid.UUID `json:"id"                db:"id"`
	DockerNetworkID string    `json:"docker_network_id" db:"docker_network_id"`
	Name            string    `json:"name"              db:"name"`
	Driver          string    `json:"driver"            db:"driver"`
	Scope           string    `json:"scope"             db:"scope"`
	Internal        bool      `json:"internal"          db:"internal"`
	HostID          uuid.UUID `json:"host_id"           db:"host_id"`
	CreatedAt       time.Time `json:"created_at"        db:"created_at"`
}

type Volume struct {
	ID             uuid.UUID      `json:"id"               db:"id"`
	DockerVolumeID NullString `json:"docker_volume_id"  db:"docker_volume_id"`
	Name           string     `json:"name"             db:"name"`
	Driver         string     `json:"driver"           db:"driver"`
	Mountpoint     NullString `json:"mountpoint"        db:"mountpoint"`
	HostID         uuid.UUID      `json:"host_id"          db:"host_id"`
	CreatedAt      time.Time      `json:"created_at"       db:"created_at"`
}

type Image struct {
	ID            uuid.UUID `json:"id"              db:"id"`
	DockerImageID string    `json:"docker_image_id" db:"docker_image_id"`
	Name          string    `json:"name"            db:"name"`
	Tag           string    `json:"tag"             db:"tag"`
	Size          int64     `json:"size"            db:"size"`
	HostID        uuid.UUID `json:"host_id"         db:"host_id"`
	CreatedAt     time.Time `json:"created_at"      db:"created_at"`
}

type PortMapping struct {
	ContainerPort int    `json:"container_port"`
	HostPort      int    `json:"host_port"`
	Protocol      string `json:"protocol"`
}
