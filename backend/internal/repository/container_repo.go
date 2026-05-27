package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
)

type ContainerRepository interface {
	Create(ctx context.Context, c *models.Container) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Container, error)
	FindByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) (*models.Container, error)
	FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Container, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status string) error
	Delete(ctx context.Context, id uuid.UUID) error
	ListAccessibleByUser(ctx context.Context, hostID, userID uuid.UUID) ([]models.Container, error)
}

type ContainerRepo struct {
	db *sql.DB
}

func NewContainerRepo(db *sql.DB) *ContainerRepo {
	return &ContainerRepo{db: db}
}

func (r *ContainerRepo) Create(ctx context.Context, c *models.Container) error {
	ports := c.Ports
	if ports == nil {
		ports = json.RawMessage("[]")
	}
	editableBy := c.EditableBy
	if editableBy == nil {
		editableBy = json.RawMessage("[]")
	}
	viewableBy := c.ViewableBy
	if viewableBy == nil {
		viewableBy = json.RawMessage("[]")
	}

	return r.db.QueryRowContext(ctx, `
		INSERT INTO containers (docker_container_id, name, image, status, ports, host_id, created_by, editable_by, viewable_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`,
		c.DockerContainerID, c.Name, c.Image, c.Status, ports, c.HostID, c.CreatedBy,
		editableBy, viewableBy,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *ContainerRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.Container, error) {
	c := &models.Container{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_container_id, name, image, status, ports, host_id,
		       created_by, editable_by, viewable_by, created_at, updated_at
		FROM containers WHERE id = $1
	`, id).Scan(
		&c.ID, &c.DockerContainerID, &c.Name, &c.Image, &c.Status, &c.Ports,
		&c.HostID, &c.CreatedBy, &c.EditableBy, &c.ViewableBy,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *ContainerRepo) FindByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) (*models.Container, error) {
	c := &models.Container{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_container_id, name, image, status, ports, host_id,
		       created_by, editable_by, viewable_by, created_at, updated_at
		FROM containers WHERE host_id = $1 AND docker_container_id = $2
	`, hostID, dockerID).Scan(
		&c.ID, &c.DockerContainerID, &c.Name, &c.Image, &c.Status, &c.Ports,
		&c.HostID, &c.CreatedBy, &c.EditableBy, &c.ViewableBy,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *ContainerRepo) FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Container, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, docker_container_id, name, image, status, ports, host_id,
		       created_by, editable_by, viewable_by, created_at, updated_at
		FROM containers WHERE host_id = $1
		ORDER BY created_at DESC
	`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []models.Container
	for rows.Next() {
		var c models.Container
		if err := rows.Scan(
			&c.ID, &c.DockerContainerID, &c.Name, &c.Image, &c.Status, &c.Ports,
			&c.HostID, &c.CreatedBy, &c.EditableBy, &c.ViewableBy,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		containers = append(containers, c)
	}
	return containers, rows.Err()
}

func (r *ContainerRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE containers SET status = $1, updated_at = NOW() WHERE id = $2
	`, status, id)
	return err
}

func (r *ContainerRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM containers WHERE id = $1`, id)
	return err
}

func (r *ContainerRepo) ListAccessibleByUser(ctx context.Context, hostID, userID uuid.UUID) ([]models.Container, error) {
	userIDStr := userID.String()

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, docker_container_id, name, image, status, ports, host_id,
		       created_by, editable_by, viewable_by, created_at, updated_at
		FROM containers
		WHERE host_id = $1
		  AND (
		      created_by = $2
		      OR editable_by @> $3::jsonb
		      OR viewable_by @> $3::jsonb
		  )
		ORDER BY created_at DESC
	`, hostID, userID, fmtJSONBArray(userIDStr))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []models.Container
	for rows.Next() {
		var c models.Container
		if err := rows.Scan(
			&c.ID, &c.DockerContainerID, &c.Name, &c.Image, &c.Status, &c.Ports,
			&c.HostID, &c.CreatedBy, &c.EditableBy, &c.ViewableBy,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		containers = append(containers, c)
	}
	return containers, rows.Err()
}

func fmtJSONBArray(id string) string {
	return `["` + id + `"]`
}
