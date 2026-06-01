import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
};