package dockerclient

import (
	"context"
	"fmt"

	"github.com/docker/docker/client"
)

type DockerClient struct {
	BaseURL string
	Client  *client.Client
}

func NewClient(host string, port int, protocol string) (*DockerClient, error) {
	var baseURL string
	switch protocol {
	case "unix":
		baseURL = "unix:///var/run/docker.sock"
	case "ssh":
		baseURL = fmt.Sprintf("ssh://%s:%d", host, port)
	default:
		baseURL = fmt.Sprintf("tcp://%s:%d", host, port)
	}

	cli, err := client.NewClientWithOpts(
		client.WithHost(baseURL),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}

	return &DockerClient{
		BaseURL: baseURL,
		Client:  cli,
	}, nil
}

func (dc *DockerClient) Ping(ctx context.Context) error {
	_, err := dc.Client.Ping(ctx)
	if err != nil {
		return fmt.Errorf("ping docker daemon: %w", err)
	}
	return nil
}

func (dc *DockerClient) Close() error {
	return dc.Client.Close()
}