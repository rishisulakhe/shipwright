package ws

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func HandleWebSocket(hub *Hub, jwtSecret []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			slog.Warn("ws connection rejected: missing token")
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}

		claims, err := auth.ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			slog.Warn("ws connection rejected: invalid token", "error", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			slog.Warn("ws connection rejected: invalid user id", "error", err)
			http.Error(w, "invalid user id", http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws upgrade failed", "error", err)
			return
		}

		client := &Client{
			hub:      hub,
			conn:     conn,
			send:     make(chan []byte, 256),
			UserID:   userID,
			Username: claims.Username,
			Role:     claims.Role,
		}

		hub.Register(client)

		go client.WritePump()
		go client.ReadPump()
	}
}