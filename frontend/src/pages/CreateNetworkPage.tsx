import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const CreateNetworkPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [driver, setDriver] = useState('bridge');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [internal, setInternal] = useState(false);
  const [attachable, setAttachable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post(`/api/hosts/${hostId}/networks`, {
        name,
        driver,
        subnet: subnet || undefined,
        gateway: gateway || undefined,
        internal,
        attachable,
      });
      navigate(`/hosts/${hostId}/networks`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create network');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg" style={{ minHeight: '100vh', padding: '2rem' }}>
      <button
        onClick={() => navigate(`/hosts/${hostId}/networks`)}
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Networks
      </button>

      <h1 className="mb-6 text-2xl font-bold text-white">Create Network</h1>

      <form onSubmit={handleSubmit} className="glass-card-static space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="glass-label">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full"
            placeholder="my-network"
            required
          />
        </div>

        <div>
          <label className="glass-label">Driver</label>
          <select
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            className="glass-select w-full"
          >
            <option value="bridge">Bridge</option>
            <option value="host">Host</option>
            <option value="overlay">Overlay</option>
            <option value="macvlan">MACVLAN</option>
            <option value="none">None</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="glass-label">Subnet (optional)</label>
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              className="glass-input w-full"
              placeholder="172.20.0.0/16"
            />
          </div>
          <div>
            <label className="glass-label">Gateway (optional)</label>
            <input
              type="text"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="glass-input w-full"
              placeholder="172.20.0.1"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="internal"
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="internal" className="text-sm text-zinc-300">
              Internal (no external access)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="attachable"
              type="checkbox"
              checked={attachable}
              onChange={(e) => setAttachable(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="attachable" className="text-sm text-zinc-300">
              Attachable (manual container connection)
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !name}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Network
          </button>
          <button
            type="button"
            onClick={() => navigate(`/hosts/${hostId}/networks`)}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};