import { useState, useEffect, useCallback, useRef } from 'react';
import LiveChart from './LiveChart';
import { getAccessToken } from '../utils/auth';

interface StatsPanelProps {
  hostID: string;
  containerID: string;
}

interface StatsData {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
}

const MAX_POINTS = 60;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return current - previous;
}

export default function StatsPanel({ hostID, containerID }: StatsPanelProps) {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);

  const cpuDataRef = useRef<number[]>([]);
  const memDataRef = useRef<number[]>([]);
  const memLimitDataRef = useRef<number[]>([]);
  const netRxDataRef = useRef<number[]>([]);
  const netTxDataRef = useRef<number[]>([]);
  const labelsRef = useRef<string[]>([]);

  const prevRxRef = useRef(0);
  const prevTxRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = getAccessToken();
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/hosts/${hostID}/containers/${containerID}/stats?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'stats') {
          const currentStats: StatsData = {
            cpuPercent: msg.cpu_percent ?? 0,
            memoryUsage: msg.memory_usage ?? 0,
            memoryLimit: msg.memory_limit ?? 0,
            memoryPercent: msg.memory_percent ?? 0,
            networkRxBytes: msg.network_rx_bytes ?? 0,
            networkTxBytes: msg.network_tx_bytes ?? 0,
            blockRead: msg.block_read ?? 0,
            blockWrite: msg.block_write ?? 0,
            pids: msg.pids ?? 0,
          };

          setStats(currentStats);

          const now = new Date();
          const label = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          cpuDataRef.current = [...cpuDataRef.current, currentStats.cpuPercent].slice(-MAX_POINTS);
          memDataRef.current = [...memDataRef.current, currentStats.memoryUsage / (1024 * 1024)].slice(-MAX_POINTS);
          memLimitDataRef.current = [...memLimitDataRef.current, currentStats.memoryLimit / (1024 * 1024)].slice(-MAX_POINTS);

          const rxRate = formatRate(currentStats.networkRxBytes, prevRxRef.current);
          const txRate = formatRate(currentStats.networkTxBytes, prevTxRef.current);
          prevRxRef.current = currentStats.networkRxBytes;
          prevTxRef.current = currentStats.networkTxBytes;

          netRxDataRef.current = [...netRxDataRef.current, rxRate / 1024].slice(-MAX_POINTS);
          netTxDataRef.current = [...netTxDataRef.current, txRate / 1024].slice(-MAX_POINTS);

          labelsRef.current = [...labelsRef.current, label].slice(-MAX_POINTS);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current += 1;
      if (reconnectRef.current <= 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 30000);
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [hostID, containerID]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const memLabels = labelsRef.current.length > 0 ? labelsRef.current : Array(MAX_POINTS).fill('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Resource Usage</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        {!connected && reconnectRef.current > 5 && (
          <button
            onClick={() => {
              reconnectRef.current = 0;
              connect();
            }}
            className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-white hover:bg-zinc-600"
          >
            Reconnect
          </button>
        )}
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">CPU</div>
            <div className="text-xl font-bold text-white">{stats.cpuPercent.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">Memory</div>
            <div className="text-xl font-bold text-white">
              {formatBytes(stats.memoryUsage)}{' '}
              <span className="text-sm text-zinc-500">/ {formatBytes(stats.memoryLimit)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">Network I/O</div>
            <div className="text-xl font-bold text-white">
              <span className="text-green-400">↓{formatBytes(stats.networkRxBytes)}</span>{' '}
              <span className="text-blue-400">↑{formatBytes(stats.networkTxBytes)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">PIDs</div>
            <div className="text-xl font-bold text-white">{stats.pids}</div>
          </div>
        </div>
      )}

      <LiveChart
        title="CPU Usage"
        labels={memLabels}
        datasets={[
          {
            label: 'CPU %',
            data: cpuDataRef.current,
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b20',
            fill: true,
          },
        ]}
        yLabel="%"
        min={0}
        max={100}
        currentValues={
          stats
            ? [{ label: 'CPU', value: `${stats.cpuPercent.toFixed(1)}%`, color: '#f59e0b' }]
            : undefined
        }
      />

      <LiveChart
        title="Memory Usage"
        labels={memLabels}
        datasets={[
          {
            label: 'Used',
            data: memDataRef.current,
            borderColor: '#8b5cf6',
            backgroundColor: '#8b5cf620',
            fill: true,
          },
          {
            label: 'Limit',
            data: memLimitDataRef.current,
            borderColor: '#ef4444',
            borderDash: [5, 5],
            backgroundColor: 'transparent',
          },
        ]}
        yLabel="MB"
        min={0}
        currentValues={
          stats
            ? [
                { label: 'Used', value: formatBytes(stats.memoryUsage), color: '#8b5cf6' },
                { label: 'Limit', value: formatBytes(stats.memoryLimit), color: '#ef4444' },
              ]
            : undefined
        }
      />

      <LiveChart
        title="Network I/O (KB/s)"
        labels={memLabels}
        datasets={[
          {
            label: 'RX',
            data: netRxDataRef.current,
            borderColor: '#22c55e',
            backgroundColor: '#22c55e20',
            fill: true,
          },
          {
            label: 'TX',
            data: netTxDataRef.current,
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f620',
            fill: true,
          },
        ]}
        yLabel="KB/s"
        min={0}
        currentValues={
          stats
            ? [
                { label: 'RX', value: formatBytes(stats.networkRxBytes), color: '#22c55e' },
                { label: 'TX', value: formatBytes(stats.networkTxBytes), color: '#3b82f6' },
              ]
            : undefined
        }
      />

      {stats && (stats.blockRead > 0 || stats.blockWrite > 0) && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Block I/O</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-zinc-500">Read: </span>
              <span className="text-white">{formatBytes(stats.blockRead)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Write: </span>
              <span className="text-white">{formatBytes(stats.blockWrite)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}