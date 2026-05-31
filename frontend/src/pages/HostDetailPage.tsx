import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useHost } from '../hooks/useHost';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import api from '../services/api';
import { formatUnixTime, formatBytes, formatPorts } from '../utils/formatters';
import {
  ArrowLeft,
  Server,
  RefreshCw,
  Box,
  Network,
  HardDrive,
  Image,
  Circle,
  Plus,
  Play,
  Square,
  Trash2,
} from 'lucide-react';

type Tab = 'containers' | 'networks' | 'volumes' | 'images';

const statusColor: Record<string, string> = {
  running: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  exited: 'bg-zinc-500/10 text-zinc-400',
  dead: 'bg-red-500/10 text-red-400',
  created: 'bg-blue-500/10 text-blue-400',
};

const statusDot: Record<string, string> = {
  running: 'fill-emerald-400',
  paused: 'fill-yellow-400',
  exited: 'fill-zinc-400',
  dead: 'fill-red-400',
  created: 'fill-blue-400',
};

export const HostDetailPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('containers');
  const { host, containers, networks, volumes, images, loading, error, refresh, refreshContainers, refreshNetworks, refreshVolumes, refreshImages } = useHost(hostId || '');

  if (loading) {
    return <LoadingSpinner size="lg" className="py-20" />;
  }

  if (error || !host) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-red-400">{error || 'Host not found'}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-blue-400 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number; onRefresh: () => void }[] = [
    { key: 'containers', label: 'Containers', icon: <Box className="h-4 w-4" />, count: containers.length, onRefresh: refreshContainers },
    { key: 'networks', label: 'Networks', icon: <Network className="h-4 w-4" />, count: networks.length, onRefresh: refreshNetworks },
    { key: 'volumes', label: 'Volumes', icon: <HardDrive className="h-4 w-4" />, count: volumes.length, onRefresh: refreshVolumes },
    { key: 'images', label: 'Images', icon: <Image className="h-4 w-4" />, count: images.length, onRefresh: refreshImages },
  ];

  return (
    <div>
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Host Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800">
            <Server className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{host.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${host.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                <Circle className={`h-2 w-2 ${host.is_active ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'}`} />
                {host.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-sm text-zinc-500">
              {host.protocol === 'unix' ? '/var/run/docker.sock' : `${host.host_ip}:${host.port}`}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {!host.is_active && (
        <div className="mb-6 rounded-lg border border-yellow-800 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-400">
          This host is currently inactive. Connection may not be available.
        </div>
      )}

      {/* Stats */}
      {host.stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="font-mono text-xl font-semibold text-white">{host.stats.containers}</div>
            <div className="text-xs text-zinc-500">Containers</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="font-mono text-xl font-semibold text-white">{host.stats.images}</div>
            <div className="text-xs text-zinc-500">Images</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="font-mono text-xl font-semibold text-white">{host.stats.networks}</div>
            <div className="text-xs text-zinc-500">Networks</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="font-mono text-xl font-semibold text-white">{host.stats.volumes}</div>
            <div className="text-xs text-zinc-500">Volumes</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className="rounded-full bg-zinc-600 px-2 py-0.5 text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        {activeTab === 'containers' && (
          <ContainersTab containers={containers} onRefresh={refreshContainers} hostId={hostId || ''} onCreateClick={() => navigate(`/hosts/${hostId}/containers/create`)} />
        )}
        {activeTab === 'networks' && (
          <NetworksTab networks={networks} onRefresh={refreshNetworks} onViewAll={() => navigate(`/hosts/${hostId}/networks`)} />
        )}
        {activeTab === 'volumes' && (
          <VolumesTab volumes={volumes} onRefresh={refreshVolumes} onViewAll={() => navigate(`/hosts/${hostId}/volumes`)} />
        )}
        {activeTab === 'images' && (
          <ImagesTab images={images} onRefresh={refreshImages} onViewAll={() => navigate(`/hosts/${hostId}/images`)} />
        )}
      </div>
    </div>
  );
};

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  ports: { host_ip: string; host_port: number; container_port: number; protocol: string }[];
  created: number;
}

interface ContainersTabProps {
  containers: ContainerInfo[];
  onRefresh: () => void;
  hostId: string;
  onCreateClick: () => void;
}

