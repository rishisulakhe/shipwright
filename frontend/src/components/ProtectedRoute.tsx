import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getAccessToken, isTokenExpired } from '../utils/auth';
import { Navbar } from './Navbar';

export const ProtectedRoute: React.FC = () => {
  const token = getAccessToken();

  if (!token || isTokenExpired(token)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Navbar />
      <main className="ml-0 min-h-screen bg-zinc-950 p-6 pt-20 lg:ml-64 lg:p-8">
        <Outlet />
      </main>
    </>
  );
};