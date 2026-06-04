package ws

import (
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

var statsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type statsClient struct {
	conn        *websocket.Conn
	hostID      uuid.UUID
	containerID string
	send        chan []byte
}

type statsMessage struct {
	Type           string  `json:"type"`
	CPUPercent     float64 `json:"cpu_percent,omitempty"`
	MemoryUsage    uint64  `json:"memory_usage,omitempty"`
	MemoryLimit    uint64  `json:"memory_limit,omitempty"`
	MemoryPercent  float64 `json:"memory_percent,omitempty"`
	NetworkRxBytes uint64  `json:"network_rx_bytes,omitempty"`
	NetworkTxBytes uint64  `json:"network_tx_bytes,omitempty"`
	BlockRead      uint64  `json:"block_read,omitempty"`
	BlockWrite     uint64  `json:"block_write,omitempty"`
	Pids           uint64  `json:"pids,omitempty"`
	Timestamp      string  `json:"timestamp,omitempty"`
	Error          string  `json:"error,omitempty"`
}

func HandleStatsStream(repos *repository.Repositories, clients map[uuid.UUID]dockerclient.DockerProvider, jwtSecret []byte) http.HandlerFunc {
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

		conn, err := statsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws stats upgrade failed", "error", err)
			return
		}

		ctx, cancel := context.WithCancel(context.Background())

		sc := &statsClient{
			conn:        conn,
			hostID:      hostID,
			containerID: containerID,
			send:        make(chan []byte, 256),
		}

		go sc.writePump()
		go sc.readPump(cancel)
		go sc.streamStats(ctx, dc, cancel)
	}
}

func (sc *statsClient) streamStats(ctx context.Context, dc dockerclient.DockerProvider, cancel context.CancelFunc) {
	defer cancel()

	statsReader, err := dc.ContainerStats(ctx, sc.containerID, true)
	if err != nil {
		msg, _ := json.Marshal(statsMessage{Type: "error", Error: "failed to stream stats: " + err.Error()})
		sc.send <- msg
		return
	}
	defer statsReader.Body.Close()

	decoder := json.NewDecoder(statsReader.Body)

	var previousCPU uint64
	var previousSystem uint64
	first := true

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		var stats container.StatsResponse
		if err := decoder.Decode(&stats); err != nil {
			select {
			case <-ctx.Done():
				return
			default:
			}
			msg, _ := json.Marshal(statsMessage{Type: "error", Error: "stats decode error: " + err.Error()})
			select {
			case sc.send <- msg:
			default:
			}
			return
		}

		cpuPercent := 0.0
		if !first && stats.CPUStats.SystemUsage > 0 {
			cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - previousCPU)
			systemDelta := float64(stats.CPUStats.SystemUsage - previousSystem)
			numCpus := len(stats.CPUStats.CPUUsage.PercpuUsage)
			if numCpus == 0 {
				numCpus = int(stats.CPUStats.OnlineCPUs)
			}
			if numCpus > 0 && systemDelta > 0 {
				cpuPercent = (cpuDelta / systemDelta) * float64(numCpus) * 100.0
			}
		}

		previousCPU = stats.CPUStats.CPUUsage.TotalUsage
		previousSystem = stats.CPUStats.SystemUsage
		first = false

		memoryUsage := stats.MemoryStats.Usage
		memoryLimit := stats.MemoryStats.Limit
		memoryPercent := 0.0
		if memoryLimit > 0 {
			memoryPercent = (float64(memoryUsage) / float64(memoryLimit)) * 100.0
		}

		var networkRxBytes uint64
		var networkTxBytes uint64
		for _, ns := range stats.Networks {
			networkRxBytes += ns.RxBytes
			networkTxBytes += ns.TxBytes
		}

		var blockRead, blockWrite uint64
		for _, entry := range stats.BlkioStats.IoServiceBytesRecursive {
			if entry.Op == "read" {
				blockRead += entry.Value
			} else if entry.Op == "write" {
				blockWrite += entry.Value
			}
		}

		pids := stats.PidsStats.Current

		msg, _ := json.Marshal(statsMessage{
			Type:           "stats",
			CPUPercent:     cpuPercent,
			MemoryUsage:    memoryUsage,
			MemoryLimit:    memoryLimit,
			MemoryPercent:  memoryPercent,
			NetworkRxBytes: networkRxBytes,
			NetworkTxBytes: networkTxBytes,
			BlockRead:      blockRead,
			BlockWrite:     blockWrite,
			Pids:           pids,
			Timestamp:      stats.Read.Format(time.RFC3339Nano),
		})

		select {
		case sc.send <- msg:
		case <-ctx.Done():
			return
		}
	}
}

func (sc *statsClient) readPump(cancel context.CancelFunc) {
	defer cancel()

	sc.conn.SetReadLimit(512)
	sc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	sc.conn.SetPongHandler(func(string) error {
		sc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := sc.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (sc *statsClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		sc.conn.Close()
	}()

	for {
		select {
		case message, ok := <-sc.send:
			sc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				sc.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := sc.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			sc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := sc.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}