import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';

export const SplashPage: React.FC = () => {
  const user = getCurrentUser();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden page-bg">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-700 opacity-30 rounded-full blur-3xl" style={{ animation: 'blob 8s ease-in-out infinite alternate' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cyan-400 opacity-20 rounded-full blur-3xl" style={{ animation: 'blob 14s ease-in-out infinite alternate-reverse' }} />
        <div className="absolute top-[30%] left-[60%] w-[30vw] h-[30vw] bg-indigo-500 opacity-20 rounded-full blur-2xl" style={{ animation: 'blob 10s ease-in-out infinite alternate' }} />
      </div>

      <div className="relative z-10 glass-card-static flex flex-col items-center animate-fade-in" style={{ maxWidth: '36rem' }}>
        <div className="mb-8">
          <svg className="w-20 h-20 mx-auto text-blue-400 drop-shadow-lg" style={{ filter: 'drop-shadow(0 4px 24px rgba(59, 130, 246, 0.5))' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-3 text-center drop-shadow-lg">
          Shipwright
        </h1>
        <p className="text-xl text-blue-200 mb-2 text-center font-semibold">
          Unified Docker Management, Simplified
        </p>
        <p className="text-lg text-gray-300 mb-10 text-center max-w-lg">
          Manage your Docker hosts, containers, networks, and volumes with a secure, modern interface. Fast, intuitive, and built for teams.
        </p>
        <div className="flex gap-8 w-full justify-center">
          <Link to="/login" className="btn-primary text-lg px-10 py-4 rounded-xl shadow-lg">
            Login
          </Link>
          <Link to="/register" className="btn-secondary text-lg px-10 py-4 rounded-xl shadow-lg">
            Register
          </Link>
        </div>
      </div>
      <div className="mt-12 text-gray-500 text-sm z-10 animate-fade-in-delay">
        &copy; {new Date().getFullYear()} Shipwright
      </div>
    </div>
  );
};