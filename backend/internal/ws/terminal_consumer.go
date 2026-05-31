package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

var termUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type termMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Rows uint   `json:"rows,omitempty"`
	Cols uint   `json:"cols,omitempty"`
}

func HandleExecStream(repos *repository.Repositories, clients map[uuid.UUID]*dockerclient.DockerClient, jwtSecret []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}

		claims, err := auth.ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		_, err = uuid.Parse(claims.UserID)
		if err != nil {
			http.Error(w, "invalid user id", http.StatusUnauthorized)
			return
		}

		hostID, err := uuid.Parse(chi.URLParam(r, "hostID"))
		if err != nil {
			http.Error(w, "invalid host id", http.StatusBadRequest)
			return
		}

		containerID := chi.URLParam(r, "containerID")
		if containerID == "" {
			http.Error(w, "missing container id", http.StatusBadRequest)
			return
		}

		_, err = repos.Hosts.FindByID(r.Context(), hostID)
		if err != nil {
			http.Error(w, "host not found", http.StatusNotFound)
			return
		}

		dc, err := getOrCreateDockerClient(r.Context(), repos, clients, hostID)
		if err != nil {
			http.Error(w, "cannot connect to docker daemon", http.StatusBadGateway)
			return
		}

		conn, err := termUpgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws terminal upgrade failed", "error", err)
			return
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		createResp, err := dc.ExecCreate(ctx, containerID, container.ExecOptions{
			AttachStdin:  true,
			AttachStdout: true,
			AttachStderr: true,
			Tty:          true,
			Cmd:          []string{"/bin/sh"},
		})
		if err != nil {
			createResp, err = dc.ExecCreate(ctx, containerID, container.ExecOptions{
				AttachStdin:  true,
				AttachStdout: true,
				AttachStderr: true,
				Tty:          true,
				Cmd:          []string{"/bin/bash"},
			})
			if err != nil {
				errMsg, _ := json.Marshal(termMessage{Type: "error", Data: "failed to create exec: " + err.Error()})
				conn.WriteMessage(websocket.TextMessage, errMsg)
				conn.Close()
				return
			}
		}

		hijackResp, err := dc.ExecAttach(ctx, createResp.ID, container.ExecAttachOptions{
			Tty: true,
		})
		if err != nil {
			errMsg, _ := json.Marshal(termMessage{Type: "error", Data: "failed to attach exec: " + err.Error()})
			conn.WriteMessage(websocket.TextMessage, errMsg)
			conn.Close()
			return
		}
		defer hijackResp.Close()

		execID := createResp.ID

		conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"connected"}`))

		var once sync.Once
		cleanup := func() {
			once.Do(func() {
				cancel()
				hijackResp.Close()
				conn.Close()
			})
		}

		go func() {
			defer cleanup()
			buf := make([]byte, 4096)
			for {
				select {
				case <-ctx.Done():
					return
				default:
				}

				n, err := hijackResp.Reader.Read(buf)
				if err != nil {
					msg, _ := json.Marshal(termMessage{Type: "error", Data: "connection closed"})
					conn.WriteMessage(websocket.TextMessage, msg)
					return
				}
				if n > 0 {
					msg, _ := json.Marshal(termMessage{Type: "output", Data: string(buf[:n])})
					if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
						return
					}
				}
			}
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				return
			}

			var msg termMessage
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case "input":
				if _, err := hijackResp.Conn.Write([]byte(msg.Data)); err != nil {
					return
				}
			case "resize":
				if msg.Rows > 0 && msg.Cols > 0 {
					resizeCtx, resizeCancel := context.WithTimeout(context.Background(), 5*time.Second)
					_ = dc.ExecResize(resizeCtx, execID, container.ResizeOptions{
						Height: msg.Rows,
						Width:  msg.Cols,
					})
					resizeCancel()
				}
			}
		}
	}
}