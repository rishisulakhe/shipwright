import { useState, useEffect } from 'react';
import api from '../services/api';
import { getCurrentUser } from '../utils/auth';

interface AuthUser {
  userId: string;
  username: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { access_token, refresh_token } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    const currentUser = getCurrentUser();
    setUser(currentUser);
    return response.data;
  };

  const register = async (username: string, email: string, password: string, role: string) => {
    const response = await api.post('/api/auth/register', { username, email, password, role });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return { user, loading, login, register, logout };
}