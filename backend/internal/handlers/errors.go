package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
)

type errorResponse struct {
	Error string `json:"error"`
}

func JSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(errorResponse{Error: message})
}

func JSONNotFound(w http.ResponseWriter, resource string) {
	JSONError(w, http.StatusNotFound, resource+" not found")
}

func JSONForbidden(w http.ResponseWriter, message string) {
	JSONError(w, http.StatusForbidden, message)
}

func parseUUID(s string) uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil
	}
	return id
}