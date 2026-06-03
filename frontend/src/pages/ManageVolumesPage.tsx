import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Plus, Trash2, RefreshCw, HardDrive, Loader2, Database } from 'lucide-react';
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
    <div className="page-bg" style={{ minHeight: '100vh', padding: '2rem', display: 'block', width: '100%' }}>
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
        <div className="glass-card-static px-4 py-16 text-center" style={{ display: 'block', width: '100%' }}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <HardDrive className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No volumes</h3>
          <p className="mt-1 text-sm text-zinc-500">No volumes found on this host.</p>
        </div>
      ) : (
        /* CRITICAL FIX: Explicitly forced standard block display and forced column layout 
          to break any inherited grid or row parameters from parent layout classes.
        */
        <div style={{ display: 'block', width: '100%' }} className="!block !w-full space-y-4">
          {volumes.map((vol) => (
            <div 
              key={vol.name} 
              style={{ display: 'flex', width: '100%' }}
              className="!flex !w-full flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md transition-all hover:border-zinc-700"
            >
              {/* Left Content Area */}
              <div className="min-w-0 flex-1 flex items-start gap-4" style={{ minWidth: 0 }}>
                <div className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-400 mt-0.5">
                  <Database className="h-5 w-5" />
                </div>
                
                <div className="min-w-0 flex-1 space-y-2" style={{ minWidth: 0 }}>
                  {/* Title Bar: Name and Driver Badge */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex items-center shrink-0 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                      {vol.driver}
                    </span>
                    <h3 
                      className="font-mono text-sm font-semibold text-white tracking-wide break-all" 
                      style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                      title={vol.name}
                    >
                      {vol.name}
                    </h3>
                  </div>
                  
                  {/* Mountpoint Path Details */}
                  <div className="flex items-baseline gap-2 text-xs text-zinc-400">
                    <span className="text-zinc-600 font-bold select-none text-[10px] tracking-wider uppercase shrink-0">Mountpoint:</span>
                    <span 
                      className="font-mono bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800/80 break-all text-zinc-400"
                      style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                      title={vol.mountpoint}
                    >
                      {vol.mountpoint}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="flex items-center justify-end shrink-0 border-t border-zinc-800/40 sm:border-t-0 pt-3 sm:pt-0">
                <button
                  onClick={() => setDeleteTarget(vol)}
                  className="flex items-center justify-center rounded-lg p-2.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400 border border-zinc-800 hover:border-red-500/20"
                  title="Delete volume"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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