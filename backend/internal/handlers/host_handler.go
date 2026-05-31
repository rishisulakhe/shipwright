package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/middleware"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type HostHandler struct {
	Repos      *repository.Repositories
	JWTSecret  []byte
	clients    map[uuid.UUID]*dockerclient.DockerClient
}

func NewHostHandler(repos *repository.Repositories, jwtSecret []byte) *HostHandler {
	return &HostHandler{
		Repos:     repos,
		JWTSecret: jwtSecret,
		clients:   make(map[uuid.UUID]*dockerclient.DockerClient),
	}
}

func (h *HostHandler) GetClients() map[uuid.UUID]*dockerclient.DockerClient {
	return h.clients
}

type createHostRequest struct {
	Name     string `json:"name"`
	HostIP   string `json:"host_ip"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	AuthType string `json:"auth_type"`
	TLSCA    string `json:"tls_ca,omitempty"`
	TLSCert  string `json:"tls_cert,omitempty"`
	TLSKey   string `json:"tls_key,omitempty"`
	SSHUser  string `json:"ssh_user,omitempty"`
	SSHKey   string `json:"ssh_key,omitempty"`
}

type hostStats struct {
	Containers int `json:"containers"`
	Images     int `json:"images"`
	Networks  int `json:"networks"`
	Volumes    int `json:"volumes"`
}

type hostDetailResponse struct {
	models.DockerHost
	Stats hostStats `json:"stats"`
}

type testConnectionResponse struct {
	Connected bool   `json:"connected"`
	Error     string `json:"error,omitempty"`
}

func (h *HostHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createHostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		JSONError(w, http.StatusBadRequest, "name is required")
		return
	}

	if req.Protocol != "unix" && req.HostIP == "" {
		JSONError(w, http.StatusBadRequest, "host_ip is required for non-unix protocols")
		return
	}

	if req.Port == 0 {
		req.Port = 2375
	}

	if req.Protocol == "" {
		req.Protocol = "tcp"
	}

	if req.AuthType == "" {
		req.AuthType = "none"
	}

	if req.Protocol == "unix" {
		req.HostIP = ""
		req.Port = 0
	}

	userID, err := uuid.Parse(middleware.GetUserID(r.Context()))
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid user id in token")
		return
	}

	dc, err := dockerclient.NewClient(req.HostIP, req.Port, req.Protocol)
	if err != nil {
		JSONError(w, http.StatusBadRequest, "cannot create docker client: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := dc.Ping(ctx); err != nil {
		dc.Close()
		JSONError(w, http.StatusBadRequest, "cannot connect to docker daemon: "+err.Error())
		return
	}

	toNullString := func(s string) models.NullString {
		return models.NullString{sql.NullString{String: s, Valid: s != ""}}
	}

	host := &models.DockerHost{
		OwnerID:  userID,
		Name:     req.Name,
		HostIP:   req.HostIP,
		Port:     req.Port,
		Protocol: req.Protocol,
		AuthType: req.AuthType,
		TLSCA:    toNullString(req.TLSCA),
		TLSCert:  toNullString(req.TLSCert),
		TLSKey:   toNullString(req.TLSKey),
		SSHUser:  toNullString(req.SSHUser),
		SSHKey:   toNullString(req.SSHKey),
		IsActive: true,
	}

	if err := h.Repos.Hosts.Create(r.Context(), host); err != nil {
		dc.Close()
		slog.Error("failed to create host", "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to create host")
		return
	}

	h.clients[host.ID] = dc

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(host)
}

func (h *HostHandler) List(w http.ResponseWriter, r *http.Request) {
	role := middleware.GetRole(r.Context())
	userID, err := uuid.Parse(middleware.GetUserID(r.Context()))
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid user id")
		return
	}

	var hosts []models.DockerHost
	if role == "admin" {
		hosts, err = h.Repos.Hosts.ListAll(r.Context())
	} else {
		hosts, err = h.Repos.Hosts.FindByOwner(r.Context(), userID)
	}

	if err != nil {
		slog.Error("failed to list hosts", "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to list hosts")
		return
	}

	if hosts == nil {
		hosts = []models.DockerHost{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hosts)
}

func (h *HostHandler) Get(w http.ResponseWriter, r *http.Request) {
	hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
	if err != nil {
		JSONError(w, http.StatusBadRequest, "invalid host id")
		return
	}

	host, err := h.Repos.Hosts.FindByID(r.Context(), hostID)
	if err != nil {
		JSONError(w, http.StatusNotFound, "host not found")
		return
	}

	stats := h.fetchStats(r.Context(), hostID, host)

	resp := hostDetailResponse{
		DockerHost: *host,
		Stats:      stats,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *HostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
	if err != nil {
		JSONError(w, http.StatusBadRequest, "invalid host id")
		return
	}

	host, err := h.Repos.Hosts.FindByID(r.Context(), hostID)
	if err != nil {
		JSONError(w, http.StatusNotFound, "host not found")
		return
	}

	userID, err := uuid.Parse(middleware.GetUserID(r.Context()))
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid user id")
		return
	}

	role := middleware.GetRole(r.Context())
	if role != "admin" && host.OwnerID != userID {
		JSONError(w, http.StatusForbidden, "you do not own this host")
		return
	}

	if err := h.Repos.Hosts.Delete(r.Context(), hostID); err != nil {
		slog.Error("failed to delete host", "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to delete host")
		return
	}

	if dc, ok := h.clients[hostID]; ok {
		dc.Close()
		delete(h.clients, hostID)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HostHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
	if err != nil {
		JSONError(w, http.StatusBadRequest, "invalid host id")
		return
	}

	host, err := h.Repos.Hosts.FindByID(r.Context(), hostID)
	if err != nil {
		JSONError(w, http.StatusNotFound, "host not found")
		return
	}

	dc, err := dockerclient.NewClient(host.HostIP, host.Port, host.Protocol)
	if err != nil {
		h.Repos.Hosts.UpdateStatus(r.Context(), hostID, false)
		JSONError(w, http.StatusOK, err.Error())
		resp := testConnectionResponse{Connected: false, Error: err.Error()}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}
	defer dc.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := dc.Ping(ctx); err != nil {
		h.Repos.Hosts.UpdateStatus(r.Context(), hostID, false)
		resp := testConnectionResponse{Connected: false, Error: err.Error()}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	h.Repos.Hosts.UpdateStatus(r.Context(), hostID, true)
	h.clients[hostID] = dc

	resp := testConnectionResponse{Connected: true}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *HostHandler) fetchStats(ctx context.Context, hostID uuid.UUID, host *models.DockerHost) hostStats {
	dc, ok := h.clients[hostID]
	if !ok {
		var err error
		dc, err = dockerclient.NewClient(host.HostIP, host.Port, host.Protocol)
		if err != nil {
			return hostStats{}
		}
		defer dc.Close()
	}

	statsCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	containers, _ := dc.ListContainers(statsCtx, true)
	images, _ := dc.ListImages(statsCtx, false)
	networks, _ := dc.ListNetworks(statsCtx)
	vols, volsErr := dc.ListVolumes(statsCtx)

	s := hostStats{}
	if containers != nil {
		s.Containers = len(containers)
	}
	if images != nil {
		s.Images = len(images)
	}
	if networks != nil {
		s.Networks = len(networks)
	}
	if volsErr == nil {
		s.Volumes = len(vols.Volumes)
	}
	return s
}