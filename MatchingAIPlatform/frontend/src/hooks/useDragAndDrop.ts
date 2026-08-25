import { useState } from 'react';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface DraggedCard {
  card: Card;
  source: 'left' | 'right';
}

export const useDragAndDrop = () => {
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);

  const handleDragStart = (card: Card, source: 'left' | 'right') => {
    setDraggedCard({ card, source });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  return {
    draggedCard,
    setDraggedCard,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
  };
};