package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
)

type HostRepository interface {
	Create(ctx context.Context, host *models.DockerHost) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.DockerHost, error)
	FindByOwner(ctx context.Context, ownerID uuid.UUID) ([]models.DockerHost, error)
	ListAll(ctx context.Context) ([]models.DockerHost, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, active bool) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type HostRepo struct {
	db *sql.DB
}

func NewHostRepo(db *sql.DB) *HostRepo {
	return &HostRepo{db: db}
}

func (r *HostRepo) Create(ctx context.Context, host *models.DockerHost) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO docker_hosts (owner_id, name, host_ip, port, protocol, auth_type, tls_ca, tls_cert, tls_key, ssh_user, ssh_key, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`,
		host.OwnerID, host.Name, host.HostIP, host.Port, host.Protocol,
		host.AuthType, host.TLSCA, host.TLSCert, host.TLSKey, host.SSHUser, host.SSHKey, host.IsActive,
	).Scan(&host.ID, &host.CreatedAt, &host.UpdatedAt)
}

func (r *HostRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.DockerHost, error) {
	host := &models.DockerHost{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, owner_id, name, host_ip, port, protocol, auth_type,
		       tls_ca, tls_cert, tls_key, ssh_user, ssh_key, is_active, created_at, updated_at
		FROM docker_hosts WHERE id = $1
	`, id).Scan(
		&host.ID, &host.OwnerID, &host.Name, &host.HostIP, &host.Port, &host.Protocol,
		&host.AuthType, &host.TLSCA, &host.TLSCert, &host.TLSKey, &host.SSHUser, &host.SSHKey,
		&host.IsActive, &host.CreatedAt, &host.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return host, nil
}

func (r *HostRepo) FindByOwner(ctx context.Context, ownerID uuid.UUID) ([]models.DockerHost, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, owner_id, name, host_ip, port, protocol, auth_type,
		       tls_ca, tls_cert, tls_key, ssh_user, ssh_key, is_active, created_at, updated_at
		FROM docker_hosts WHERE owner_id = $1
		ORDER BY created_at DESC
	`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hosts []models.DockerHost
	for rows.Next() {
		var h models.DockerHost
		if err := rows.Scan(
			&h.ID, &h.OwnerID, &h.Name, &h.HostIP, &h.Port, &h.Protocol,
			&h.AuthType, &h.TLSCA, &h.TLSCert, &h.TLSKey, &h.SSHUser, &h.SSHKey,
			&h.IsActive, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, err
		}
		hosts = append(hosts, h)
	}
	return hosts, rows.Err()
}

func (r *HostRepo) ListAll(ctx context.Context) ([]models.DockerHost, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, owner_id, name, host_ip, port, protocol, auth_type,
		       tls_ca, tls_cert, tls_key, ssh_user, ssh_key, is_active, created_at, updated_at
		FROM docker_hosts ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hosts []models.DockerHost
	for rows.Next() {
		var h models.DockerHost
		if err := rows.Scan(
			&h.ID, &h.OwnerID, &h.Name, &h.HostIP, &h.Port, &h.Protocol,
			&h.AuthType, &h.TLSCA, &h.TLSCert, &h.TLSKey, &h.SSHUser, &h.SSHKey,
			&h.IsActive, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, err
		}
		hosts = append(hosts, h)
	}
	return hosts, rows.Err()
}

func (r *HostRepo) UpdateStatus(ctx context.Context, id uuid.UUID, active bool) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE docker_hosts SET is_active = $1, updated_at = NOW() WHERE id = $2
	`, active, id)
	return err
}

func (r *HostRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM docker_hosts WHERE id = $1`, id)
	return err
}
