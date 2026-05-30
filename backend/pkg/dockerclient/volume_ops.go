package dockerclient

import (
	"context"

	"github.com/docker/docker/api/types/volume"
)

func (dc *DockerClient) ListVolumes(ctx context.Context) (volume.ListResponse, error) {
	return dc.Client.VolumeList(ctx, volume.ListOptions{})
}

func (dc *DockerClient) CreateVolume(ctx context.Context, opts volume.CreateOptions) (volume.Volume, error) {
	return dc.Client.VolumeCreate(ctx, opts)
}

func (dc *DockerClient) RemoveVolume(ctx context.Context, volumeID string, force bool) error {
	return dc.Client.VolumeRemove(ctx, volumeID, force)
}