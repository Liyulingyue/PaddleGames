import React from 'react';
import MatchSlot from './MatchSlot';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface MatchAreaProps {
  title: string;
  rows: Array<{ left: Card | null; right: Card | null; rowId: string }>;
  side: 'left' | 'right';
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, rowId: string, slotSide: 'left' | 'right') => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, card: Card, source: 'slot', rowId: string, slotSide: 'left' | 'right') => void;
  onClick?: (rowId: string, slotSide: 'left' | 'right') => void;
  draggedCard: Card | null;
}

const MatchArea: React.FC<MatchAreaProps> = ({ title, rows, side, onDragOver, onDragLeave, onDrop, onDragStart, onClick, draggedCard }) => {
  return (
    <div className={`match-area ${side}-match-area`}>
      <div className="match-area-title">{title}</div>
      <div className="match-rows">
        {rows.map((row) => (
          <div key={row.rowId} className="match-row">
            {side === 'left' ? (
              <MatchSlot
                card={row.left}
                side="left"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragStart={onDragStart}
                onClick={onClick}
                rowId={row.rowId}
                draggedCard={draggedCard}
              />
            ) : (
              <MatchSlot
                card={row.right}
                side="right"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragStart={onDragStart}
                onClick={onClick}
                rowId={row.rowId}
                draggedCard={draggedCard}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchArea;