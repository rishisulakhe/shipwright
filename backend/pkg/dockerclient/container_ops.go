package dockerclient

import (
	"context"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
)

func (dc *DockerClient) ListContainers(ctx context.Context, all bool) ([]types.Container, error) {
	return dc.Client.ContainerList(ctx, container.ListOptions{All: all})
}

func (dc *DockerClient) InspectContainer(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	return dc.Client.ContainerInspect(ctx, containerID)
}

func (dc *DockerClient) CreateContainer(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, name string) (container.CreateResponse, error) {
	return dc.Client.ContainerCreate(ctx, config, hostConfig, networkingConfig, nil, name)
}

func (dc *DockerClient) StartContainer(ctx context.Context, containerID string, opts container.StartOptions) error {
	return dc.Client.ContainerStart(ctx, containerID, opts)
}

func (dc *DockerClient) StopContainer(ctx context.Context, containerID string, timeout *int) error {
	return dc.Client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: timeout})
}

func (dc *DockerClient) RemoveContainer(ctx context.Context, containerID string, opts container.RemoveOptions) error {
	return dc.Client.ContainerRemove(ctx, containerID, opts)
}

func (dc *DockerClient) ContainerLogs(ctx context.Context, containerID string, opts container.LogsOptions) (io.ReadCloser, error) {
	return dc.Client.ContainerLogs(ctx, containerID, opts)
}

func (dc *DockerClient) ContainerStats(ctx context.Context, containerID string, stream bool) (container.StatsResponseReader, error) {
	return dc.Client.ContainerStats(ctx, containerID, stream)
}

func (dc *DockerClient) ExecCreate(ctx context.Context, containerID string, opts container.ExecOptions) (container.ExecCreateResponse, error) {
	return dc.Client.ContainerExecCreate(ctx, containerID, opts)
}

func (dc *DockerClient) ExecAttach(ctx context.Context, execID string, opts container.ExecAttachOptions) (types.HijackedResponse, error) {
	return dc.Client.ContainerExecAttach(ctx, execID, opts)
}

func (dc *DockerClient) ExecResize(ctx context.Context, execID string, opts container.ResizeOptions) error {
	return dc.Client.ContainerExecResize(ctx, execID, opts)
}