package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
)

type ImageRepository interface {
	Create(ctx context.Context, i *models.Image) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Image, error)
	FindByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) (*models.Image, error)
	FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Image, error)
	Delete(ctx context.Context, id uuid.UUID) error
	DeleteByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) error
}

type ImageRepo struct {
	db *sql.DB
}

func NewImageRepo(db *sql.DB) *ImageRepo {
	return &ImageRepo{db: db}
}

func (r *ImageRepo) Create(ctx context.Context, i *models.Image) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO images (docker_image_id, name, tag, size, host_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`,
		i.DockerImageID, i.Name, i.Tag, i.Size, i.HostID,
	).Scan(&i.ID, &i.CreatedAt)
}

func (r *ImageRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.Image, error) {
	i := &models.Image{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_image_id, name, tag, size, host_id, created_at
		FROM images WHERE id = $1
	`, id).Scan(
		&i.ID, &i.DockerImageID, &i.Name, &i.Tag, &i.Size, &i.HostID, &i.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return i, nil
}

func (r *ImageRepo) FindByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) (*models.Image, error) {
	i := &models.Image{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, docker_image_id, name, tag, size, host_id, created_at
		FROM images WHERE host_id = $1 AND docker_image_id = $2
	`, hostID, dockerID).Scan(
		&i.ID, &i.DockerImageID, &i.Name, &i.Tag, &i.Size, &i.HostID, &i.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return i, nil
}

func (r *ImageRepo) FindByHost(ctx context.Context, hostID uuid.UUID) ([]models.Image, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, docker_image_id, name, tag, size, host_id, created_at
		FROM images WHERE host_id = $1
		ORDER BY created_at DESC
	`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []models.Image
	for rows.Next() {
		var i models.Image
		if err := rows.Scan(
			&i.ID, &i.DockerImageID, &i.Name, &i.Tag, &i.Size, &i.HostID, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		images = append(images, i)
	}
	return images, rows.Err()
}

func (r *ImageRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM images WHERE id = $1`, id)
	return err
}

func (r *ImageRepo) DeleteByDockerID(ctx context.Context, hostID uuid.UUID, dockerID string) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM images WHERE host_id = $1 AND docker_image_id = $2
	`, hostID, dockerID)
	return err
}
