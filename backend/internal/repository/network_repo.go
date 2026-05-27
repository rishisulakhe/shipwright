package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
)

type NetworkRepository interface {
	Create(ctx context.Context, n *models.Network) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Network, error)
	FindByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) (*models.Network, error)
	FindByName(ctx context.Context, hostID uuid.UUID, name string) (*models.Network, error)
	FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Network, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type NetworkRepo struct {
	db *sql.DB
}

func NewNetworkRepo(db *sql.DB) *NetworkRepo {
	return &NetworkRepo{db: db}
}

func (r *NetworkRepo) Create(ctx context.Context, n *models.Network) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO networks (docker_network_id, name, driver, scope, internal, host_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`,
		n.DockerNetworkID, n.Name, n.Driver, n.Scope, n.Internal, n.HostID,
	).Scan(&n.ID, &n.CreatedAt)
}

func (r *NetworkRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.Network, error) {
	n := &models.Network{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_network_id, name, driver, scope, internal, host_id, created_at
		FROM networks WHERE id = $1
	`, id).Scan(
		&n.ID, &n.DockerNetworkID, &n.Name, &n.Driver, &n.Scope, &n.Internal,
		&n.HostID, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return n, nil
}

func (r *NetworkRepo) FindByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) (*models.Network, error) {
	n := &models.Network{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_network_id, name, driver, scope, internal, host_id, created_at
		FROM networks WHERE host_id = $1 AND docker_network_id = $2
	`, hostID, dockerID).Scan(
		&n.ID, &n.DockerNetworkID, &n.Name, &n.Driver, &n.Scope, &n.Internal,
		&n.HostID, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return n, nil
}

func (r *NetworkRepo) FindByName(ctx context.Context, hostID uuid.UUID, name string) (*models.Network, error) {
	n := &models.Network{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_network_id, name, driver, scope, internal, host_id, created_at
		FROM networks WHERE host_id = $1 AND name = $2
	`, hostID, name).Scan(
		&n.ID, &n.DockerNetworkID, &n.Name, &n.Driver, &n.Scope, &n.Internal,
		&n.HostID, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return n, nil
}

func (r *NetworkRepo) FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Network, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, docker_network_id, name, driver, scope, internal, host_id, created_at
		FROM networks WHERE host_id = $1
		ORDER BY created_at DESC
	`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var networks []models.Network
	for rows.Next() {
		var n models.Network
		if err := rows.Scan(
			&n.ID, &n.DockerNetworkID, &n.Name, &n.Driver, &n.Scope, &n.Internal,
			&n.HostID, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		networks = append(networks, n)
	}
	return networks, rows.Err()
}

func (r *NetworkRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM networks WHERE id = $1`, id)
	return err
}
