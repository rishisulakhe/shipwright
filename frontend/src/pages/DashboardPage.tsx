import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { clearTokens } from '../utils/auth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Plus, RefreshCw, ArrowRight, Box, HardDrive, Network, Image, LogOut } from 'lucide-react';

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

function decodeToken(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const decoded = token ? decodeToken(token) : null;
  const username = decoded?.username || 'User';
  const role = decoded?.role || 'viewer';

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

  const handleLogout = () => {
    clearTokens();
    navigate('/login');
  };

  return (
    <div className="page-bg" style={{ minHeight: '100vh', padding: 0 }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchHosts} className="btn-secondary flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={handleLogout} className="btn-danger flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>

        <div style={{ paddingTop: '3rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
            <div className="glass-card-static animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>
                    Welcome, {username}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '0.875rem', height: '0.875rem', backgroundColor: '#3b82f6', borderRadius: '50%', boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)', animation: 'pulseGlow 2s ease-in-out infinite' }} />
                    <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.875rem' }}>
                      Role: {role}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>
                    {hosts.length}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 500 }}>
                    Hosts
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingBottom: '2rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white' }}>
              Your Hosts
            </h2>
            {(role === 'admin' || role === 'developer') && (
              <Link to="/hosts/create" className="btn-primary flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
                <Plus className="h-4 w-4" />
                Create Host
              </Link>
            )}
          </div>

          {loading ? (
            <LoadingSpinner size="lg" className="py-20" />
          ) : error ? (
            <div className="glass-card-static text-center" style={{ padding: '3rem' }}>
              <p style={{ color: '#f87171', fontSize: '1.25rem' }}>{error}</p>
              <button onClick={fetchHosts} style={{ color: '#3b82f6', marginTop: '1rem', cursor: 'pointer' }}>
                Try again
              </button>
            </div>
          ) : hosts.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '4rem', paddingBottom: '4rem' }} className="animate-fade-in-delay">
              <div style={{ color: '#9ca3af', fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 500 }}>
                No hosts found
              </div>
              {(role === 'admin' || role === 'developer') && (
                <Link to="/hosts/create" className="btn-primary" style={{ fontSize: '1rem', padding: '1rem 2rem' }}>
                  Create Your First Host
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {hosts.map((host, index) => (
                <Link
                  key={host.id}
                  to={`/hosts/${host.id}`}
                  className="glass-card animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s`, cursor: 'pointer', textDecoration: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>
                        {host.name}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem', fontFamily: 'monospace' }}>
                        {host.host_ip}:{host.port}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {host.protocol} · {host.auth_type}
                      </p>
                    </div>
                    <div style={{
                      width: '0.875rem',
                      height: '0.875rem',
                      borderRadius: '50%',
                      marginLeft: '0.75rem',
                      backgroundColor: host.is_active ? '#10b981' : '#ef4444',
                      boxShadow: host.is_active ? '0 0 8px rgba(16, 185, 129, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)',
                      animation: 'pulseGlow 2s ease-in-out infinite'
                    }} />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: host.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: host.is_active ? '#10b981' : '#ef4444',
                      border: `1px solid ${host.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {host.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {host.stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{host.stats.containers}</div>
                        <div style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>
                          <Box className="h-3 w-3 inline mr-0.5" />
                          Containers
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>{host.stats.networks}</div>
                        <div style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>
                          <Network className="h-3 w-3 inline mr-0.5" />
                          Networks
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{host.stats.volumes}</div>
                        <div style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>
                          <HardDrive className="h-3 w-3 inline mr-0.5" />
                          Volumes
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#06b6d4' }}>{host.stats.images}</div>
                        <div style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>
                          <Image className="h-3 w-3 inline mr-0.5" />
                          Images
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                  }}>
                    <span style={{ color: '#3b82f6', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Click to manage host <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};