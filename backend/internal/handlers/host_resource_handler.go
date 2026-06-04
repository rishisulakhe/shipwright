package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type containerResponse struct {
	ID        string        `json:"id"`
	Names     []string      `json:"names"`
	Image     string        `json:"image"`
	State     string        `json:"state"`
	Status    string        `json:"status"`
	Ports     []portResponse `json:"ports"`
	Created   int64         `json:"created"`
}

type portResponse struct {
	HostPort      int    `json:"host_port"`
	ContainerPort int    `json:"container_port"`
	Protocol      string `json:"protocol"`
	HostIP        string `json:"host_ip"`
}

type networkResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Driver    string `json:"driver"`
	Scope     string `json:"scope"`
	Internal  bool   `json:"internal"`
}

type volumeResponse struct {
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Mountpoint string `json:"mountpoint"`
	CreatedAt  string `json:"created_at"`
}

type imageResponse struct {
	ID       string   `json:"id"`
	RepoTags []string `json:"repo_tags"`
	Size     int64    `json:"size"`
	Created  int64    `json:"created"`
}

func (h *HostHandler) getOrCreateClient(ctx context.Context, hostID uuid.UUID) (dockerclient.DockerProvider, error) {
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

func (h *HostHandler) ListContainers(w http.ResponseWriter, r *http.Request) {
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

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	all := r.URL.Query().Get("all") == "true"
	containers, err := dc.ListContainers(r.Context(), all)
	if err != nil {
		slog.Error("failed to list containers", "hostID", hostID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to list containers")
		return
	}

	resp := make([]containerResponse, 0, len(containers))
	for _, c := range containers {
		ports := make([]portResponse, 0, len(c.Ports))
		for _, p := range c.Ports {
			ports = append(ports, portResponse{
				HostPort:      int(p.PublicPort),
				ContainerPort: int(p.PrivatePort),
				Protocol:      p.Type,
				HostIP:        p.IP,
			})
		}
		resp = append(resp, containerResponse{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Ports:   ports,
			Created: c.Created,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *HostHandler) ListNetworks(w http.ResponseWriter, r *http.Request) {
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

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	networks, err := dc.ListNetworks(r.Context())
	if err != nil {
		slog.Error("failed to list networks", "hostID", hostID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to list networks")
		return
	}

	resp := make([]networkResponse, 0, len(networks))
	for _, n := range networks {
		resp = append(resp, networkResponse{
			ID:       n.ID,
			Name:     n.Name,
			Driver:   n.Driver,
			Scope:    n.Scope,
			Internal: n.Internal,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *HostHandler) ListVolumes(w http.ResponseWriter, r *http.Request) {
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

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	volResp, err := dc.ListVolumes(r.Context())
	if err != nil {
		slog.Error("failed to list volumes", "hostID", hostID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to list volumes")
		return
	}

	resp := make([]volumeResponse, 0, len(volResp.Volumes))
	for _, v := range volResp.Volumes {
		resp = append(resp, volumeResponse{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			CreatedAt:  v.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *HostHandler) ListImages(w http.ResponseWriter, r *http.Request) {
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

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	all := r.URL.Query().Get("all") == "true"
	showDangling := r.URL.Query().Get("dangling") == "true"
	images, err := dc.ListImages(r.Context(), all)
	if err != nil {
		slog.Error("failed to list images", "hostID", hostID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to list images")
		return
	}

	resp := make([]imageResponse, 0, len(images))
	for _, img := range images {
		repoTags := img.RepoTags
		if repoTags == nil || len(repoTags) == 0 {
			repoTags = []string{"<none>:<none>"}
		}
		if !showDangling {
			allDangling := true
			for _, tag := range repoTags {
				if tag != "<none>" && tag != "<none>:<none>" {
					allDangling = false
					break
				}
			}
			if allDangling {
				continue
			}
		}
		resp = append(resp, imageResponse{
			ID:       img.ID,
			RepoTags: repoTags,
			Size:     img.Size,
			Created:  img.Created,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}