import React from 'react';

interface HomeTitleProps {
  children: React.ReactNode;
}

const HomeTitle: React.FC<HomeTitleProps> = ({ children }) => {
  return (
    <h1>{children}</h1>
  );
};

export default HomeTitle;