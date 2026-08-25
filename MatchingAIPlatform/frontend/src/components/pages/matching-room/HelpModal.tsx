import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay help-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>❓ 游戏帮助</h2>
          <button className="modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body help-modal-body">
          <section className="help-section">
            <h3>🎯 游戏目标</h3>
            <p>将左右两侧卡片拖拽到中间匹配槽位，完成正确的知识点匹配以提升分数。</p>
          </section>

          <section className="help-section">
            <h3>🕹️ 基本操作</h3>
            <ul>
              <li>从任意卡池拖拽一张卡片到对应侧的匹配槽位。</li>
              <li>你可以在匹配槽中再次拖动卡片，将其放回卡池或移动到其他位置。</li>
              <li>当左右两侧都放入卡片时，会自动判定是否匹配成功。</li>
              <li><strong>重要：</strong>只有相同颜色的方块才能消除！即使数值相同，如果颜色不同也不会匹配。</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>🔥 进阶提示</h3>
            <ul>
              <li>连续成功匹配会触发连击，提高分数效率。</li>
              <li>达到进度条所示的目标次数即可完成当前关卡。</li>
              <li>使用顶部的“清空”按钮可以快速重置当前匹配状态。</li>
              <li>点击“历史”可以查看本关内所有已完成的匹配记录。</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
