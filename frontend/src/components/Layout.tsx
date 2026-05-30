import React from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="pt-20 px-4 pb-8 lg:px-6">{children}</main>
    </div>
  );
};