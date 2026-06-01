import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { setTokens, getCurrentUser } from '../utils/auth';
import api from '../services/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'developer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/api/auth/register', formData);
      setTokens(resp.data.access_token, resp.data.refresh_token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full page-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-card-static animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-8 text-center drop-shadow-lg">Register</h2>
        {error && (
          <div className="mb-6 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="mb-5">
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
        <div className="mb-5">
          <label className="glass-label">Email</label>
          <input
            name="email"
            placeholder="Email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="glass-input"
          />
        </div>
        <div className="mb-5">
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
        <div className="mb-8">
          <label className="glass-label">Role</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className="glass-select"
          >
            <option value="viewer">Viewer</option>
            <option value="developer">Developer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-lg"
        >
          {loading ? 'Creating account...' : 'Register'}
        </button>
        <div className="mt-6 text-center">
          <span className="text-gray-400">Already have an account? </span>
          <Link to="/login" className="text-blue-400 hover:underline font-semibold">
            Login
          </Link>
        </div>
      </form>
    </div>
  );
};