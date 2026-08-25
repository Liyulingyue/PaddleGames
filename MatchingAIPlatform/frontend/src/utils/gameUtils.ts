export const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty) {
    case '简单': return '#4CAF50';
    case '中等': return '#FF9800';
    case '困难': return '#F44336';
    case '专家': return '#9C27B0';
    default: return '#2196F3';
  }
};