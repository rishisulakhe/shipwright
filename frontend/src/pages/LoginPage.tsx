import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { setTokens, getCurrentUser } from '../utils/auth';
import api from '../services/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/api/auth/login', formData);
      setTokens(resp.data.access_token, resp.data.refresh_token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full page-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-card-static animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-8 text-center drop-shadow-lg">Login</h2>
        {error && (
          <div className="mb-6 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="mb-6">
          <label className="glass-label">Username</label>
          <input
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            className="glass-input"
          />
        </div>
        <div className="mb-8">
          <label className="glass-label">Password</label>
          <input
            name="password"
            placeholder="Password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="glass-input"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-lg"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
        <div className="mt-6 text-center">
          <span className="text-gray-400">Don't have an account? </span>
          <Link to="/register" className="text-blue-400 hover:underline font-semibold">
            Register
          </Link>
        </div>
      </form>
    </div>
  );
};