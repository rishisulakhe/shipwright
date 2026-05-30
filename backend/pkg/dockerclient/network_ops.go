package dockerclient

import (
	"context"

	"github.com/docker/docker/api/types/network"
)

func (dc *DockerClient) ListNetworks(ctx context.Context) ([]network.Summary, error) {
	return dc.Client.NetworkList(ctx, network.ListOptions{})
}

func (dc *DockerClient) InspectNetwork(ctx context.Context, networkID string) (network.Inspect, error) {
	return dc.Client.NetworkInspect(ctx, networkID, network.InspectOptions{})
}

func (dc *DockerClient) CreateNetwork(ctx context.Context, name string, opts network.CreateOptions) (network.CreateResponse, error) {
	return dc.Client.NetworkCreate(ctx, name, opts)
}

func (dc *DockerClient) RemoveNetwork(ctx context.Context, networkID string) error {
	return dc.Client.NetworkRemove(ctx, networkID)
}

func (dc *DockerClient) ConnectNetwork(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error {
	return dc.Client.NetworkConnect(ctx, networkID, containerID, config)
}

func (dc *DockerClient) DisconnectNetwork(ctx context.Context, networkID, containerID string, force bool) error {
	return dc.Client.NetworkDisconnect(ctx, networkID, containerID, force)
}