import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';
import { Anchor, LogIn, UserPlus } from 'lucide-react';

export const SplashPage: React.FC = () => {
  const user = getCurrentUser();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 ring-1 ring-blue-600/20">
            <Anchor className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">
          Docker Dashboard
        </h1>
        <p className="mb-10 text-zinc-400">
          Manage multiple Docker hosts from one dashboard.
          <br />
          Monitor containers, stream logs, and control your infrastructure.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-500"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <UserPlus className="h-4 w-4" />
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};