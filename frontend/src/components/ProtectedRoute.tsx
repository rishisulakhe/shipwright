import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getAccessToken, isTokenExpired } from '../utils/auth';

export const ProtectedRoute: React.FC = () => {
  const token = getAccessToken();

  if (!token || isTokenExpired(token)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};