import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Plus, Trash2, RefreshCw, Loader2, Link2, Unlink, Network } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  containers?: { container_id: string; container_name: string; ipv4_address: string }[];
}

export const ManageNetworksPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();

  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NetworkInfo | null>(null);
  const [detailNetwork, setDetailNetwork] = useState<NetworkInfo | null>(null);
  const [connectContainerId, setConnectContainerId] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);

  const fetchNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<NetworkInfo[]>(`/api/hosts/${hostId}/networks`);
      setNetworks(resp.data || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to load networks');
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/hosts/${hostId}/networks/${deleteTarget.id}?force=true`);
      setDeleteTarget(null);
      fetchNetworks();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to delete network');
      setDeleteTarget(null);
    }
  };

  const handleInspect = async (net: NetworkInfo) => {
    try {
      const resp = await api.get<NetworkInfo>(`/api/hosts/${hostId}/networks/${net.id}`);
      setDetailNetwork(resp.data);
    } catch {
      setDetailNetwork(net);
    }
  };

  const handleConnect = async () => {
    if (!detailNetwork || !connectContainerId.trim()) return;
    setConnectLoading(true);
    try {
      await api.post(`/api/hosts/${hostId}/networks/${detailNetwork.id}/connect`, {
        container_id: connectContainerId.trim(),
      });
      setConnectContainerId('');
      handleInspect(detailNetwork);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to connect container');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async (containerId: string) => {
    if (!detailNetwork) return;
    try {
      await api.post(`/api/hosts/${hostId}/networks/${detailNetwork.id}/disconnect`, {
        container_id: containerId,
      });
      handleInspect(detailNetwork);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to disconnect container');
    }
  };

  const isSystemNetwork = (net: NetworkInfo) => {
    return ['bridge', 'host', 'none'].includes(net.name);
  };

  return (
    <div>
      <button
        onClick={() => navigate(`/hosts/${hostId}`)}
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Host
      </button>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Networks</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchNetworks}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => navigate(`/hosts/${hostId}/networks/create`)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Create Network
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : networks.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <Network className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No networks</h3>
          <p className="mt-1 text-sm text-zinc-500">No networks found on this host.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Driver</th>
                  <th className="px-4 py-2.5 font-medium">Scope</th>
                  <th className="px-4 py-2.5 font-medium">Internal</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((net) => (
                  <tr
                    key={net.id}
                    className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50 ${detailNetwork?.id === net.id ? 'bg-zinc-800/50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleInspect(net)}
                        className="font-medium text-white hover:text-blue-400 hover:underline"
                      >
                        {net.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{net.driver}</td>
                    <td className="px-4 py-3 text-zinc-400">{net.scope}</td>
                    <td className="px-4 py-3">
                      {net.internal ? (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">Yes</span>
                      ) : (
                        <span className="text-zinc-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!isSystemNetwork(net) && (
                        <button
                          onClick={() => setDeleteTarget(net)}
                          className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                          title="Delete network"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detailNetwork && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">{detailNetwork.name}</h2>
              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <div className="text-zinc-500">ID</div>
                <div className="font-mono text-xs text-zinc-300">{detailNetwork.id.slice(0, 12)}</div>
                <div className="text-zinc-500">Driver</div>
                <div className="text-zinc-300">{detailNetwork.driver}</div>
                <div className="text-zinc-500">Scope</div>
                <div className="text-zinc-300">{detailNetwork.scope}</div>
                <div className="text-zinc-500">Internal</div>
                <div className="text-zinc-300">{detailNetwork.internal ? 'Yes' : 'No'}</div>
              </div>

              <h3 className="mb-2 text-sm font-medium text-zinc-400">Connected Containers</h3>
              {detailNetwork.containers && detailNetwork.containers.length > 0 ? (
                <div className="mb-4 space-y-1">
                  {detailNetwork.containers.map((c) => (
                    <div key={c.container_id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                      <div>
                        <div className="text-sm text-white">{c.container_name || c.container_id.slice(0, 12)}</div>
                        <div className="font-mono text-xs text-zinc-500">{c.ipv4_address}</div>
                      </div>
                      <button
                        onClick={() => handleDisconnect(c.container_id)}
                        className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                        title="Disconnect"
                      >
                        <Unlink className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-sm text-zinc-500">No containers connected.</p>
              )}

              <h3 className="mb-2 text-sm font-medium text-zinc-400">Connect Container</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={connectContainerId}
                  onChange={(e) => setConnectContainerId(e.target.value)}
                  placeholder="Container ID or name"
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleConnect}
                  disabled={connectLoading || !connectContainerId.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" />
                  Connect
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Network"
          message={`Are you sure you want to delete "${deleteTarget.name}"? Any containers connected to this network will be disconnected.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};