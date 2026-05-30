import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { getCurrentUser } from '../utils/auth';
import { HostCard } from '../components/HostCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Plus, RefreshCw } from 'lucide-react';

interface Host {
  id: string;
  name: string;
  host_ip: string;
  port: number;
  protocol: string;
  auth_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    containers: number;
    images: number;
    networks: number;
    volumes: number;
  };
}

export const DashboardPage: React.FC = () => {
  const user = getCurrentUser();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/hosts');
      setHosts(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to fetch hosts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.username || 'User'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your Docker hosts and containers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchHosts}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            to="/hosts/create"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Host
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : error ? (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchHosts}
            className="mt-3 text-sm text-red-300 underline hover:text-red-200"
          >
            Try again
          </button>
        </div>
      ) : hosts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <Plus className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No Docker hosts</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Add your first Docker host to get started.
          </p>
          <Link
            to="/hosts/create"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Host
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hosts.map((host) => (
            <HostCard key={host.id} host={host} />
          ))}
        </div>
      )}
    </div>
  );
};