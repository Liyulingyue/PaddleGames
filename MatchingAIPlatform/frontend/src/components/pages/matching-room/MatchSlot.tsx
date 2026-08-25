import React from 'react';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface MatchSlotProps {
  card: Card | null;
  side: 'left' | 'right';
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, rowId: string, slotSide: 'left' | 'right') => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: Card, source: 'slot', rowId: string, slotSide: 'left' | 'right') => void;
  onClick?: (rowId: string, slotSide: 'left' | 'right') => void;
  rowId: string;
  draggedCard: Card | null;
}

const MatchSlot: React.FC<MatchSlotProps> = ({
  card,
  side,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onClick,
  rowId,
  draggedCard
}) => {

  return (
    <div
      className={`match-slot ${side}-slot`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, rowId, side)}
      onClick={onClick && !card ? () => onClick(rowId, side) : undefined}
    >
      {card ? (
        <div
          className={`selected-card ${draggedCard?.id === card.id ? 'dragging' : ''}`}
          style={{ backgroundColor: card.color }}
          draggable
          onDragStart={(e) => onDragStart(e, card!, 'slot', rowId, side)}
        >
          <div className="card-content">
            <span>{card.label}</span>
            <div className="card-glow"></div>
          </div>
        </div>
      ) : (
        <div className="slot-hint">
          <div className="hint-icon">{side === 'left' ? '⬅️' : '➡️'}</div>
          <div className="hint-text">拖拽或点击</div>
        </div>
      )}
    </div>
  );
};

export default MatchSlot;