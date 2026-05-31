import React, { useState } from 'react';
import { Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface PullImageModalProps {
  hostId: string;
  onClose: () => void;
  onPulled: () => void;
}

export const PullImageModal: React.FC<PullImageModalProps> = ({ hostId, onClose, onPulled }) => {
  const [imageRef, setImageRef] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: Record<string, string> = { image: imageRef };
      if (showAuth && username) {
        payload.username = username;
        payload.password = password;
        if (serverAddress) {
          payload.server_address = serverAddress;
        }
      }
      await api.post(`/api/hosts/${hostId}/images/pull`, payload);
      onPulled();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to pull image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Pull Image</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
              Image <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={imageRef}
              onChange={(e) => setImageRef(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="nginx:alpine"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-zinc-600">Format: repository:tag (e.g., python:3.11-slim, postgres:16-alpine)</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAuth(!showAuth)}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
          >
            {showAuth ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Registry Credentials (optional)
          </button>

          {showAuth && (
            <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-400">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  placeholder="dockerhub_username"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-400">Server Address</label>
                <input
                  type="text"
                  value={serverAddress}
                  onChange={(e) => setServerAddress(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  placeholder="registry.example.com (leave blank for Docker Hub)"
                />
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pulling image... This may take a while for large images.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !imageRef}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Pull Image
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};