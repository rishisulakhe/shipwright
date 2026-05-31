import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { DynamicListInput } from '../components/DynamicListInput';

export const CreateVolumePage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [driver, setDriver] = useState('local');
  const [labels, setLabels] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const labelFields = [
    { key: 'key', label: 'Label Key', placeholder: 'com.example.label' },
    { key: 'value', label: 'Label Value', placeholder: 'value' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const labelsMap: Record<string, string> = {};
      labels.forEach((l) => {
        if (l.key) {
          labelsMap[l.key] = l.value || '';
        }
      });

      await api.post(`/api/hosts/${hostId}/volumes`, {
        name,
        driver,
        labels: Object.keys(labelsMap).length > 0 ? labelsMap : undefined,
      });
      navigate(`/hosts/${hostId}/volumes`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create volume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => navigate(`/hosts/${hostId}/volumes`)}
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Volumes
      </button>

      <h1 className="mb-6 text-2xl font-bold text-white">Create Volume</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="my-volume"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">Driver</label>
          <select
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="local">Local</option>
            <option value="nfs">NFS</option>
            <option value="tmpfs">TMPFS</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-400">Labels</label>
          <DynamicListInput
            items={labels}
            onChange={setLabels}
            fields={labelFields}
            addLabel="Add Label"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !name}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Volume
          </button>
          <button
            type="button"
            onClick={() => navigate(`/hosts/${hostId}/volumes`)}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};