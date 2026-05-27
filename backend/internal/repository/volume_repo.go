package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
)

type VolumeRepository interface {
	Create(ctx context.Context, v *models.Volume) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Volume, error)
	FindByName(ctx context.Context, hostID uuid.UUID, name string) (*models.Volume, error)
	FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Volume, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type VolumeRepo struct {
	db *sql.DB
}

func NewVolumeRepo(db *sql.DB) *VolumeRepo {
	return &VolumeRepo{db: db}
}

func (r *VolumeRepo) Create(ctx context.Context, v *models.Volume) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO volumes (docker_volume_id, name, driver, mountpoint, host_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`,
		v.DockerVolumeID, v.Name, v.Driver, v.Mountpoint, v.HostID,
	).Scan(&v.ID, &v.CreatedAt)
}

func (r *VolumeRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.Volume, error) {
	v := &models.Volume{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_volume_id, name, driver, mountpoint, host_id, created_at
		FROM volumes WHERE id = $1
	`, id).Scan(
		&v.ID, &v.DockerVolumeID, &v.Name, &v.Driver, &v.Mountpoint, &v.HostID, &v.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (r *VolumeRepo) FindByName(ctx context.Context, hostID uuid.UUID, name string) (*models.Volume, error) {
	v := &models.Volume{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_volume_id, name, driver, mountpoint, host_id, created_at
		FROM volumes WHERE host_id = $1 AND name = $2
	`, hostID, name).Scan(
		&v.ID, &v.DockerVolumeID, &v.Name, &v.Driver, &v.Mountpoint, &v.HostID, &v.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (r *VolumeRepo) FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Volume, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, docker_volume_id, name, driver, mountpoint, host_id, created_at
		FROM volumes WHERE host_id = $1
		ORDER BY created_at DESC
	`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volumes []models.Volume
	for rows.Next() {
		var v models.Volume
		if err := rows.Scan(
			&v.ID, &v.DockerVolumeID, &v.Name, &v.Driver, &v.Mountpoint, &v.HostID, &v.CreatedAt,
		); err != nil {
			return nil, err
		}
		volumes = append(volumes, v)
	}
	return volumes, rows.Err()
}

func (r *VolumeRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM volumes WHERE id = $1`, id)
	return err
}
