import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useHost } from '../hooks/useHost';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import api from '../services/api';
import { formatBytes, formatPorts } from '../utils/formatters';
import {
  ArrowLeft, RefreshCw, Box, Network, HardDrive, Image, Plus,
  Play, Square, Trash2, Search,
} from 'lucide-react';

type Tab = 'containers' | 'networks' | 'volumes' | 'images';

const tabConfig: Record<Tab, { title: string; icon: React.FC<any>; color: string; bgColor: string; borderColor: string }> = {
  containers: { title: 'Containers', icon: Box, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
  volumes: { title: 'Volumes', icon: HardDrive, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' },
  networks: { title: 'Networks', icon: Network, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' },
  images: { title: 'Images', icon: Image, color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.3)' },
};

export const HostDetailPage: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('containers');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filter, setFilter] = useState('');
  const { host, containers, networks, volumes, images, loading, error, refresh, refreshContainers } = useHost(hostId || '');

  const handleDeleteHost = async () => {
    if (!hostId) return;
    try {
      await api.delete(`/api/hosts/${hostId}`);
      navigate('/dashboard');
    } catch { setConfirmDelete(false); }
  };

  const handleTestConnection = async () => {
    if (!hostId) return;
    try { await api.post(`/api/hosts/${hostId}/test-connection`); refresh(); }
    catch { refresh(); }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (error || !host) {
    return (
      <div className="page-bg min-h-screen flex items-center justify-center">
        <div className="glass-card-static text-center"><p style={{ color: '#f87171', fontSize: '1.25rem' }}>{error || 'Host not found'}</p>
          <Link to="/dashboard" className="btn-secondary mt-4 inline-block">Back to Dashboard</Link></div>
      </div>
    );
  }

  const filteredContainers = containers
    .filter((c: any) => !filter || c.names?.[0]?.toLowerCase().includes(filter.toLowerCase()) || c.image?.toLowerCase().includes(filter.toLowerCase()) || c.state?.toLowerCase().includes(filter.toLowerCase()))
    .sort((a: any, b: any) => (a.names?.[0] || '').replace(/^\//, '').localeCompare((b.names?.[0] || '').replace(/^\//, '')));

  const filteredNetworks = networks.filter((n: any) => !filter || n.name?.toLowerCase().includes(filter.toLowerCase()) || n.driver?.toLowerCase().includes(filter.toLowerCase()));
  const filteredVolumes = volumes.filter((v: any) => !filter || v.name?.toLowerCase().includes(filter.toLowerCase()));
  const filteredImages = images.filter((i: any) => !filter || (i.repoTags?.[0] || '').toLowerCase().includes(filter.toLowerCase()));

  const statCards = [
    { label: 'Containers', value: containers.length, color: '#3b82f6', icon: Box },
    { label: 'Volumes', value: volumes.length, color: '#10b981', icon: HardDrive },
    { label: 'Networks', value: networks.length, color: '#f59e0b', icon: Network },
    { label: 'Images', value: images.length, color: '#06b6d4', icon: Image },
  ];

  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 10 }}>
          <Link to="/dashboard" className="btn-secondary flex items-center gap-2" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, display: 'flex', gap: '0.75rem' }}>
          <button onClick={refresh} className="btn-secondary flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={handleTestConnection} className="btn-secondary flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
            Test Connection
          </button>
          <button onClick={() => setConfirmDelete(true)} className="btn-danger flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>

        <div style={{ paddingTop: '3rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
            <div className="glass-card-static animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>
                    {host.name}
                  </h1>
                  <p style={{ fontFamily: 'monospace', color: '#9ca3af', fontSize: '0.875rem' }}>
                    {host.host_ip}:{host.port}
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {host.protocol} · {host.auth_type} auth
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: '1rem', height: '1rem', backgroundColor: host.is_active ? '#10b981' : '#ef4444', borderRadius: '50%',
                      boxShadow: host.is_active ? '0 0 8px rgba(16, 185, 129, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)',
                      animation: 'pulseGlow 2s ease-in-out infinite' }} />
                    <span style={{ color: host.is_active ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '1rem' }}>
                      {host.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                {statCards.map((s) => (
                  <div key={s.label} className="glass-stat">
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color, marginBottom: '0.5rem' }}>{s.value}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingBottom: '2rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', textAlign: 'center', marginBottom: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Manage Docker Resources
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {(Object.entries(tabConfig) as [Tab, typeof tabConfig[Tab]][]).map(([tab, card]) => (
              <div
                key={tab}
                className="glass-card"
                style={{ cursor: 'pointer', textAlign: 'center', borderColor: activeTab === tab ? card.borderColor : undefined }}
                onClick={() => setActiveTab(tab)}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3rem', height: '3rem', backgroundColor: card.bgColor, borderRadius: '0.75rem', marginBottom: '1rem', color: card.color, border: `1px solid ${card.borderColor}` }}>
                  <card.icon className="h-6 w-6" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>{card.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>Manage Docker {card.title}</p>
              </div>
            ))}
          </div>

          <div className="glass-card-static" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>
                {activeTab === 'containers' && 'Containers'}
                {activeTab === 'networks' && 'Networks'}
                {activeTab === 'volumes' && 'Volumes'}
                {activeTab === 'images' && 'Images'}
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter..."
                    className="glass-input"
                    style={{ paddingLeft: '2.5rem', fontSize: '0.875rem', width: '200px' }}
                  />
                </div>
                {activeTab === 'containers' && (
                  <Link to={`/hosts/${hostId}/containers/create`} className="btn-primary flex items-center gap-2" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>
                    <Plus className="h-4 w-4" /> Create
                  </Link>
                )}
                {activeTab === 'networks' && (
                  <Link to={`/hosts/${hostId}/networks/create`} className="btn-primary flex items-center gap-2" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>
                    <Plus className="h-4 w-4" /> Create
                  </Link>
                )}
                {activeTab === 'volumes' && (
                  <Link to={`/hosts/${hostId}/volumes/create`} className="btn-primary flex items-center gap-2" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>
                    <Plus className="h-4 w-4" /> Create
                  </Link>
                )}
                {activeTab === 'images' && (
                  <span />
                )}
              </div>
            </div>

            {activeTab === 'containers' && (
              filteredContainers.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No containers found</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Image</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Ports</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContainers.map((c: any) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="hover:bg-white/5">
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <Link to={`/hosts/${hostId}/containers/${c.id}`} style={{ color: 'white', textDecoration: 'none', fontWeight: 500 }}>
                              {c.names?.[0]?.replace(/^\//, '') || c.id.slice(0, 12)}
                            </Link>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.875rem', fontFamily: 'monospace' }}>{c.image}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                              backgroundColor: c.state === 'running' ? 'rgba(16,185,129,0.15)' : c.state === 'paused' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
                              color: c.state === 'running' ? '#10b981' : c.state === 'paused' ? '#f59e0b' : '#9ca3af',
                              border: `1px solid ${c.state === 'running' ? 'rgba(16,185,129,0.3)' : c.state === 'paused' ? 'rgba(245,158,11,0.3)' : 'rgba(107,114,128,0.3)'}`
                            }}>
                              {c.state}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.875rem' }}>{formatPorts(c.ports)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              {(c.state === 'exited' || c.state === 'created' || c.state === 'dead') && (
                                <button onClick={() => api.post(`/api/hosts/${hostId}/containers/${c.id}/start`).then(refreshContainers)} className="btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {c.state === 'running' && (
                                <button onClick={() => api.post(`/api/hosts/${hostId}/containers/${c.id}/stop`).then(refreshContainers)} className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', backgroundColor: '#ca8a04' }}>
                                  <Square className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {activeTab === 'networks' && (
              filteredNetworks.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No networks found</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {filteredNetworks.map((n: any) => (
                    <div key={n.id} className="glass-card" style={{ cursor: 'default' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontWeight: 600, color: 'white' }}>{n.name}</h4>
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>{n.driver}</span>
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>{n.id?.slice(0, 12)}</p>
                      {n.scope && <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>Scope: {n.scope}</p>}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'volumes' && (
              filteredVolumes.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No volumes found</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {filteredVolumes.map((v: any) => (
                    <div key={v.name} className="glass-card" style={{ cursor: 'default' }}>
                      <h4 style={{ fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>{v.name}</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>{v.driver}</span>
                        {v.mountpoint && <span style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>{v.mountpoint}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'images' && (
              filteredImages.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No images found</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Repository</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Tag</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredImages.map((i: any) => (
                        <tr key={i.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/5">
                          <td style={{ padding: '0.75rem 1rem', color: 'white', fontFamily: 'monospace', fontSize: '0.875rem' }}>{i.repoTags?.[0]?.split(':')[0] || '<none>'}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.875rem' }}>{i.repoTags?.[0]?.split(':')[1] || 'latest'}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.875rem', textAlign: 'right' }}>{formatBytes(i.size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog title="Delete Host" message={`Are you sure you want to delete "${host.name}"? All associated data will be lost.`} confirmLabel="Delete" onConfirm={handleDeleteHost} onCancel={() => setConfirmDelete(false)} />
      )}
    </div>
  );
};