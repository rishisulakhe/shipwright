package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/docker/docker/api/types/network"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type NetworkHandler struct {
	Repos   *repository.Repositories
	clients map[uuid.UUID]*dockerclient.DockerClient
}

func NewNetworkHandler(repos *repository.Repositories, clients map[uuid.UUID]*dockerclient.DockerClient) *NetworkHandler {
	return &NetworkHandler{
		Repos:   repos,
		clients: clients,
	}
}

func (h *NetworkHandler) getOrCreateClient(ctx context.Context, hostID uuid.UUID) (*dockerclient.DockerClient, error) {
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

type createNetworkRequest struct {
	Name        string `json:"name"`
	Driver      string `json:"driver"`
	Subnet      string `json:"subnet,omitempty"`
	Gateway     string `json:"gateway,omitempty"`
	Internal    bool   `json:"internal"`
	Attachable  bool   `json:"attachable"`
}

func (h *NetworkHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createNetworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		JSONError(w, http.StatusBadRequest, "name is required")
		return
	}

	if req.Driver == "" {
		req.Driver = "bridge"
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	createOpts := network.CreateOptions{
		Driver:     req.Driver,
		Internal:   req.Internal,
		Attachable: req.Attachable,
	}

	if req.Subnet != "" || req.Gateway != "" {
		ipamCfg := network.IPAMConfig{}
		if req.Subnet != "" {
			ipamCfg.Subnet = req.Subnet
		}
		if req.Gateway != "" {
			ipamCfg.Gateway = req.Gateway
		}
		createOpts.IPAM = &network.IPAM{
			Config: []network.IPAMConfig{ipamCfg},
		}
	}

	resp, err := dc.CreateNetwork(r.Context(), req.Name, createOpts)
	if err != nil {
		slog.Error("failed to create network", "name", req.Name, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to create network: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        resp.ID,
		"name":      req.Name,
		"driver":    req.Driver,
		"internal":  req.Internal,
		"scope":     "local",
		"warning":   resp.Warning,
	})
}

func (h *NetworkHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

	networkID := chi.URLParam(r, "networkID")

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	if err := dc.RemoveNetwork(r.Context(), networkID); err != nil {
		slog.Error("failed to remove network", "networkID", networkID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to remove network: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type connectRequest struct {
	ContainerID string `json:"container_id"`
}

func (h *NetworkHandler) Connect(w http.ResponseWriter, r *http.Request) {
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

	networkID := chi.URLParam(r, "networkID")

	var req connectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ContainerID == "" {
		JSONError(w, http.StatusBadRequest, "container_id is required")
		return
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	if err := dc.ConnectNetwork(r.Context(), networkID, req.ContainerID, nil); err != nil {
		slog.Error("failed to connect container to network", "networkID", networkID, "containerID", req.ContainerID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to connect container to network: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "connected"})
}

func (h *NetworkHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
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

	networkID := chi.URLParam(r, "networkID")

	var req connectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ContainerID == "" {
		JSONError(w, http.StatusBadRequest, "container_id is required")
		return
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	force := r.URL.Query().Get("force") == "true"

	if err := dc.DisconnectNetwork(r.Context(), networkID, req.ContainerID, force); err != nil {
		slog.Error("failed to disconnect container from network", "networkID", networkID, "containerID", req.ContainerID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to disconnect container from network: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "disconnected"})
}

func (h *NetworkHandler) Inspect(w http.ResponseWriter, r *http.Request) {
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

	networkID := chi.URLParam(r, "networkID")

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	inspectData, err := dc.InspectNetwork(r.Context(), networkID)
	if err != nil {
		slog.Error("failed to inspect network", "networkID", networkID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to inspect network: "+err.Error())
		return
	}

	type containerEndpoint struct {
		ContainerID  string `json:"container_id"`
		ContainerName string `json:"container_name"`
		IPv4Address  string `json:"ipv4_address"`
		IPv6Address  string `json:"ipv6_address,omitempty"`
	}

	endpoints := make([]containerEndpoint, 0)
	for containerID, endpoint := range inspectData.Containers {
		name := ""
		if endpoint.Name != "" {
			name = endpoint.Name
		}
		endpoints = append(endpoints, containerEndpoint{
			ContainerID:    containerID,
			ContainerName:  name,
			IPv4Address:   endpoint.IPv4Address,
			IPv6Address:   endpoint.IPv6Address,
		})
	}

	resp := map[string]interface{}{
		"id":          inspectData.ID,
		"name":        inspectData.Name,
		"driver":      inspectData.Driver,
		"scope":       inspectData.Scope,
		"internal":    inspectData.Internal,
		"attachable":  inspectData.Attachable,
		"containers":  endpoints,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}