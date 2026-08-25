import React from 'react';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  onBackToTheme: () => void;
  currentLevel: number;
  scores: { red: number; yellow: number; green: number };
  totalMatches: number;
  maxCombo: number;
}

const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  onBackToTheme,
  currentLevel,
  scores,
  totalMatches,
  maxCombo
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content completion-modal">
        <div className="modal-header">
          <h2>🎉 关卡完成！</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="completion-stats">
            <div className="completion-score">
              <h3>🏆 完成分数</h3>
              <div className="score-breakdown">
                <div className="score-item">
                  <div className="score-color" style={{ backgroundColor: '#FF4D4D' }}></div>
                  <span>红色匹配: {scores.red}</span>
                </div>
                <div className="score-item">
                  <div className="score-color" style={{ backgroundColor: '#F1C40F' }}></div>
                  <span>黄色匹配: {scores.yellow}</span>
                </div>
                <div className="score-item">
                  <div className="score-color" style={{ backgroundColor: '#2ECC71' }}></div>
                  <span>绿色匹配: {scores.green}</span>
                </div>
                <div className="score-total">
                  总分: {totalMatches}
                  {maxCombo > 1 && <span className="combo-bonus"> (连击最高: {maxCombo})</span>}
                </div>
              </div>
            </div>
            <div className="completion-message">
              <p>🎊 恭喜你完成了第 {currentLevel} 关！</p>
              <p>🎮 继续挑战更多关卡吧！</p>
            </div>
          </div>
          <div className="completion-actions">
            <button
              className="completion-button primary"
              onClick={onContinue}
            >
              🚀 继续挑战下一关
            </button>
            <button
              className="completion-button secondary"
              onClick={onBackToTheme}
            >
              🏠 返回主题选择
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompletionModal;