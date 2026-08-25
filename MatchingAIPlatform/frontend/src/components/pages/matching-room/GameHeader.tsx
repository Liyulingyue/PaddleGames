import React from 'react';

interface GameHeaderProps {
  currentLevel: number;
  currentTheme: string;
  mode: string;
  totalMatches: number;
  targetScore: number;
  progressPercent: number;
  combo: number;
  maxCombo: number;
  showComboEffect: boolean;
  onClear: () => void;
  onShowHelp: () => void;
  onShowHistory: () => void;
  matchHistoryLength: number;
}

const GameHeader: React.FC<GameHeaderProps> = ({
  currentLevel,
  currentTheme,
  mode,
  totalMatches,
  targetScore,
  progressPercent,
  combo,
  maxCombo,
  showComboEffect,
  onClear,
  onShowHelp,
  onShowHistory,
  matchHistoryLength
}) => {
  return (
    <div className="game-header">
      <div className="header-left">
        <div className="level-indicator">
          <div className="level-badge">第 {currentLevel} 关</div>
          <div className="theme-badge">{currentTheme === 'addition_subtraction' ? '加减法' :
                                       currentTheme === 'multiplication_division' ? '乘除法' : '四则运算'}</div>
          <div className="mode-badge">{mode}</div>
        </div>
      </div>

      <div className="header-center">
        <div className="progress-indicator">
          <div className="progress-text">目标进度: {totalMatches} / {targetScore}</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="combo-display">
          {combo > 1 && (
            <div className={`combo-badge ${showComboEffect ? 'combo-effect' : ''}`}>
              🔥 {combo} 连击
            </div>
          )}
          {maxCombo > 1 && (
            <div className="max-combo">最高: {maxCombo}</div>
          )}
        </div>
        <div className="control-buttons">
          <button className="control-button help-button" onClick={onShowHelp}>
            <span className="button-icon">❓</span>
            帮助
          </button>
          <button className="control-button clear-button" onClick={onClear}>
            <span className="button-icon">🗑️</span>
            清空
          </button>
          <button
            className="control-button history-button"
            onClick={onShowHistory}
          >
            <span className="button-icon">📋</span>
            历史 ({matchHistoryLength})
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameHeader;