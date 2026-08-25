import React from 'react';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchHistory: Array<{ left: Card; right: Card }>;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, matchHistory }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal">
        <div className="modal-header">
          <h2>📊 匹配历史</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          {matchHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎭</div>
              <p className="empty-text">暂无匹配记录</p>
              <p className="empty-subtext">开始匹配来查看历史记录</p>
            </div>
          ) : (
            <div className="history-grid">
              {matchHistory.map((match, index) => (
                <div key={index} className="history-card">
                  <div className="history-header">
                    <div className="history-number">#{index + 1}</div>
                    <div className="history-time">刚刚</div>
                  </div>
                  <div className="history-match">
                    <div
                      className="history-color-card"
                      style={{ backgroundColor: match.left.color }}
                    >
                      <span className="history-label">{match.left.label}</span>
                    </div>
                    <div className="history-connector">
                      <span className="connector-icon">⚡</span>
                    </div>
                    <div
                      className="history-color-card"
                      style={{ backgroundColor: match.right.color }}
                    >
                      <span className="history-label">{match.right.label}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;