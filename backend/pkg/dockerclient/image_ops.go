package dockerclient

import (
	"context"
	"io"

	"github.com/docker/docker/api/types/image"
)

func (dc *DockerClient) ListImages(ctx context.Context, all bool) ([]image.Summary, error) {
	return dc.Client.ImageList(ctx, image.ListOptions{All: all})
}

func (dc *DockerClient) PullImage(ctx context.Context, refStr string, opts image.PullOptions) (io.ReadCloser, error) {
	return dc.Client.ImagePull(ctx, refStr, opts)
}

func (dc *DockerClient) RemoveImage(ctx context.Context, imageID string, opts image.RemoveOptions) ([]image.DeleteResponse, error) {
	return dc.Client.ImageRemove(ctx, imageID, opts)
}