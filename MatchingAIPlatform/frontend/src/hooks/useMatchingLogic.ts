import { performMatchWithCards } from '../utils/gameLogic';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface MatchResult {
  isMatch: boolean;
  newCombo: number;
  newLastMatchTime: number;
  newScores: { red: number; yellow: number; green: number };
  shouldCreateParticles: boolean;
}

export const useMatchingLogic = (
  combo: number,
  lastMatchTime: number,
  scores: { red: number; yellow: number; green: number },
  setCombo: (combo: number) => void,
  setMaxCombo: (maxCombo: number) => void,
  setLastMatchTime: (time: number) => void,
  setShowComboEffect: (show: boolean) => void,
  setScores: (scores: { red: number; yellow: number; green: number }) => void,
  setMatchHistory: (history: Array<{ left: Card; right: Card }>) => void,
  matchHistory: Array<{ left: Card; right: Card }>,
  createParticles?: (x: number, y: number, color: string) => void
) => {
  const handleMatch = (leftCard: Card, rightCard: Card): MatchResult => {
    const result = performMatchWithCards(leftCard, rightCard, combo, lastMatchTime, scores);

    if (result.isMatch) {
      // 更新匹配历史
      const newMatch = { left: leftCard, right: rightCard };
      setMatchHistory([...matchHistory, newMatch]);

      // 创建粒子效果
      if (createParticles) {
        const rect = document.querySelector('.matching-center')?.getBoundingClientRect();
        if (rect) {
          createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, leftCard.color);
        }
      }

      // 更新连击
      setCombo(result.newCombo);
      setMaxCombo(Math.max(result.newCombo, combo));
      setLastMatchTime(result.newLastMatchTime);
      setShowComboEffect(true);

      // 短暂显示连击效果
      setTimeout(() => setShowComboEffect(false), 1000);

      // 更新分数
      setScores(result.newScores);
    } else {
      // 匹配失败，重置连击
      setCombo(0);
      setLastMatchTime(0);
      setShowComboEffect(false);
    }

    return result;
  };

  return {
    handleMatch,
  };
};