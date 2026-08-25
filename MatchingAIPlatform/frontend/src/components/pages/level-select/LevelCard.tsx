import React from 'react';
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

interface LevelCardProps {
  level: Level;
  onSelect: () => void;
  getDifficultyColor: (difficulty: string) => string;
}

const LevelCard: React.FC<LevelCardProps> = ({ level, onSelect, getDifficultyColor }) => {
  const getModeDisplayText = (mode: GameMode): string => {
    switch (mode) {
      case 'fixed':
        return '固定模式';
      case 'refresh':
        return '循环模式';
      case 'infinite':
        return '无限模式';
      default:
        return '未知模式';
    }
  };

  return (
    <div
      className={`level-card ${!level.unlocked ? 'level-locked' : ''} ${level.completed ? 'level-completed' : ''}`}
    >
      <div className="level-header">
        <div className="level-number">#{level.id}</div>
        <div
          className="level-difficulty"
          style={{ backgroundColor: getDifficultyColor(level.difficulty) }}
        >
          {level.difficulty}
        </div>
        <div className="level-mode">
          {getModeDisplayText(level.mode)}
        </div>
      </div>

      <div className="level-title">{level.title}</div>
      <div className="level-desc">{level.description}</div>

      <div className="level-rules">
        <h4>规则说明：</h4>
        <ul>
          {level.rules.map((rule, index) => (
            <li key={index}>{rule}</li>
          ))}
        </ul>
        {level.timeLimit && (
          <div className="time-limit">⏱️ 时间限制：{level.timeLimit}秒</div>
        )}
        {level.targetScore && (
          <div className="target-score">🎯 目标分数：{level.targetScore}分</div>
        )}
      </div>

      <div className="level-actions">
        <button
          className="level-button"
          onClick={onSelect}
          disabled={!level.unlocked}
        >
          {level.completed ? '🔄 再次挑战' : level.unlocked ? '开始挑战' : '🔒 未解锁'}
        </button>
      </div>
    </div>
  );
};

export default LevelCard;