package ws

import (
	"bufio"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/pkg/dockerclient"
)

var logUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type logClient struct {
	conn       *websocket.Conn
	hostID     uuid.UUID
	containerID string
	dockerCtx  context.CancelFunc
	send       chan []byte
}

type logMessage struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Time    string `json:"time,omitempty"`
}

type controlMessage struct {
	Action string `json:"action"`
	Tail   string `json:"tail,omitempty"`
}

func HandleLogStream(repos *repository.Repositories, clients map[uuid.UUID]dockerclient.DockerProvider, jwtSecret []byte) http.HandlerFunc {
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

		conn, err := logUpgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws log upgrade failed", "error", err)
			return
		}

		tailStr := r.URL.Query().Get("tail")
		if tailStr == "" {
			tailStr = "100"
		}
		tail := tailStr

		ctx, cancel := context.WithCancel(context.Background())

		lc := &logClient{
			conn:         conn,
			hostID:       hostID,
			containerID: containerID,
			dockerCtx:   cancel,
			send:         make(chan []byte, 256),
		}

		go lc.writePump()
		go lc.readPump(dc, repos, clients, tail)

		go lc.streamLogs(ctx, dc, tail)
	}
}

func (lc *logClient) streamLogs(ctx context.Context, dc dockerclient.DockerProvider, tail string) {
	opts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       tail,
		Timestamps: true,
	}

	reader, err := dc.ContainerLogs(ctx, lc.containerID, opts)
	if err != nil {
		msg, _ := json.Marshal(logMessage{Type: "error", Content: "failed to stream logs: " + err.Error()})
		lc.send <- msg
		return
	}
	defer reader.Close()

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()
		if len(line) > 8 && (line[0] == 0 || line[0] == 1 || line[0] == 2) {
			line = line[8:]
		}

		msg, _ := json.Marshal(logMessage{Type: "log", Content: line})
		select {
		case lc.send <- msg:
		case <-ctx.Done():
			return
		}
	}

	if err := scanner.Err(); err != nil && ctx.Err() == nil {
		msg, _ := json.Marshal(logMessage{Type: "error", Content: "log stream error: " + err.Error()})
		lc.send <- msg
	}

	msg, _ := json.Marshal(logMessage{Type: "done", Content: "log stream ended"})
	lc.send <- msg
}

func (lc *logClient) readPump(dc dockerclient.DockerProvider, repos *repository.Repositories, clients map[uuid.UUID]dockerclient.DockerProvider, initialTail string) {
	defer func() {
		lc.dockerCtx()
		lc.conn.Close()
	}()

	lc.conn.SetReadLimit(512)
	lc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	lc.conn.SetPongHandler(func(string) error {
		lc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := lc.conn.ReadMessage()
		if err != nil {
			break
		}

		var ctrl controlMessage
		if err := json.Unmarshal(message, &ctrl); err != nil {
			continue
		}

		switch ctrl.Action {
		case "stop":
			lc.dockerCtx()
			msg, _ := json.Marshal(logMessage{Type: "status", Content: "streaming paused"})
			lc.send <- msg

		case "resume":
			lc.dockerCtx()
			ctx, cancel := context.WithCancel(context.Background())
			lc.dockerCtx = cancel
			tail := ctrl.Tail
			if tail == "" {
				tail = initialTail
			}
			go lc.streamLogs(ctx, dc, tail)
			msg, _ := json.Marshal(logMessage{Type: "status", Content: "streaming resumed"})
			lc.send <- msg

		case "tail":
			lc.dockerCtx()
			ctx, cancel := context.WithCancel(context.Background())
			lc.dockerCtx = cancel
			tail := ctrl.Tail
			if tail == "" {
				tail = "100"
			}
			go lc.streamLogs(ctx, dc, tail)
		}
	}
}

func (lc *logClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		lc.conn.Close()
	}()

	for {
		select {
		case message, ok := <-lc.send:
			lc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				lc.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := lc.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			lc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := lc.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func getOrCreateDockerClient(ctx context.Context, repos *repository.Repositories, clients map[uuid.UUID]dockerclient.DockerProvider, hostID uuid.UUID) (dockerclient.DockerProvider, error) {
	if dc, ok := clients[hostID]; ok {
		return dc, nil
	}

	host, err := repos.Hosts.FindByID(ctx, hostID)
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

	clients[hostID] = dc
	return dc, nil
}