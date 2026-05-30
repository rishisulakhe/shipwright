import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className }) => {
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <div
        className={`${sizes[size]} animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500`}
      />
    </div>
  );
};