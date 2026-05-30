import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, clearTokens } from '../utils/auth';
import { LogOut, Anchor } from 'lucide-react';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    clearTokens();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Anchor className="h-6 w-6 text-blue-500" />
          <span className="text-lg font-semibold text-white">Shipwright</span>
        </Link>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                  {user.role}
                </span>
                <span className="text-sm text-zinc-400">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};