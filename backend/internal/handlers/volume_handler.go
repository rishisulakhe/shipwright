package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/docker/docker/api/types/volume"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type VolumeHandler struct {
	Repos   *repository.Repositories
	clients map[uuid.UUID]*dockerclient.DockerClient
}

func NewVolumeHandler(repos *repository.Repositories, clients map[uuid.UUID]*dockerclient.DockerClient) *VolumeHandler {
	return &VolumeHandler{
		Repos:   repos,
		clients: clients,
	}
}

func (h *VolumeHandler) getOrCreateClient(ctx context.Context, hostID uuid.UUID) (*dockerclient.DockerClient, error) {
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

type createVolumeRequest struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	DriverOpts map[string]string `json:"driver_opts,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
}

func (h *VolumeHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createVolumeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		JSONError(w, http.StatusBadRequest, "name is required")
		return
	}

	if req.Driver == "" {
		req.Driver = "local"
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	vol, err := dc.CreateVolume(r.Context(), req.toDockerCreateOptions())
	if err != nil {
		slog.Error("failed to create volume", "name", req.Name, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to create volume: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"name":       vol.Name,
		"driver":     vol.Driver,
		"mountpoint": vol.Mountpoint,
		"created_at": vol.CreatedAt,
	})
}

func (req *createVolumeRequest) toDockerCreateOptions() volume.CreateOptions {
	return volume.CreateOptions{
		Name:       req.Name,
		Driver:     req.Driver,
		DriverOpts: req.DriverOpts,
		Labels:     req.Labels,
	}
}

func (h *VolumeHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

	volumeName := chi.URLParam(r, "volumeName")

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	force := r.URL.Query().Get("force") == "true"

	if err := dc.RemoveVolume(r.Context(), volumeName, force); err != nil {
		slog.Error("failed to remove volume", "volumeName", volumeName, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to remove volume: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}