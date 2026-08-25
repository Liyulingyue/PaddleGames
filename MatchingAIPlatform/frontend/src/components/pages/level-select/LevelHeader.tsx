import React from 'react';

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

interface LevelHeaderProps {
  theme: Theme;
}

const LevelHeader: React.FC<LevelHeaderProps> = ({ theme }) => {
  return (
    <div className="level-select-header">
      <h1 style={{ color: theme.color }}>
        {theme.icon} {theme.name}
      </h1>
      <p>{theme.description}</p>
      <div className="level-stats">
        <div className="stat-item">
          <span className="stat-icon">🎯</span>
          <span>{theme.completedLevels}/{theme.totalLevels} 关卡</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">⭐</span>
          <span>进度: {Math.round((theme.completedLevels / theme.totalLevels) * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default LevelHeader;