import React from 'react';
import LevelCard from './LevelCard';
import type { GameMode } from '../../../types/game';

interface Level {
  id: number;
  title: string;
  description: string;
  difficulty: '简单' | '中等' | '困难' | '专家';
  unlocked: boolean;
  rules: string[];
  timeLimit?: number;
  targetScore?: number;
  completed?: boolean;
  mode: GameMode;
}

interface LevelGridProps {
  levels: Level[];
  onLevelSelect: (level: Level) => void;
  getDifficultyColor: (difficulty: string) => string;
}

const LevelGrid: React.FC<LevelGridProps> = ({ levels, onLevelSelect, getDifficultyColor }) => {
  return (
    <div className="level-grid">
      {levels.map((level) => (
        <LevelCard
          key={level.id}
          level={level}
          onSelect={() => onLevelSelect(level)}
          getDifficultyColor={getDifficultyColor}
        />
      ))}
    </div>
  );
};

export default LevelGrid;