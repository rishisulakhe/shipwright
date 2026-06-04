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

type DockerProvider interface {
	Ping(ctx context.Context) error
	Close() error
	ListContainers(ctx context.Context, all bool) ([]types.Container, error)
	InspectContainer(ctx context.Context, containerID string) (types.ContainerJSON, error)
	CreateContainer(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, name string) (container.CreateResponse, error)
	StartContainer(ctx context.Context, containerID string, opts container.StartOptions) error
	StopContainer(ctx context.Context, containerID string, timeout *int) error
	RemoveContainer(ctx context.Context, containerID string, opts container.RemoveOptions) error
	ContainerLogs(ctx context.Context, containerID string, opts container.LogsOptions) (io.ReadCloser, error)
	ContainerStats(ctx context.Context, containerID string, stream bool) (container.StatsResponseReader, error)
	ExecCreate(ctx context.Context, containerID string, opts container.ExecOptions) (container.ExecCreateResponse, error)
	ExecAttach(ctx context.Context, execID string, opts container.ExecAttachOptions) (types.HijackedResponse, error)
	ExecResize(ctx context.Context, execID string, opts container.ResizeOptions) error
	ListImages(ctx context.Context, all bool) ([]image.Summary, error)
	PullImage(ctx context.Context, refStr string, opts image.PullOptions) (io.ReadCloser, error)
	RemoveImage(ctx context.Context, imageID string, opts image.RemoveOptions) ([]image.DeleteResponse, error)
	ListNetworks(ctx context.Context) ([]network.Summary, error)
	InspectNetwork(ctx context.Context, networkID string) (network.Inspect, error)
	CreateNetwork(ctx context.Context, name string, opts network.CreateOptions) (network.CreateResponse, error)
	RemoveNetwork(ctx context.Context, networkID string) error
	ConnectNetwork(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error
	DisconnectNetwork(ctx context.Context, networkID, containerID string, force bool) error
	ListVolumes(ctx context.Context) (volume.ListResponse, error)
	CreateVolume(ctx context.Context, opts volume.CreateOptions) (volume.Volume, error)
	RemoveVolume(ctx context.Context, volumeID string, force bool) error
}