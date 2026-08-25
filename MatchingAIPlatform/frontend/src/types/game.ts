export type GameMode = 'fixed' | 'refresh' | 'infinite';

export interface Level {
  id: number;
  title: string;
  description: string;
  difficulty: '简单' | '中等' | '困难' | '专家';
  unlocked: boolean;
  rules: string[];
  timeLimit?: number;
  targetScore?: number;
  completed?: boolean;
  mode: GameMode;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  levels: Level[];
  totalLevels: number;
  completedLevels: number;
}

export type GameProgress = Record<string, boolean[]>;