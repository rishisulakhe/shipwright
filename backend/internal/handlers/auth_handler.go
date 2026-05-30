package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/rishisulakhe/shipwright/backend/internal/auth"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
)

type AuthHandler struct {
	Repos     *repository.Repositories
	JWTSecret []byte
}

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type tokenResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         userResponse `json:"user"`
}

type userResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
var validRoles = map[string]bool{"admin": true, "developer": true, "viewer": true}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" || req.Role == "" {
		JSONError(w, http.StatusBadRequest, "all fields are required")
		return
	}

	if !validRoles[req.Role] {
		JSONError(w, http.StatusBadRequest, "role must be one of: admin, developer, viewer")
		return
	}

	if !emailRegex.MatchString(req.Email) {
		JSONError(w, http.StatusBadRequest, "invalid email format")
		return
	}

	if len(req.Password) < 8 {
		JSONError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return

	}

	if _, err := h.Repos.Users.FindByUsername(r.Context(), req.Username); err == nil {
		JSONError(w, http.StatusConflict, "username already taken")
		return
	}

	if _, err := h.Repos.Users.FindByEmail(r.Context(), req.Email); err == nil {
		JSONError(w, http.StatusConflict, "email already registered")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		slog.Error("failed to hash password", "error", err)
		JSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user := &models.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         req.Role,
	}

	if err := h.Repos.Users.Create(r.Context(), user); err != nil {
		slog.Error("failed to create user", "error", err)
		JSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(userResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		JSONError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	user, err := h.Repos.Users.FindByUsername(r.Context(), req.Username)
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := auth.CheckPassword(user.PasswordHash, req.Password); err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	accessToken, err := auth.GenerateAccessToken(user.ID.String(), user.Username, user.Role, h.JWTSecret)
	if err != nil {
		slog.Error("failed to generate access token", "error", err)
		JSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(user.ID.String(), h.JWTSecret)
	if err != nil {
		slog.Error("failed to generate refresh token", "error", err)
		JSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: userResponse{
			ID:       user.ID.String(),
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
		},
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		JSONError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	userID, err := auth.ValidateRefreshToken(req.RefreshToken, h.JWTSecret)
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	user, err := h.Repos.Users.FindByID(r.Context(), parseUUID(userID))
	if err != nil {
		JSONError(w, http.StatusUnauthorized, "user not found")
		return
	}

	accessToken, err := auth.GenerateAccessToken(user.ID.String(), user.Username, user.Role, h.JWTSecret)
	if err != nil {
		slog.Error("failed to generate access token", "error", err)
		JSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(user.ID.String(), h.JWTSecret)
	if err != nil {
		slog.Error("failed to generate refresh token", "error", err)
		JSONError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: userResponse{
			ID:       user.ID.String(),
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
		},
	})
}