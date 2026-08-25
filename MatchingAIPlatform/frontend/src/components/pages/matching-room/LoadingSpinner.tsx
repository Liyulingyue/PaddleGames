import React from 'react';

interface LoadingSpinnerProps {
  isLoading: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="loading-text">生成关卡中...</div>
      </div>
    </div>
  );
};

export default LoadingSpinner;