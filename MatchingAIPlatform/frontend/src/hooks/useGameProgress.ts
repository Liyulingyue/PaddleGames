import { useState, useEffect } from 'react';
import type { GameProgress } from '../types/game';

export const useGameProgress = () => {
  const [gameProgress, setGameProgress] = useState<GameProgress>({});

  // 从localStorage加载游戏进度
  useEffect(() => {
    const savedProgress = localStorage.getItem('matchingGameProgress');
    if (savedProgress) {
      setGameProgress(JSON.parse(savedProgress));
    }
  }, []);

  // 更新游戏进度
  const updateProgress = (themeId: string, levelIndex: number, completed: boolean) => {
    setGameProgress(prev => {
      const newProgress = { ...prev };
      if (!newProgress[themeId]) {
        newProgress[themeId] = [];
      }
      newProgress[themeId][levelIndex] = completed;
      localStorage.setItem('matchingGameProgress', JSON.stringify(newProgress));
      return newProgress;
    });
  };

  return { gameProgress, setGameProgress, updateProgress };
};