import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

export const CreateHostPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [hostIP, setHostIP] = useState('');
  const [port, setPort] = useState(2375);
  const [protocol, setProtocol] = useState('tcp');
  const [authType, setAuthType] = useState('none');
  const [tlsCA, setTlsCA] = useState('');
  const [tlsCert, setTlsCert] = useState('');
  const [tlsKey, setTlsKey] = useState('');
  const [sshUser, setSshUser] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: any = { name, host_ip: hostIP, port, protocol, auth_type: authType };
      if (authType === 'tls') { payload.tls_ca = tlsCA; payload.tls_cert = tlsCert; payload.tls_key = tlsKey; }
      if (authType === 'ssh') { payload.ssh_user = sshUser; payload.ssh_key = sshKey; }
      await api.post('/api/hosts', payload);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create host');
    } finally { setLoading(false); }
  };

  const handleTest = async () => {
    setError('');
    setTestResult(null);
    try {
      const payload: any = { name, host_ip: hostIP, port, protocol, auth_type: authType };
      if (authType === 'tls') { payload.tls_ca = tlsCA; payload.tls_cert = tlsCert; payload.tls_key = tlsKey; }
      if (authType === 'ssh') { payload.ssh_user = sshUser; payload.ssh_key = sshKey; }
      const resp = await api.post('/api/hosts', payload);
      const hostId = resp.data.id;
      const testResp = await api.post(`/api/hosts/${hostId}/test-connection`);
      setTestResult({ ok: true, msg: testResp.data.connected ? 'Connected!' : 'Failed' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setTestResult({ ok: false, msg: axiosErr.response?.data?.error || 'Connection failed' });
    }
  };

  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '40rem', margin: '0 auto' }}>
          <Link to="/dashboard" className="btn-secondary flex items-center gap-2 mb-6" style={{ fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex' }}>
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>

          <div className="glass-card-static animate-fade-in">
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'white', marginBottom: '2rem', textAlign: 'center' }}>Register New Host</h2>

            {error && (
              <div className="mb-6 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="glass-label">Host Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="my-docker-host" className="glass-input" />
              </div>

              <div className="mb-5">
                <label className="glass-label">Host IP / Socket Path</label>
                <input value={hostIP} onChange={(e) => setHostIP(e.target.value)} required placeholder="192.168.1.100 or /var/run/docker.sock" className="glass-input" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-5">
                <div>
                  <label className="glass-label">Port</label>
                  <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} placeholder="2375" className="glass-input" />
                </div>
                <div>
                  <label className="glass-label">Protocol</label>
                  <select value={protocol} onChange={(e) => setProtocol(e.target.value)} className="glass-select">
                    <option value="tcp">TCP</option>
                    <option value="unix">Unix Socket</option>
                    <option value="ssh">SSH</option>
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="glass-label">Authentication</label>
                <select value={authType} onChange={(e) => setAuthType(e.target.value)} className="glass-select">
                  <option value="none">None</option>
                  <option value="tls">TLS</option>
                  <option value="ssh">SSH</option>
                </select>
              </div>

              {authType === 'tls' && (
                <div className="mb-5 space-y-4" style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div><label className="glass-label">CA Certificate</label><textarea value={tlsCA} onChange={(e) => setTlsCA(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----..." className="glass-input" style={{ resize: 'vertical' }} /></div>
                  <div><label className="glass-label">Client Certificate</label><textarea value={tlsCert} onChange={(e) => setTlsCert(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----..." className="glass-input" style={{ resize: 'vertical' }} /></div>
                  <div><label className="glass-label">Client Key</label><textarea value={tlsKey} onChange={(e) => setTlsKey(e.target.value)} rows={3} placeholder="-----BEGIN PRIVATE KEY-----..." className="glass-input" style={{ resize: 'vertical' }} /></div>
                </div>
              )}

              {authType === 'ssh' && (
                <div className="mb-5 space-y-4" style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div><label className="glass-label">SSH User</label><input value={sshUser} onChange={(e) => setSshUser(e.target.value)} placeholder="root" className="glass-input" /></div>
                  <div><label className="glass-label">SSH Private Key</label><textarea value={sshKey} onChange={(e) => setSshKey(e.target.value)} rows={3} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." className="glass-input" style={{ resize: 'vertical' }} /></div>
                </div>
              )}

              {testResult && (
                <div className={`mb-5 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${testResult.ok ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.msg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? 'Creating...' : 'Save Host'}
                </button>
                <button type="button" onClick={handleTest} disabled={loading || !hostIP} className="btn-secondary flex-1 py-3">
                  Test Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};