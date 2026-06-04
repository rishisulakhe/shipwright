package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/middleware"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type ContainerHandler struct {
	Repos   *repository.Repositories
clients map[uuid.UUID]dockerclient.DockerProvider
}

func NewContainerHandler(repos *repository.Repositories, clients map[uuid.UUID]dockerclient.DockerProvider) *ContainerHandler {
	return &ContainerHandler{
		Repos:   repos,
		clients: clients,
	}
}

func (h *ContainerHandler) getOrCreateClient(ctx context.Context, hostID uuid.UUID) (dockerclient.DockerProvider, error) {
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

type createContainerRequest struct {
	Name          string            `json:"name"`
	Image         string            `json:"image"`
	Ports         []portMapping     `json:"ports"`
	EnvVars       map[string]string `json:"env_vars"`
	Volumes       []string          `json:"volumes"`
	RestartPolicy string            `json:"restart_policy"`
	NetworkName   string            `json:"network"`
	Start         bool              `json:"start"`
}

type portMapping struct {
	ContainerPort int    `json:"container_port"`
	HostPort      int    `json:"host_port"`
	Protocol      string `json:"protocol"`
}

func (h *ContainerHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	userID, err := uuid.Parse(middleware.GetUserID(r.Context()))
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid user id")
		return
	}

	var req createContainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Image == "" {
		JSONError(w, http.StatusBadRequest, "image is required")
		return
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	pullCtx, pullCancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer pullCancel()

	reader, err := dc.PullImage(pullCtx, req.Image, image.PullOptions{})
	if err != nil {
		slog.Error("failed to pull image", "image", req.Image, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to pull image: "+err.Error())
		return
	}
	io.ReadAll(reader)
	reader.Close()

	envSlice := make([]string, 0, len(req.EnvVars))
	for k, v := range req.EnvVars {
		envSlice = append(envSlice, k+"="+v)
	}

	containerConfig := &container.Config{
		Image: req.Image,
		Env:   envSlice,
	}

	hostConfig := &container.HostConfig{
		Binds: req.Volumes,
		RestartPolicy: container.RestartPolicy{
			Name: mapRestartPolicy(req.RestartPolicy),
		},
	}

	if len(req.Ports) > 0 {
		portMap, exposedPorts := buildPortBindings(req.Ports)
		hostConfig.PortBindings = portMap
		containerConfig.ExposedPorts = exposedPorts
	}

	var networkingConfig *network.NetworkingConfig
	if req.NetworkName != "" {
		networkingConfig = &network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				req.NetworkName: {},
			},
		}
	}

	createResp, err := dc.CreateContainer(r.Context(), containerConfig, hostConfig, networkingConfig, req.Name)
	if err != nil {
		slog.Error("failed to create container", "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to create container: "+err.Error())
		return
	}

	dockerContainerID := createResp.ID

	if req.Start {
		if err := dc.StartContainer(r.Context(), dockerContainerID, container.StartOptions{}); err != nil {
			slog.Warn("container created but failed to start", "containerID", dockerContainerID, "error", err)
		}
	}

	inspectCtx, inspectCancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer inspectCancel()

	containerName := req.Name
	state := "created"
	status := ""
	inspectData, inspectErr := dc.InspectContainer(inspectCtx, dockerContainerID)
	if inspectErr == nil {
		if len(inspectData.Name) > 0 {
			containerName = strings.TrimPrefix(inspectData.Name, "/")
		}
		state = inspectData.State.Status
		status = inspectData.State.Status
	} else if req.Start {
		state = "running"
		status = "running"
	}

	portsJSON, _ := json.Marshal(req.Ports)

	dbContainer := &models.Container{
		DockerContainerID: dockerContainerID,
		Name:               containerName,
		Image:              req.Image,
		Status:             status,
		Ports:              portsJSON,
		HostID:             hostID,
		CreatedBy:          uuid.NullUUID{UUID: userID, Valid: true},
		EditableBy:         json.RawMessage(fmt.Sprintf(`["%s"]`, userID)),
		ViewableBy:         json.RawMessage(fmt.Sprintf(`["%s"]`, userID)),
	}

	if err := h.Repos.Containers.Create(r.Context(), dbContainer); err != nil {
		slog.Error("failed to save container to db", "error", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":       dockerContainerID,
		"name":     containerName,
		"image":    req.Image,
		"state":    state,
		"status":   status,
		"db_id":    dbContainer.ID,
		"warnings": createResp.Warnings,
	})
}

