import React from 'react';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface CardPoolProps {
  title: string;
  cards: Card[];
  draggedCard: Card | null;
  onDragStart: (card: Card, source: 'left' | 'right') => void;
  onDragEnd: () => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, card: Card) => void;
  usedCards: Set<number>;
}

const CardPool: React.FC<CardPoolProps> = ({
  title,
  cards,
  draggedCard,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  usedCards
}) => {
  return (
    <div className="card-pool">
      <div className="pool-header">
        <h3>{title}</h3>
        <div className="card-count">{cards.length} 张</div>
      </div>
      <div className="cards-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`card ${draggedCard?.id === card.id ? 'dragging' : ''} ${card.isMatched ? 'matched' : ''} ${usedCards.has(card.id) ? 'used' : ''}`}
            style={{
              backgroundColor: card.color,
              animationDelay: `${card.animationDelay}ms`
            }}
            draggable={!card.isMatched && !usedCards.has(card.id)}
            onDragStart={() => onDragStart(card, card.type)}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop ? (e) => onDrop(e, card) : undefined}
            title={card.type === 'left' ? "拖拽到右侧匹配" : "拖拽到左侧匹配"}
          >
            <div className="card-content">
              <span className="card-label">{card.label}</span>
              <div className="card-glow"></div>
            </div>
            <div className="card-border"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardPool;