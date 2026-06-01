import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { getAccessToken } from '../utils/auth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatUnixTime } from '../utils/formatters';
import StatsPanel from '../components/StatsPanel';
import Terminal from '../components/Terminal';
import ContainerActions from '../components/ContainerActions';
import InfoTable from '../components/InfoTable';
import {
  ArrowLeft,
  Box,
  Network,
  HardDrive,
  Download,
  Search,
  PauseCircle,
  PlayCircle,
  Activity,
  FileText,
  Info,
  Terminal as TerminalIcon,
  AlertCircle,
  Loader2,
  Plug,
  Unplug,
  RefreshCw,
} from 'lucide-react';

interface ContainerInspect {
  id: string;
  name: string;
  image: string;
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    restarting: boolean;
    started_at: string;
  };
  created: string;
  environment: string[];
  labels: Record<string, string>;
  ports: Record<string, { host_ip: string; host_port: string }[]>;
  networks: Record<string, { ip_address: string; gateway: string; network_id: string }>;
  mounts: { source: string; destination: string; mode: string; type: string }[];
  restart_policy: string;
}

interface LogLine {
  content: string;
  stream: string;
}

interface HostNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

const statusColor: Record<string, string> = {
  running: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  exited: 'bg-zinc-500/10 text-zinc-400',
  dead: 'bg-red-500/10 text-red-400',
  created: 'bg-blue-500/10 text-blue-400',
};

type TabId = 'overview' | 'stats' | 'logs' | 'terminal' | 'networks' | 'volumes';