func (h *ContainerHandler) Start(w http.ResponseWriter, r *http.Request) {
	hostID, dc, errCode, errMsg := h.resolveHostAndClient(r)
	if errCode != 0 {
		JSONError(w, errCode, errMsg)
		return
	}

	dockerID := chi.URLParam(r, "containerID")

	if err := dc.StartContainer(r.Context(), dockerID, container.StartOptions{}); err != nil {
		slog.Error("failed to start container", "hostID", hostID, "containerID", dockerID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to start container: "+err.Error())
		return
	}

	dbContainer, err := h.Repos.Containers.FindByDockerID(r.Context(), hostID, dockerID)
	if err == nil {
		_ = h.Repos.Containers.UpdateStatus(r.Context(), dbContainer.ID, "running")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (h *ContainerHandler) Stop(w http.ResponseWriter, r *http.Request) {
	hostID, dc, errCode, errMsg := h.resolveHostAndClient(r)
	if errCode != 0 {
		JSONError(w, errCode, errMsg)
		return
	}

	dockerID := chi.URLParam(r, "containerID")

	timeout := 10
	if t := r.URL.Query().Get("timeout"); t != "" {
		if v, err := strconv.Atoi(t); err == nil {
			timeout = v
		}
	}

	if err := dc.StopContainer(r.Context(), dockerID, &timeout); err != nil {
		slog.Error("failed to stop container", "hostID", hostID, "containerID", dockerID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to stop container: "+err.Error())
		return
	}

	dbContainer, err := h.Repos.Containers.FindByDockerID(r.Context(), hostID, dockerID)
	if err == nil {
		_ = h.Repos.Containers.UpdateStatus(r.Context(), dbContainer.ID, "stopped")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (h *ContainerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	hostID, dc, errCode, errMsg := h.resolveHostAndClient(r)
	if errCode != 0 {
		JSONError(w, errCode, errMsg)
		return
	}

	dockerID := chi.URLParam(r, "containerID")
	force := r.URL.Query().Get("force") == "true"

	if err := dc.RemoveContainer(r.Context(), dockerID, container.RemoveOptions{Force: force}); err != nil {
		if !force {
			_ = dc.StopContainer(r.Context(), dockerID, nil)
			if err2 := dc.RemoveContainer(r.Context(), dockerID, container.RemoveOptions{Force: true}); err2 != nil {
				slog.Error("failed to remove container", "hostID", hostID, "containerID", dockerID, "error", err)
				JSONError(w, http.StatusInternalServerError, "failed to remove container: "+err.Error())
				return
			}
		} else {
			slog.Error("failed to remove container", "hostID", hostID, "containerID", dockerID, "error", err)
			JSONError(w, http.StatusInternalServerError, "failed to remove container: "+err.Error())
			return
		}
	}

	dbContainer, err := h.Repos.Containers.FindByDockerID(r.Context(), hostID, dockerID)
	if err == nil {
		_ = h.Repos.Containers.Delete(r.Context(), dbContainer.ID)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ContainerHandler) resolveHostAndClient(r *http.Request) (uuid.UUID, dockerclient.DockerProvider, int, string) {
	hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
	if err != nil {
		return uuid.Nil, nil, http.StatusBadRequest, "invalid host id"
	}

	_, err = h.Repos.Hosts.FindByID(r.Context(), hostID)
	if err != nil {
		return uuid.Nil, nil, http.StatusNotFound, "host not found"
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		return uuid.Nil, nil, http.StatusBadGateway, "cannot connect to docker daemon: " + err.Error()
	}

	return hostID, dc, 0, ""
}

func mapRestartPolicy(policy string) container.RestartPolicyMode {
	switch policy {
	case "always":
		return container.RestartPolicyAlways
	case "on-failure":
		return container.RestartPolicyOnFailure
	case "unless-stopped":
		return container.RestartPolicyUnlessStopped
	default:
		return container.RestartPolicyDisabled
	}
}

func buildPortBindings(ports []portMapping) (nat.PortMap, nat.PortSet) {
	pm := make(nat.PortMap)
	ps := make(nat.PortSet)

	for _, p := range ports {
		proto := p.Protocol
		if proto == "" {
			proto = "tcp"
		}

		portKey := nat.Port(fmt.Sprintf("%d/%s", p.ContainerPort, proto))
		ps[portKey] = struct{}{}

		pm[portKey] = []nat.PortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: fmt.Sprintf("%d", p.HostPort),
			},
		}
	}

	return pm, ps
}