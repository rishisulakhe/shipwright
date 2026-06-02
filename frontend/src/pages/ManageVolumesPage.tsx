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
    <div className="page-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
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
            className="btn-secondary flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => navigate(`/hosts/${hostId}/volumes/create`)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Volume
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : volumes.length === 0 ? (
        <div className="glass-card-static px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <HardDrive className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No volumes</h3>
          <p className="mt-1 text-sm text-zinc-500">No volumes found on this host.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {volumes.map((vol) => (
            <div key={vol.name} className="glass-card-static min-w-0 overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate font-mono text-sm font-medium text-white" title={vol.name}>{vol.name}</h3>
                <button
                  onClick={() => setDeleteTarget(vol)}
                  className="shrink-0 rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                  title="Delete volume"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-zinc-500">Driver:</span>
                  <span className="text-zinc-300">{vol.driver}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-zinc-500">Mountpoint:</span>
                  <span className="min-w-0 truncate font-mono text-xs text-zinc-500" title={vol.mountpoint}>{vol.mountpoint}</span>
                </div>
              </div>
            </div>
          ))}
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