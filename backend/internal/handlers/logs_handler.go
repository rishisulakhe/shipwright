package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type LogsHandler struct {
	Repos   *repository.Repositories
	clients map[uuid.UUID]*dockerclient.DockerClient
}

func NewLogsHandler(repos *repository.Repositories, clients map[uuid.UUID]*dockerclient.DockerClient) *LogsHandler {
	return &LogsHandler{
		Repos:   repos,
		clients: clients,
	}
}

func (h *LogsHandler) getOrCreateClient(ctx context.Context, hostID uuid.UUID) (*dockerclient.DockerClient, error) {
	if dc, ok := h.clients[hostID]; ok {
		return dc, nil
	}

	host, err := h.Repos.Hosts.FindByID(ctx, hostID)
	if err != nil {
		return nil, err
	}

	dc, err := dockerclient.NewClient(host.HostIP, host.Port, host.Protocol)
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := dc.Ping(pingCtx); err != nil {
		dc.Close()
		return nil, err
	}

	h.clients[hostID] = dc
	return dc, nil
}

type logLine struct {
	Content string `json:"content"`
	Stream  string `json:"stream"`
}

func (h *LogsHandler) Get(w http.ResponseWriter, r *http.Request) {
	hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
	if err != nil {
		JSONError(w, http.StatusBadRequest, "invalid host id")
		return
	}

	_, err = h.Repos.Hosts.FindByID(r.Context(), hostID)
	if err != nil {
		JSONError(w, http.StatusNotFound, "host not found")
		return
	}

	containerID := chi.URLParam(r, "containerID")

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "100"
	}

	timestamps := r.URL.Query().Get("timestamps") == "true"

	since := r.URL.Query().Get("since")

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	opts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     false,
		Tail:       tail,
		Timestamps: timestamps,
	}

	if since != "" {
		opts.Since = since
	}

	reader, err := dc.ContainerLogs(ctx, containerID, opts)
	if err != nil {
		slog.Error("failed to get container logs", "containerID", containerID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to get container logs: "+err.Error())
		return
	}
	defer reader.Close()

	lines := make([]logLine, 0)
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		stream := "stdout"
		if len(line) > 0 && (line[0] == 1 || line[0] == 2) {
			if line[0] == 2 {
				stream = "stderr"
			}
			line = line[8:]
		} else if len(line) > 8 && (line[0] == 0) {
			line = line[8:]
		}
		lines = append(lines, logLine{Content: line, Stream: stream})
	}

	if err := scanner.Err(); err != nil {
		slog.Warn("error scanning container logs", "error", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lines)
}

func (h *LogsHandler) Inspect(w http.ResponseWriter, r *http.Request) {
	hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
	if err != nil {
		JSONError(w, http.StatusBadRequest, "invalid host id")
		return
	}

	_, err = h.Repos.Hosts.FindByID(r.Context(), hostID)
	if err != nil {
		JSONError(w, http.StatusNotFound, "host not found")
		return
	}

	containerID := chi.URLParam(r, "containerID")

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inspectData, err := dc.InspectContainer(ctx, containerID)
	if err != nil {
		slog.Error("failed to inspect container", "containerID", containerID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to inspect container")
		return
	}

	envVars := make([]string, 0)
	labels := make(map[string]string)
	if inspectData.Config != nil {
		envVars = inspectData.Config.Env
		labels = inspectData.Config.Labels
	}

	portBindings := make(map[string]interface{})
	if inspectData.HostConfig != nil && inspectData.HostConfig.PortBindings != nil {
		for k, bindings := range inspectData.HostConfig.PortBindings {
			bindingsList := make([]map[string]string, 0, len(bindings))
			for _, b := range bindings {
				bindingsList = append(bindingsList, map[string]string{
					"host_ip":   b.HostIP,
					"host_port": b.HostPort,
				})
			}
			portBindings[string(k)] = bindingsList
		}
	}

	networks := make(map[string]interface{})
	if inspectData.NetworkSettings != nil {
		for name, endpoint := range inspectData.NetworkSettings.Networks {
			networks[name] = map[string]string{
				"ip_address":  endpoint.IPAddress,
				"gateway":      endpoint.Gateway,
				"network_id":   endpoint.NetworkID,
			}
		}
	}

	mounts := make([]map[string]string, 0)
	for _, m := range inspectData.Mounts {
		mounts = append(mounts, map[string]string{
			"source":      m.Source,
			"destination": m.Destination,
			"mode":        m.Mode,
			"type":        string(m.Type),
		})
	}

	resp := map[string]interface{}{
		"id":           inspectData.ID,
		"name":         inspectData.Name,
		"image":        inspectData.Image,
		"state": map[string]interface{}{
			"status":     inspectData.State.Status,
			"running":    inspectData.State.Running,
			"paused":     inspectData.State.Paused,
			"restarting": inspectData.State.Restarting,
			"started_at": inspectData.State.StartedAt,
		},
		"created":      inspectData.Created,
		"environment":  envVars,
		"labels":       labels,
		"ports":         portBindings,
		"networks":     networks,
		"mounts":        mounts,
		"restart_policy": func() string {
			if inspectData.HostConfig != nil {
				return string(inspectData.HostConfig.RestartPolicy.Name)
			}
			return ""
		}(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}