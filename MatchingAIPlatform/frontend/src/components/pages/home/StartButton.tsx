import React from 'react';

interface StartButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

const StartButton: React.FC<StartButtonProps> = ({ onClick, children }) => {
  return (
    <button className="start-button" onClick={onClick}>
      {children}
    </button>
  );
};

export default StartButton;