export const ContainerDetailPage: React.FC = () => {
  const { hostId, containerId } = useParams<{ hostId: string; containerId: string }>();
  const navigate = useNavigate();

  const [container, setContainer] = useState<ContainerInspect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [hostNetworks, setHostNetworks] = useState<HostNetwork[]>([]);
  const [connectLoading, setConnectLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState<string | null>(null);

  const fetchContainer = useCallback(async () => {
    if (!hostId || !containerId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ContainerInspect>(`/api/hosts/${hostId}/containers/${containerId}`);
      setContainer(resp.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to load container');
    } finally {
      setLoading(false);
    }
  }, [hostId, containerId]);

  const fetchHostNetworks = useCallback(async () => {
    if (!hostId) return;
    try {
      const resp = await api.get<HostNetwork[]>(`/api/hosts/${hostId}/networks`);
      setHostNetworks(resp.data);
    } catch { /* ignore */ }
  }, [hostId]);

  useEffect(() => {
    fetchContainer();
  }, [fetchContainer]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'networks') {
      fetchHostNetworks();
    }
  }, [activeTab, fetchHostNetworks]);

  const handleStart = async () => {
    setActionLoading(true);
    try { await api.post(`/api/hosts/${hostId}/containers/${containerId}/start`); fetchContainer(); } catch { /* handled by refresh */ }
    setActionLoading(false);
  };

  const handleStop = async () => {
    setActionLoading(true);
    try { await api.post(`/api/hosts/${hostId}/containers/${containerId}/stop`); fetchContainer(); } catch { /* handled by refresh */ }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/api/hosts/${hostId}/containers/${containerId}?force=true`);
      navigate(`/hosts/${hostId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to delete container');
      setConfirmDelete(false);
    }
    setActionLoading(false);
  };

  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const resp = await api.get<LogLine[]>(`/api/hosts/${hostId}/containers/${containerId}/logs?tail=200&timestamps=true`);
      setLogs(resp.data.map((l) => l.content));
      setShowLogs(true);
    } catch {
      setLogs(['Failed to load logs']);
      setShowLogs(true);
    }
    setLogLoading(false);
  };

  const startLogStream = () => {
    const token = getAccessToken();
    if (!token || !hostId || !containerId) return;
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(`ws://localhost:8080/api/ws/hosts/${hostId}/containers/${containerId}/logs?tail=100&token=${encodeURIComponent(token)}`);
    ws.onopen = () => { setStreaming(true); setShowLogs(true); };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log') {
          setLogs((prev) => { const next = [...prev, msg.content]; return next.length > 500 ? next.slice(-500) : next; });
        } else if (msg.type === 'error') {
          setLogs((prev) => [...prev, `[ERROR] ${msg.content}`]);
        }
      } catch { setLogs((prev) => [...prev, event.data]); }
    };
    ws.onclose = () => { setStreaming(false); };
    ws.onerror = () => { setStreaming(false); };
    wsRef.current = ws;
  };

  const stopLogStream = () => {
    if (wsRef.current) { wsRef.current.send(JSON.stringify({ action: 'stop' })); wsRef.current.close(); wsRef.current = null; }
    setStreaming(false);
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${container?.name || containerId}-logs.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleConnectNetwork = async () => {
    if (!selectedNetwork || !hostId || !containerId) return;
    setConnectLoading(true);
    setNetworkError(null);
    try {
      await api.post(`/api/hosts/${hostId}/networks/${selectedNetwork}/connect`, { container_id: containerId });
      fetchContainer();
      setSelectedNetwork('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setNetworkError(axiosErr.response?.data?.error || 'Failed to connect to network');
    }
    setConnectLoading(false);
  };

  const handleDisconnectNetwork = async (networkId: string) => {
    if (!hostId || !containerId) return;
    setDisconnectLoading(networkId);
    setNetworkError(null);
    try {
      await api.post(`/api/hosts/${hostId}/networks/${networkId}/disconnect`, { container_id: containerId });
      fetchContainer();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setNetworkError(axiosErr.response?.data?.error || 'Failed to disconnect from network');
    }
    setDisconnectLoading(null);
  };

  const filteredLogs = logSearch ? logs.filter((l) => l.toLowerCase().includes(logSearch.toLowerCase())) : logs;

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (error || !container) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-red-400">{error || 'Container not found'}</p>
        <Link to={`/hosts/${hostId}`} className="mt-4 inline-block text-blue-400 hover:underline">Back to Host</Link>
      </div>
    );
  }

  const status = container.state?.status || 'unknown';
  const connectedNetworkIds = new Set(Object.values(container.networks || {}).map((n: any) => n.network_id));
  const availableNetworks = hostNetworks.filter((n) => !connectedNetworkIds.has(n.id));

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'stats', label: 'Stats', icon: <Activity className="h-4 w-4" /> },
    { id: 'logs', label: 'Logs', icon: <FileText className="h-4 w-4" /> },
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon className="h-4 w-4" /> },
    { id: 'networks', label: 'Networks', icon: <Network className="h-4 w-4" /> },
    { id: 'volumes', label: 'Volumes', icon: <HardDrive className="h-4 w-4" /> },
  ];

  return (
    <div className="page-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
      <Link to={`/hosts/${hostId}`} className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to Host
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800">
            <Box className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{container.name?.replace(/^\//, '')}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[status] || 'bg-zinc-600/10 text-zinc-400'}`}>
                {status}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-sm text-zinc-500">{container.image}</p>
            <p className="font-mono text-xs text-zinc-600">{container.id?.slice(0, 12)}</p>
          </div>
        </div>
        <ContainerActions
          status={status}
          loading={actionLoading}
          onStart={handleStart}
          onStop={handleStop}
          onDelete={() => setConfirmDelete(true)}
          onRefresh={fetchContainer}
        />
      </div>

      <div className="mb-6 flex gap-1 border-b border-white/10 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <InfoTable title="Details" rows={[
              { label: 'Container ID', value: container.id?.slice(0, 12), mono: true },
              { label: 'Image', value: container.image },
              { label: 'Created', value: container.created ? formatUnixTime(parseInt(container.created)) : '—' },
              ...(container.state?.started_at ? [{ label: 'Started', value: container.state.started_at, mono: false }] : []),
              { label: 'Restart Policy', value: container.restart_policy || 'none' },
              { label: 'Status', value: status },
            ]} />

            {container.environment && container.environment.length > 0 && (
              <div className="glass-card-static">
                <h2 className="mb-3 text-sm font-medium text-zinc-400">Environment Variables</h2>
                <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
                  {container.environment.map((env, i) => (
                    <div key={i} className="text-zinc-300">
                      <span className="text-emerald-400">{env.split('=')[0]}</span>
                      {env.includes('=') ? `=${env.split('=').slice(1).join('=')}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {container.labels && Object.keys(container.labels).length > 0 && (
              <div className="glass-card-static">
                <h2 className="mb-3 text-sm font-medium text-zinc-400">Labels</h2>
                <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
                  {Object.entries(container.labels).map(([key, value]) => (
                    <div key={key} className="text-zinc-300">
                      <span className="text-blue-400">{key}</span>
                      {value ? `=${value}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {container.ports && Object.keys(container.ports).length > 0 && (
              <div className="glass-card-static">
                <h2 className="mb-3 text-sm font-medium text-zinc-400">Port Mappings</h2>
                <div className="space-y-1">
                  {Object.entries(container.ports).map(([port, bindings]: [string, any]) => (
                    <div key={port} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-zinc-300">{port}</span>
                      <span className="text-zinc-600">→</span>
                      {bindings.map((b: any, i: number) => (
                        <span key={i} className="font-mono text-zinc-400">{b.host_ip || '0.0.0.0'}:{b.host_port}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {container.networks && Object.keys(container.networks).length > 0 && (
              <div className="glass-card-static">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <Network className="h-4 w-4" />
                  Networks
                </h2>
                <div className="space-y-2">
                  {Object.entries(container.networks).map(([name, info]: [string, any]) => (
                    <div key={name} className="rounded bg-zinc-800/50 p-2 text-sm">
                      <div className="font-medium text-white">{name}</div>
                      <div className="text-xs text-zinc-500">IP: {info.ip_address} | Gateway: {info.gateway}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {container.mounts && container.mounts.length > 0 && (
              <div className="glass-card-static">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <HardDrive className="h-4 w-4" />
                  Mounts
                </h2>
                <div className="space-y-2">
                  {container.mounts.map((m, i) => (
                    <div key={i} className="rounded bg-zinc-800/50 p-2 text-xs">
                      <div className="text-zinc-300">{m.destination}</div>
                      <div className="text-zinc-500">← {m.source} ({m.type}{m.mode ? `, ${m.mode}` : ''})</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && container.state?.running && (
        <StatsPanel hostID={hostId!} containerID={containerId!} />
      )}
      {activeTab === 'stats' && !container.state?.running && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <Activity className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-3 text-zinc-400">Container must be running to view stats.</p>
          <p className="text-sm text-zinc-600">Start the container to see real-time resource usage.</p>
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {!showLogs && (
                <button onClick={fetchLogs} disabled={logLoading} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50">
                  {logLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Load Logs
                </button>
              )}
              {showLogs && !streaming && (
                <button onClick={startLogStream} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
                  <PlayCircle className="h-3.5 w-3.5" />
                  Stream
                </button>
              )}
              {streaming && (
                <button onClick={stopLogStream} className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-500">
                  <PauseCircle className="h-3.5 w-3.5" />
                  Pause Stream
                </button>
              )}
              {showLogs && (
                <button onClick={downloadLogs} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              )}
            </div>
          </div>

          {showLogs && (
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input type="text" placeholder="Filter logs..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-700 text-blue-500" />
                  Auto-scroll
                </label>
              </div>
              <div ref={logContainerRef} className="h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed">
                {filteredLogs.length === 0 ? <div className="text-zinc-600">No logs available</div> :
                  filteredLogs.map((line, i) => (
                    <div key={i} className={`${line.startsWith('[ERROR]') ? 'text-red-400' : line.startsWith('[STATUS]') ? 'text-yellow-400' : 'text-green-400/90'}`}>{line}</div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'terminal' && container.state?.running && (
        <Terminal hostID={hostId!} containerID={containerId!} />
      )}
      {activeTab === 'terminal' && !container.state?.running && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <TerminalIcon className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-3 text-zinc-400">Container must be running to open a terminal.</p>
          <p className="text-sm text-zinc-600">Start the container to access an interactive shell.</p>
        </div>
      )}

      {activeTab === 'networks' && (
        <div className="space-y-4">
          {networkError && (
            <div className="flex items-center gap-2 rounded-md border border-red-800 bg-red-900/20 px-4 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {networkError}
            </div>
          )}

          <div className="glass-card-static">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Connected Networks</h2>
            {container.networks && Object.keys(container.networks).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(container.networks).map(([name, info]: [string, any]) => (
                  <div key={name} className="flex items-center justify-between rounded bg-zinc-800/50 p-3">
                    <div>
                      <div className="font-medium text-white">{name}</div>
                      <div className="font-mono text-xs text-zinc-500">IP: {info.ip_address} · Gateway: {info.gateway} · ID: {info.network_id?.slice(0, 12)}</div>
                    </div>
                    {name !== 'bridge' && (
                      <button
                        onClick={() => handleDisconnectNetwork(info.network_id)}
                        disabled={disconnectLoading === info.network_id}
                        className="flex items-center gap-1.5 rounded-md border border-red-800 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                      >
                        {disconnectLoading === info.network_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                        Disconnect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No networks connected.</p>
            )}
          </div>

          <div className="glass-card-static">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Connect to Network</h2>
            {availableNetworks.length > 0 ? (
              <div className="flex gap-3">
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a network...</option>
                  {availableNetworks.map((n) => (
                    <option key={n.id} value={n.id}>{n.name} ({n.driver})</option>
                  ))}
                </select>
                <button
                  onClick={handleConnectNetwork}
                  disabled={!selectedNetwork || connectLoading}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Connect
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">All available networks are already connected.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'volumes' && (
        <div className="glass-card-static">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <HardDrive className="h-4 w-4" />
            Mounts & Volumes
          </h2>
          {container.mounts && container.mounts.length > 0 ? (
            <div className="space-y-3">
              {container.mounts.map((m, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-850 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${m.type === 'volume' ? 'bg-blue-500/20 text-blue-400' : m.type === 'bind' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                        {m.type}
                      </span>
                      <span className="font-mono text-sm text-white">{m.destination}</span>
                    </div>
                    {m.mode && <span className="font-mono text-xs text-zinc-600">{m.mode}</span>}
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-500">Source: {m.source}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No mounts or volumes attached to this container.</p>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Container"
          message={`Are you sure you want to delete "${container.name?.replace(/^\//, '') || containerId}"? This will stop and remove the container.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
};