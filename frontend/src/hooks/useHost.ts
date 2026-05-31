import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface HostInfo {
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

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  ports: {
    host_ip: string;
    host_port: number;
    container_port: number;
    protocol: string;
  }[];
  created: number;
}

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
}

interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created_at: string;
}

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

interface UseHostResult {
  host: HostInfo | null;
  containers: ContainerInfo[];
  networks: NetworkInfo[];
  volumes: VolumeInfo[];
  images: ImageInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  refreshContainers: () => void;
  refreshNetworks: () => void;
  refreshVolumes: () => void;
  refreshImages: () => void;
}

export function useHost(hostId: string): UseHostResult {
  const [host, setHost] = useState<HostInfo | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!hostId) return;
    setLoading(true);
    setError(null);
    try {
      const [hostResp, containerResp, networkResp, volumeResp, imageResp] = await Promise.allSettled([
        api.get<HostInfo>(`/api/hosts/${hostId}`),
        api.get<ContainerInfo[]>(`/api/hosts/${hostId}/containers?all=true`),
        api.get<NetworkInfo[]>(`/api/hosts/${hostId}/networks`),
        api.get<VolumeInfo[]>(`/api/hosts/${hostId}/volumes`),
        api.get<ImageInfo[]>(`/api/hosts/${hostId}/images`),
      ]);

      if (hostResp.status === 'fulfilled') {
        setHost(hostResp.value.data);
      } else {
        setError('Failed to load host');
      }

      if (containerResp.status === 'fulfilled') {
        setContainers(containerResp.value.data || []);
      }
      if (networkResp.status === 'fulfilled') {
        setNetworks(networkResp.value.data || []);
      }
      if (volumeResp.status === 'fulfilled') {
        setVolumes(volumeResp.value.data || []);
      }
      if (imageResp.status === 'fulfilled') {
        setImages(imageResp.value.data || []);
      }
    } catch {
      setError('Failed to load host data');
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  const refreshContainers = useCallback(async () => {
    try {
      const resp = await api.get<ContainerInfo[]>(`/api/hosts/${hostId}/containers?all=true`);
      setContainers(resp.data || []);
    } catch { /* keep stale data */ }
  }, [hostId]);

  const refreshNetworks = useCallback(async () => {
    try {
      const resp = await api.get<NetworkInfo[]>(`/api/hosts/${hostId}/networks`);
      setNetworks(resp.data || []);
    } catch { /* keep stale data */ }
  }, [hostId]);

  const refreshVolumes = useCallback(async () => {
    try {
      const resp = await api.get<VolumeInfo[]>(`/api/hosts/${hostId}/volumes`);
      setVolumes(resp.data || []);
    } catch { /* keep stale data */ }
  }, [hostId]);

  const refreshImages = useCallback(async () => {
    try {
      const resp = await api.get<ImageInfo[]>(`/api/hosts/${hostId}/images`);
      setImages(resp.data || []);
    } catch { /* keep stale data */ }
  }, [hostId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    host,
    containers,
    networks,
    volumes,
    images,
    loading,
    error,
    refresh: fetchAll,
    refreshContainers,
    refreshNetworks,
    refreshVolumes,
    refreshImages,
  };
}