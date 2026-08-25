interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

// 检测连击
export const detectCombo = (currentTime: number, lastMatchTime: number, combo: number): number => {
  const timeDiff = currentTime - lastMatchTime;
  // 如果两次匹配间隔小于2秒，认为是在连击
  if (timeDiff < 2000 && combo > 0) {
    return combo + 1;
  }
  return 1; // 重置为1
};

// 评估表达式结果
export const evalExpression = (expr: string): number => {
  expr = expr.replace(/\s+/g, '');
  if (expr.includes('+')) {
    const parts = expr.split('+');
    return Number(parts[0]) + Number(parts[1]);
  }
  if (expr.includes('-')) {
    const parts = expr.split('-');
    return Number(parts[0]) - Number(parts[1]);
  }
  if (expr.includes('×') || expr.includes('*')) {
    const parts = expr.replace('×', '*').split('*');
    return Number(parts[0]) * Number(parts[1]);
  }
  if (expr.includes('÷') || expr.includes('/')) {
    const parts = expr.replace('÷', '/').split('/');
    return Number(parts[0]) / Number(parts[1]);
  }
  return NaN;
};

// 执行匹配逻辑
export const performMatchWithCards = (
  leftCard: Card,
  rightCard: Card,
  currentCombo: number,
  lastMatchTime: number,
  scores: { red: number; yellow: number; green: number }
): {
  isMatch: boolean;
  newCombo: number;
  newLastMatchTime: number;
  newScores: { red: number; yellow: number; green: number };
  shouldCreateParticles: boolean;
} => {
  const leftVal = evalExpression(leftCard.label);
  const rightVal = evalExpression(rightCard.label);

  const isNumericMatch = !Number.isNaN(leftVal) && !Number.isNaN(rightVal) ? leftVal === rightVal : false;
  const isColorMatch = leftCard.color === rightCard.color;
  const isMatch = isNumericMatch && isColorMatch;

  if (isMatch) {
    const currentTime = Date.now();
    const newCombo = detectCombo(currentTime, lastMatchTime, currentCombo);
    const newLastMatchTime = currentTime;

    // 更新分数
    const redHex = '#FF4D4D';
    const yellowHex = '#F1C40F';
    const greenHex = '#2ECC71';

    let newScores = { ...scores };
    if (leftCard.color === redHex) newScores.red += 1;
    if (leftCard.color === yellowHex) newScores.yellow += 1;
    if (leftCard.color === greenHex) newScores.green += 1;

    return {
      isMatch: true,
      newCombo,
      newLastMatchTime,
      newScores,
      shouldCreateParticles: true,
    };
  } else {
    return {
      isMatch: false,
      newCombo: 0,
      newLastMatchTime: 0,
      newScores: scores,
      shouldCreateParticles: false,
    };
  }
};

// 洗牌数组
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};