const ContainersTab: React.FC<ContainersTabProps> = ({ containers, onRefresh, hostId, onCreateClick }) => {
  const [sortKey, setSortKey] = useState<'name' | 'state' | 'created'>('name');
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContainerInfo | null>(null);

  const handleStart = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      await api.post(`/api/hosts/${hostId}/containers/${containerId}/start`);
      onRefresh();
    } catch { /* error handled by refresh */ }
    setActionLoading(null);
  };

  const handleStop = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      await api.post(`/api/hosts/${hostId}/containers/${containerId}/stop`);
      onRefresh();
    } catch { /* error handled by refresh */ }
    setActionLoading(null);
  };

  const handleDelete = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      await api.delete(`/api/hosts/${hostId}/containers/${containerId}?force=true`);
      onRefresh();
    } catch { /* error handled by refresh */ }
    setConfirmDelete(null);
    setActionLoading(null);
  };

  if (containers.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-sm text-zinc-500">0 containers</span>
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Container
          </button>
        </div>
        <EmptyState
          icon={<Box className="h-6 w-6" />}
          label="Containers"
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  const filtered = containers
    .filter((c) => {
      if (!filter) return true;
      const name = c.names[0]?.replace(/^\//, '') || '';
      return name.toLowerCase().includes(filter.toLowerCase()) || c.image.toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      if (sortKey === 'name') {
        const aName = a.names[0]?.replace(/^\//, '') || '';
        const bName = b.names[0]?.replace(/^\//, '') || '';
        return aName.localeCompare(bName);
      }
      if (sortKey === 'state') return a.state.localeCompare(b.state);
      return b.created - a.created;
    });

  return (
    <div>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter containers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as 'name' | 'state' | 'created')}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="name">Sort by Name</option>
            <option value="state">Sort by State</option>
            <option value="created">Sort by Created</option>
          </select>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Image</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Ports</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3">
                  <div className="font-mono text-sm text-white">{c.names[0]?.replace(/^\//, '') || c.id.slice(0, 12)}</div>
                  <div className="font-mono text-xs text-zinc-600">{c.id.slice(0, 12)}</div>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-zinc-300">{c.image}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[c.state] || 'bg-zinc-600/10 text-zinc-400'}`}>
                    <Circle className={`h-2 w-2 ${statusDot[c.state] || 'fill-zinc-400 text-zinc-400'}`} />
                    {c.status || c.state}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-zinc-400">{formatPorts(c.ports)}</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{formatUnixTime(c.created)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {(c.state === 'exited' || c.state === 'created' || c.state === 'dead') && (
                      <button
                        onClick={() => handleStart(c.id)}
                        disabled={actionLoading === c.id}
                        className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                        title="Start"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {c.state === 'running' && (
                      <button
                        onClick={() => handleStop(c.id)}
                        disabled={actionLoading === c.id}
                        className="rounded p-1 text-yellow-400 transition-colors hover:bg-yellow-500/10 disabled:opacity-50"
                        title="Stop"
                      >
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Container"
          message={`Are you sure you want to delete "${confirmDelete.names[0]?.replace(/^\//, '') || confirmDelete.id.slice(0, 12)}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
}

const NetworksTab: React.FC<{ networks: NetworkInfo[]; onRefresh: () => void; onViewAll: () => void }> = ({ networks, onRefresh, onViewAll }) => {
  if (networks.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-sm text-zinc-500">0 networks</span>
          <button onClick={onViewAll} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
            <Plus className="h-3.5 w-3.5" />
            Manage
          </button>
        </div>
        <EmptyState icon={<Network className="h-6 w-6" />} label="Networks" onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end border-b border-zinc-800 px-4 py-3">
        <button onClick={onViewAll} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
          <Plus className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Driver</th>
              <th className="px-4 py-2.5 font-medium">Scope</th>
              <th className="px-4 py-2.5 font-medium">Internal</th>
              <th className="px-4 py-2.5 font-medium">ID</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => (
              <tr key={n.id} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
                <td className="px-4 py-3 font-medium text-white">{n.name}</td>
                <td className="px-4 py-3 text-zinc-400">{n.driver}</td>
                <td className="px-4 py-3 text-zinc-400">{n.scope}</td>
                <td className="px-4 py-3">
                  {n.internal ? (
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">Yes</span>
                  ) : (
                    <span className="text-zinc-500">No</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{n.id.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created_at: string;
}

const VolumesTab: React.FC<{ volumes: VolumeInfo[]; onRefresh: () => void; onViewAll: () => void }> = ({ volumes, onRefresh, onViewAll }) => {
  if (volumes.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-sm text-zinc-500">0 volumes</span>
          <button onClick={onViewAll} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
            <Plus className="h-3.5 w-3.5" />
            Manage
          </button>
        </div>
        <EmptyState icon={<HardDrive className="h-6 w-6" />} label="Volumes" onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end border-b border-zinc-800 px-4 py-3">
        <button onClick={onViewAll} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
          <Plus className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Driver</th>
            <th className="px-4 py-2.5 font-medium">Mountpoint</th>
          </tr>
        </thead>
        <tbody>
          {volumes.map((v) => (
            <tr key={v.name} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
              <td className="px-4 py-3 font-mono text-sm text-white">{v.name}</td>
              <td className="px-4 py-3 text-zinc-400">{v.driver}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-600 truncate max-w-xs">{v.mountpoint}</td>
            </tr>
          ))}
        </tbody>
</table>
      </div>
    </div>
  );
};

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

const ImagesTab: React.FC<{ images: ImageInfo[]; onRefresh: () => void; onViewAll: () => void }> = ({ images, onRefresh, onViewAll }) => {
  if (images.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-sm text-zinc-500">0 images</span>
          <button onClick={onViewAll} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
            <Plus className="h-3.5 w-3.5" />
            Manage
          </button>
        </div>
        <EmptyState icon={<Image className="h-6 w-6" />} label="Images" onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end border-b border-zinc-800 px-4 py-3">
        <button onClick={onViewAll} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
          <Plus className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500">
              <th className="px-4 py-2.5 font-medium">Tags</th>
              <th className="px-4 py-2.5 font-medium">Size</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">ID</th>
            </tr>
          </thead>
          <tbody>
            {images.map((img) => (
              <tr key={img.id} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  {img.repo_tags.map((tag) => (
                    <div key={tag} className="font-mono text-sm text-white">{tag}</div>
                  ))}
                </td>
                <td className="px-4 py-3 text-zinc-400">{formatBytes(img.size)}</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{formatUnixTime(img.created)}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{img.id.replace(/^sha256:/, '').slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; label: string; onRefresh: () => void }> = ({ icon, label, onRefresh }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-500">
      {icon}
    </div>
    <h3 className="text-lg font-medium text-white">No {label.toLowerCase()}</h3>
    <p className="mt-1 text-sm text-zinc-500">No {label.toLowerCase()} found on this host.</p>
    <button
      onClick={onRefresh}
      className="mt-3 flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Refresh
    </button>
  </div>
);