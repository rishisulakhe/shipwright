package dockerclient

import (
	"context"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
)

type MockDockerClient struct {
	PingFunc              func(ctx context.Context) error
	CloseFunc             func() error
	ListContainersFunc    func(ctx context.Context, all bool) ([]types.Container, error)
	InspectContainerFunc  func(ctx context.Context, containerID string) (types.ContainerJSON, error)
	CreateContainerFunc   func(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, name string) (container.CreateResponse, error)
	StartContainerFunc   func(ctx context.Context, containerID string, opts container.StartOptions) error
	StopContainerFunc     func(ctx context.Context, containerID string, timeout *int) error
	RemoveContainerFunc   func(ctx context.Context, containerID string, opts container.RemoveOptions) error
	ContainerLogsFunc    func(ctx context.Context, containerID string, opts container.LogsOptions) (io.ReadCloser, error)
	ContainerStatsFunc   func(ctx context.Context, containerID string, stream bool) (container.StatsResponseReader, error)
	ExecCreateFunc       func(ctx context.Context, containerID string, opts container.ExecOptions) (container.ExecCreateResponse, error)
	ExecAttachFunc       func(ctx context.Context, execID string, opts container.ExecAttachOptions) (types.HijackedResponse, error)
	ExecResizeFunc       func(ctx context.Context, execID string, opts container.ResizeOptions) error
	ListImagesFunc       func(ctx context.Context, all bool) ([]image.Summary, error)
	PullImageFunc        func(ctx context.Context, refStr string, opts image.PullOptions) (io.ReadCloser, error)
	RemoveImageFunc      func(ctx context.Context, imageID string, opts image.RemoveOptions) ([]image.DeleteResponse, error)
	ListNetworksFunc     func(ctx context.Context) ([]network.Summary, error)
	InspectNetworkFunc   func(ctx context.Context, networkID string) (network.Inspect, error)
	CreateNetworkFunc    func(ctx context.Context, name string, opts network.CreateOptions) (network.CreateResponse, error)
	RemoveNetworkFunc    func(ctx context.Context, networkID string) error
	ConnectNetworkFunc   func(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error
	DisconnectNetworkFunc func(ctx context.Context, networkID, containerID string, force bool) error
	ListVolumesFunc      func(ctx context.Context) (volume.ListResponse, error)
	CreateVolumeFunc     func(ctx context.Context, opts volume.CreateOptions) (volume.Volume, error)
	RemoveVolumeFunc     func(ctx context.Context, volumeID string, force bool) error
}

func (m *MockDockerClient) Ping(ctx context.Context) error {
	if m.PingFunc != nil {
		return m.PingFunc(ctx)
	}
	return nil
}

func (m *MockDockerClient) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

func (m *MockDockerClient) ListContainers(ctx context.Context, all bool) ([]types.Container, error) {
	if m.ListContainersFunc != nil {
		return m.ListContainersFunc(ctx, all)
	}
	return nil, nil
}

func (m *MockDockerClient) InspectContainer(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	if m.InspectContainerFunc != nil {
		return m.InspectContainerFunc(ctx, containerID)
	}
	return types.ContainerJSON{}, nil
}

func (m *MockDockerClient) CreateContainer(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, name string) (container.CreateResponse, error) {
	if m.CreateContainerFunc != nil {
		return m.CreateContainerFunc(ctx, config, hostConfig, networkingConfig, name)
	}
	return container.CreateResponse{}, nil
}

func (m *MockDockerClient) StartContainer(ctx context.Context, containerID string, opts container.StartOptions) error {
	if m.StartContainerFunc != nil {
		return m.StartContainerFunc(ctx, containerID, opts)
	}
	return nil
}

func (m *MockDockerClient) StopContainer(ctx context.Context, containerID string, timeout *int) error {
	if m.StopContainerFunc != nil {
		return m.StopContainerFunc(ctx, containerID, timeout)
	}
	return nil
}

func (m *MockDockerClient) RemoveContainer(ctx context.Context, containerID string, opts container.RemoveOptions) error {
	if m.RemoveContainerFunc != nil {
		return m.RemoveContainerFunc(ctx, containerID, opts)
	}
	return nil
}

func (m *MockDockerClient) ContainerLogs(ctx context.Context, containerID string, opts container.LogsOptions) (io.ReadCloser, error) {
	if m.ContainerLogsFunc != nil {
		return m.ContainerLogsFunc(ctx, containerID, opts)
	}
	return nil, nil
}

func (m *MockDockerClient) ContainerStats(ctx context.Context, containerID string, stream bool) (container.StatsResponseReader, error) {
	if m.ContainerStatsFunc != nil {
		return m.ContainerStatsFunc(ctx, containerID, stream)
	}
	return container.StatsResponseReader{}, nil
}

func (m *MockDockerClient) ExecCreate(ctx context.Context, containerID string, opts container.ExecOptions) (container.ExecCreateResponse, error) {
	if m.ExecCreateFunc != nil {
		return m.ExecCreateFunc(ctx, containerID, opts)
	}
	return container.ExecCreateResponse{}, nil
}

func (m *MockDockerClient) ExecAttach(ctx context.Context, execID string, opts container.ExecAttachOptions) (types.HijackedResponse, error) {
	if m.ExecAttachFunc != nil {
		return m.ExecAttachFunc(ctx, execID, opts)
	}
	return types.HijackedResponse{}, nil
}

func (m *MockDockerClient) ExecResize(ctx context.Context, execID string, opts container.ResizeOptions) error {
	if m.ExecResizeFunc != nil {
		return m.ExecResizeFunc(ctx, execID, opts)
	}
	return nil
}

func (m *MockDockerClient) ListImages(ctx context.Context, all bool) ([]image.Summary, error) {
	if m.ListImagesFunc != nil {
		return m.ListImagesFunc(ctx, all)
	}
	return nil, nil
}

func (m *MockDockerClient) PullImage(ctx context.Context, refStr string, opts image.PullOptions) (io.ReadCloser, error) {
	if m.PullImageFunc != nil {
		return m.PullImageFunc(ctx, refStr, opts)
	}
	return nil, nil
}

func (m *MockDockerClient) RemoveImage(ctx context.Context, imageID string, opts image.RemoveOptions) ([]image.DeleteResponse, error) {
	if m.RemoveImageFunc != nil {
		return m.RemoveImageFunc(ctx, imageID, opts)
	}
	return nil, nil
}

func (m *MockDockerClient) ListNetworks(ctx context.Context) ([]network.Summary, error) {
	if m.ListNetworksFunc != nil {
		return m.ListNetworksFunc(ctx)
	}
	return nil, nil
}

func (m *MockDockerClient) InspectNetwork(ctx context.Context, networkID string) (network.Inspect, error) {
	if m.InspectNetworkFunc != nil {
		return m.InspectNetworkFunc(ctx, networkID)
	}
	return network.Inspect{}, nil
}

func (m *MockDockerClient) CreateNetwork(ctx context.Context, name string, opts network.CreateOptions) (network.CreateResponse, error) {
	if m.CreateNetworkFunc != nil {
		return m.CreateNetworkFunc(ctx, name, opts)
	}
	return network.CreateResponse{}, nil
}

func (m *MockDockerClient) RemoveNetwork(ctx context.Context, networkID string) error {
	if m.RemoveNetworkFunc != nil {
		return m.RemoveNetworkFunc(ctx, networkID)
	}
	return nil
}

func (m *MockDockerClient) ConnectNetwork(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error {
	if m.ConnectNetworkFunc != nil {
		return m.ConnectNetworkFunc(ctx, networkID, containerID, config)
	}
	return nil
}

func (m *MockDockerClient) DisconnectNetwork(ctx context.Context, networkID, containerID string, force bool) error {
	if m.DisconnectNetworkFunc != nil {
		return m.DisconnectNetworkFunc(ctx, networkID, containerID, force)
	}
	return nil
}

func (m *MockDockerClient) ListVolumes(ctx context.Context) (volume.ListResponse, error) {
	if m.ListVolumesFunc != nil {
		return m.ListVolumesFunc(ctx)
	}
	return volume.ListResponse{}, nil
}

func (m *MockDockerClient) CreateVolume(ctx context.Context, opts volume.CreateOptions) (volume.Volume, error) {
	if m.CreateVolumeFunc != nil {
		return m.CreateVolumeFunc(ctx, opts)
	}
	return volume.Volume{}, nil
}

func (m *MockDockerClient) RemoveVolume(ctx context.Context, volumeID string, force bool) error {
	if m.RemoveVolumeFunc != nil {
		return m.RemoveVolumeFunc(ctx, volumeID, force)
	}
	return nil
}