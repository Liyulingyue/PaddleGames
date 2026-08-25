import React from 'react';
import ThemeCard from './ThemeCard';

interface Theme {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  levels: any[];
  totalLevels: number;
  completedLevels: number;
}

interface ThemeSelectorProps {
  themes: Theme[];
  onThemeSelect: (theme: Theme) => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ themes, onThemeSelect }) => {
  return (
    <div className="theme-grid">
      {themes.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          onClick={() => onThemeSelect(theme)}
        />
      ))}
    </div>
  );
};

export default ThemeSelector;