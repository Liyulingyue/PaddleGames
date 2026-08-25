import React from 'react';

interface HomeDescriptionProps {
  children: React.ReactNode;
}

const HomeDescription: React.FC<HomeDescriptionProps> = ({ children }) => {
  return (
    <p>{children}</p>
  );
};

export default HomeDescription;