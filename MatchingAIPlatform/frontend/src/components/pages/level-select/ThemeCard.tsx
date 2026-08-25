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

interface ThemeCardProps {
  theme: Theme;
  onClick: () => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ theme, onClick }) => {
  return (
    <div
      className="theme-card"
      onClick={onClick}
      style={{ borderLeftColor: theme.color }}
    >
      <div className="theme-header">
        <div className="theme-icon" style={{ backgroundColor: theme.color }}>
          {theme.icon}
        </div>
        <div className="theme-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(theme.completedLevels / theme.totalLevels) * 100}%`,
                backgroundColor: theme.color
              }}
            ></div>
          </div>
          <span className="progress-text">
            {theme.completedLevels}/{theme.totalLevels}
          </span>
        </div>
      </div>

      <div className="theme-title">{theme.name}</div>
      <div className="theme-desc">{theme.description}</div>

      <div className="theme-stats">
        <div className="theme-stat">
          <span className="stat-icon">🎯</span>
          <span>{theme.totalLevels} 关卡</span>
        </div>
        <div className="theme-stat">
          <span className="stat-icon">✅</span>
          <span>{theme.completedLevels} 已完成</span>
        </div>
      </div>
    </div>
  );
};

export default ThemeCard;