import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';

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

  const [testResult, setTestResult] = useState<{ connected: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [createdHostId, setCreatedHostId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/hosts', {
        name,
        host_ip: protocol === 'unix' ? '' : hostIP,
        port: protocol === 'unix' ? 0 : port,
        protocol,
        auth_type: authType,
        tls_ca: authType === 'tls' ? tlsCA : '',
        tls_cert: authType === 'tls' ? tlsCert : '',
        tls_key: authType === 'tls' ? tlsKey : '',
        ssh_user: authType === 'ssh' ? sshUser : '',
        ssh_key: authType === 'ssh' ? sshKey : '',
      });
      setCreatedHostId(response.data.id);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create host');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!createdHostId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await api.post(`/api/hosts/${createdHostId}/test-connection`);
      setTestResult(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setTestResult({ connected: false, error: axiosErr.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <h1 className="mb-6 text-2xl font-bold text-white">Add Docker Host</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="My Docker Host"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">Protocol</label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="tcp">TCP</option>
            <option value="unix">Unix Socket</option>
            <option value="ssh">SSH</option>
          </select>
        </div>

        {protocol !== 'unix' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Host IP *</label>
              <input
                type="text"
                value={hostIP}
                onChange={(e) => setHostIP(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="192.168.1.10"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 2375)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">Authentication</label>
          <select
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="none">None</option>
            <option value="tls">TLS</option>
            <option value="ssh">SSH</option>
          </select>
        </div>

        {authType === 'tls' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">CA Certificate</label>
              <textarea
                value={tlsCA}
                onChange={(e) => setTlsCA(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                rows={3}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Client Certificate</label>
              <textarea
                value={tlsCert}
                onChange={(e) => setTlsCert(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                rows={3}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Client Key</label>
              <textarea
                value={tlsKey}
                onChange={(e) => setTlsKey(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                rows={3}
              />
            </div>
          </div>
        )}

        {authType === 'ssh' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">SSH User</label>
              <input
                type="text"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="root"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">SSH Key</label>
              <textarea
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                rows={4}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              />
            </div>
          </div>
        )}

        {createdHostId && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Test Connection
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.connected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.connected ? 'Connected successfully' : testResult.error || 'Connection failed'}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Host
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};