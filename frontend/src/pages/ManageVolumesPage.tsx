import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Plus, Trash2, RefreshCw, HardDrive, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created_at: string;
}

export const ManageVolumesPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();

  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VolumeInfo | null>(null);

  const fetchVolumes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<VolumeInfo[]>(`/api/hosts/${hostId}/volumes`);
      setVolumes(resp.data || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to load volumes');
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    fetchVolumes();
  }, [fetchVolumes]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/hosts/${hostId}/volumes/${encodeURIComponent(deleteTarget.name)}?force=true`);
      setDeleteTarget(null);
      fetchVolumes();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to delete volume');
      setDeleteTarget(null);
    }
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
        <h1 className="text-2xl font-bold text-white">Volumes</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchVolumes}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => navigate(`/hosts/${hostId}/volumes/create`)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Create Volume
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
      ) : volumes.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <HardDrive className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No volumes</h3>
          <p className="mt-1 text-sm text-zinc-500">No volumes found on this host.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Driver</th>
                <th className="px-4 py-2.5 font-medium">Mountpoint</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((vol) => (
                <tr key={vol.name} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-mono text-sm text-white">{vol.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{vol.driver}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 truncate max-w-xs">{vol.mountpoint}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteTarget(vol)}
                      className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                      title="Delete volume"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Volume"
          message={`Are you sure you want to delete volume "${deleteTarget.name}"? This action cannot be undone and may fail if the volume is in use.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};