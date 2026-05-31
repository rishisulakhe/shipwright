package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/api/types/image"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

type ImageHandler struct {
	Repos   *repository.Repositories
	clients map[uuid.UUID]*dockerclient.DockerClient
}

func NewImageHandler(repos *repository.Repositories, clients map[uuid.UUID]*dockerclient.DockerClient) *ImageHandler {
	return &ImageHandler{
		Repos:   repos,
		clients: clients,
	}
}

func (h *ImageHandler) getOrCreateClient(ctx context.Context, hostID uuid.UUID) (*dockerclient.DockerClient, error) {
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

type pullImageRequest struct {
	ImageRef    string `json:"image"`
	Username    string `json:"username,omitempty"`
	Password    string `json:"password,omitempty"`
	ServerAddr  string `json:"server_address,omitempty"`
}

func (h *ImageHandler) Pull(w http.ResponseWriter, r *http.Request) {
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

	var req pullImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ImageRef == "" {
		JSONError(w, http.StatusBadRequest, "image is required")
		return
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	pullOpts := image.PullOptions{}

	if req.Username != "" || req.Password != "" {
		authBytes, _ := json.Marshal(map[string]string{
			"username":      req.Username,
			"password":      req.Password,
			"serveraddress": req.ServerAddr,
		})
		pullOpts.RegistryAuth = base64.URLEncoding.EncodeToString(authBytes)
	}

	pullCtx, pullCancel := context.WithTimeout(r.Context(), 300*time.Second)
	defer pullCancel()

	reader, err := dc.PullImage(pullCtx, req.ImageRef, pullOpts)
	if err != nil {
		slog.Error("failed to pull image", "image", req.ImageRef, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to pull image: "+err.Error())
		return
	}
	io.ReadAll(reader)
	reader.Close()

	images, err := dc.ListImages(r.Context(), false)
	if err != nil {
		slog.Warn("failed to list images after pull", "error", err)
	}

	var pulledImage *imageResponse
	for _, img := range images {
		for _, tag := range img.RepoTags {
			if tag == req.ImageRef || strings.HasPrefix(img.ID, req.ImageRef) {
				repoTags := img.RepoTags
				if repoTags == nil {
					repoTags = []string{"<none>"}
				}
				pulledImage = &imageResponse{
					ID:       img.ID,
					RepoTags: repoTags,
					Size:     img.Size,
					Created:  img.Created,
				}
				break
			}
		}
		if pulledImage != nil {
			break
		}
	}

	if pulledImage == nil {
		_ = images
		pulledImage = &imageResponse{
			ID:       "",
			RepoTags: []string{req.ImageRef},
			Size:     0,
			Created:  time.Now().Unix(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(pulledImage)
}

func (h *ImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

	imageID := chi.URLParam(r, "imageID")
	if imageID == "" {
		JSONError(w, http.StatusBadRequest, "image id is required")
		return
	}

	if strings.HasPrefix(imageID, "sha256:") {
		imageID = strings.TrimPrefix(imageID, "sha256:")
	}

	dc, err := h.getOrCreateClient(r.Context(), hostID)
	if err != nil {
		slog.Error("failed to get docker client", "hostID", hostID, "error", err)
		JSONError(w, http.StatusBadGateway, "cannot connect to docker daemon: "+err.Error())
		return
	}

	force := r.URL.Query().Get("force") == "true"

	_, err = dc.RemoveImage(r.Context(), imageID, image.RemoveOptions{Force: force})
	if err != nil {
		slog.Error("failed to remove image", "imageID", imageID, "error", err)
		JSONError(w, http.StatusInternalServerError, "failed to remove image: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}