import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DynamicListInput } from '../components/DynamicListInput';
import type { FieldDef } from '../components/DynamicListInput';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface NetworkOption {
  name: string;
  driver: string;
}

export const CreateContainerPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [ports, setPorts] = useState<Record<string, string>[]>([]);
  const [envVars, setEnvVars] = useState<Record<string, string>[]>([]);
  const [volumes, setVolumes] = useState<Record<string, string>[]>([]);
  const [restartPolicy, setRestartPolicy] = useState('no');
  const [networkName, setNetworkName] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const portFields: FieldDef[] = [
    { key: 'container_port', label: 'Container Port', placeholder: '80', type: 'number' },
    { key: 'host_port', label: 'Host Port', placeholder: '8080', type: 'number' },
    { key: 'protocol', label: 'Protocol', placeholder: 'tcp' },
  ];

  const envFields: FieldDef[] = [
    { key: 'key', label: 'Variable Name', placeholder: 'NODE_ENV' },
    { key: 'value', label: 'Value', placeholder: 'production' },
  ];

  const volumeFields: FieldDef[] = [
    { key: 'host_path', label: 'Host Path', placeholder: '/host/data' },
    { key: 'container_path', label: 'Container Path', placeholder: '/app/data' },
  ];

  const fetchNetworks = useCallback(async () => {
    if (!hostId) return;
    try {
      const resp = await api.get<NetworkOption[]>(`/api/hosts/${hostId}/networks`);
      setNetworks(resp.data || []);
    } catch { /* ignore */ }
  }, [hostId]);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const portMappings = ports
        .filter((p) => p.container_port && p.host_port)
        .map((p) => ({
          container_port: parseInt(p.container_port, 10),
          host_port: parseInt(p.host_port, 10),
          protocol: p.protocol || 'tcp',
        }));

      const envMap: Record<string, string> = {};
      envVars.forEach((ev) => {
        if (ev.key) {
          envMap[ev.key] = ev.value || '';
        }
      });

      const volumeBindings = volumes
        .filter((v) => v.host_path && v.container_path)
        .map((v) => `${v.host_path}:${v.container_path}`);

      const payload = {
        name: name || undefined,
        image,
        ports: portMappings,
        env_vars: envMap,
        volumes: volumeBindings,
        restart_policy: restartPolicy,
        network: networkName || undefined,
        start: autoStart,
      };

      await api.post(`/api/hosts/${hostId}/containers`, payload);
      navigate(`/hosts/${hostId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate(`/hosts/${hostId}`)}
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Host
      </button>

      <h1 className="mb-6 text-2xl font-bold text-white">Create Container</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">Container Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="my-container (optional — Docker auto-generates if empty)"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Image <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="nginx:alpine"
            required
          />
          <p className="mt-1 text-xs text-zinc-600">The image will be pulled automatically if not available locally.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-400">Port Mappings</label>
          <DynamicListInput
            items={ports}
            onChange={setPorts}
            fields={portFields}
            addLabel="Add Port"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-400">Environment Variables</label>
          <DynamicListInput
            items={envVars}
            onChange={setEnvVars}
            fields={envFields}
            addLabel="Add Env Var"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-400">Volume Mounts</label>
          <DynamicListInput
            items={volumes}
            onChange={setVolumes}
            fields={volumeFields}
            addLabel="Add Volume"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Restart Policy</label>
            <select
              value={restartPolicy}
              onChange={(e) => setRestartPolicy(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="no">No (never restart)</option>
              <option value="always">Always</option>
              <option value="on-failure">On Failure</option>
              <option value="unless-stopped">Unless Stopped</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Network</label>
            <select
              value={networkName}
              onChange={(e) => setNetworkName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Default (bridge)</option>
              {networks.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name} ({n.driver})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="auto-start"
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="auto-start" className="text-sm text-zinc-300">
            Start container after creation
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !image}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Creating...' : 'Create Container'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/hosts/${hostId}`)}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};