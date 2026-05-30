import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Server } from 'lucide-react';

interface HostCardProps {
  host: {
    id: string;
    name: string;
    host_ip: string;
    port: number;
    protocol: string;
    auth_type: string;
    is_active: boolean;
    stats?: {
      containers: number;
      images: number;
      networks: number;
      volumes: number;
    };
  };
}

export const HostCard: React.FC<HostCardProps> = ({ host }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/hosts/${host.id}`)}
      className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-blue-600 hover:bg-zinc-800/50"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
            <Server className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{host.name}</h3>
            <p className="font-mono text-sm text-zinc-500">
              {host.protocol === 'unix' ? '/var/run/docker.sock' : `${host.host_ip}:${host.port}`}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            host.is_active
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {host.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {host.stats && (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded bg-zinc-800/50 px-2 py-1.5">
            <div className="font-mono text-lg font-semibold text-white">{host.stats.containers}</div>
            <div className="text-xs text-zinc-500">Containers</div>
          </div>
          <div className="rounded bg-zinc-800/50 px-2 py-1.5">
            <div className="font-mono text-lg font-semibold text-white">{host.stats.images}</div>
            <div className="text-xs text-zinc-500">Images</div>
          </div>
          <div className="rounded bg-zinc-800/50 px-2 py-1.5">
            <div className="font-mono text-lg font-semibold text-white">{host.stats.networks}</div>
            <div className="text-xs text-zinc-500">Networks</div>
          </div>
          <div className="rounded bg-zinc-800/50 px-2 py-1.5">
            <div className="font-mono text-lg font-semibold text-white">{host.stats.volumes}</div>
            <div className="text-xs text-zinc-500">Volumes</div>
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-zinc-600">
        {host.protocol.toUpperCase()} &middot; {host.auth_type.toUpperCase()}
      </div>
    </div>
  );
};