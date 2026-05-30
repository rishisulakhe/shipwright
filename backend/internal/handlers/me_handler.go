package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/rishisulakhe/shipwright/backend/internal/middleware"
)

type MeHandler struct{}

func (h *MeHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		JSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"user_id":   claims.UserID,
		"username":  claims.Username,
		"role":      claims.Role,
	})
}