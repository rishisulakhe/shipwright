import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatUnixTime, formatBytes } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PullImageModal } from '../components/PullImageModal';
import { ArrowLeft, Plus, Trash2, RefreshCw, Image, Loader2, Search } from 'lucide-react';

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

export const ManageImagesPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();

  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPullModal, setShowPullModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageInfo | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ImageInfo[]>(`/api/hosts/${hostId}/images?all=false`);
      setImages(resp.data || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const imageId = deleteTarget.id.startsWith('sha256:') ? deleteTarget.id : `sha256:${deleteTarget.id}`;
      await api.delete(`/api/hosts/${hostId}/images/${encodeURIComponent(imageId)}?force=true`);
      setDeleteTarget(null);
      fetchImages();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to delete image');
      setDeleteTarget(null);
    }
  };

  const filtered = images.filter((img) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      img.repo_tags.some((tag) => tag.toLowerCase().includes(term)) ||
      img.id.toLowerCase().includes(term)
    );
  });

  const displayName = (img: ImageInfo) => {
    const tag = img.repo_tags.find((t) => t !== '<none>');
    return tag || img.id.replace(/^sha256:/, '').slice(0, 12);
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
        <h1 className="text-2xl font-bold text-white">Images</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchImages}
            className="btn-secondary flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowPullModal(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Pull Image
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
      ) : images.length === 0 ? (
        <div className="glass-card-static px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <Image className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No images</h3>
          <p className="mt-1 text-sm text-zinc-500">Pull your first image to get started.</p>
          <button
            onClick={() => setShowPullModal(true)}
            className="btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Pull Image
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search images..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass-input w-full py-2.5 pl-10 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="glass-card-static">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">Repository</th>
                  <th className="px-4 py-2.5 font-medium">Size</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((img) => (
                  <tr key={img.id} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
<td className="px-4 py-3">
                       {img.repo_tags.filter(t => t !== '<none>' && t !== '<none>:<none>').length > 0 ? (
                         img.repo_tags.filter(t => t !== '<none>' && t !== '<none>:<none>').map((tag) => (
                           <div key={tag} className="min-w-0 truncate font-mono text-sm text-white" title={tag}>{tag}</div>
                         ))
                       ) : (
                         <span className="font-mono text-sm text-zinc-500">&lt;none&gt;</span>
                       )}
                     </td>
                    <td className="px-4 py-3 text-zinc-400">{formatBytes(img.size)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{formatUnixTime(img.created)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{img.id.replace(/^sha256:/, '').slice(0, 12)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteTarget(img)}
                        className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                        title="Delete image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-zinc-600">
            Showing {filtered.length} of {images.length} images
          </div>
        </div>
      )}

      {showPullModal && (
        <PullImageModal
          hostId={hostId || ''}
          onClose={() => setShowPullModal(false)}
          onPulled={fetchImages}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Image"
          message={`Are you sure you want to delete "${displayName(deleteTarget)}"? This will remove the image from the host. Containers using this image will not be affected.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};