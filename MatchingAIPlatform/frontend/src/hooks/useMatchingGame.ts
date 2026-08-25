import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { generateLevel } from '../utils/levelGenerators';
import { createThemes } from '../data/gameData';
import { useGameProgress } from './useGameProgress';
import type { GameMode } from '../types/game';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

interface Task {
  id: number;
  requirement: string;
  completed: boolean;
}

export const useMatchingGame = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 基本状态
  const [leftCards, setLeftCards] = useState<Card[]>([]);
  const [rightCards, setRightCards] = useState<Card[]>([]);
  const [tasks] = useState<Task[]>([
    { id: 1, requirement: '匹配红色和紫色', completed: false },
    { id: 2, requirement: '匹配青色和靛色', completed: false },
    { id: 3, requirement: '匹配蓝色和粉色', completed: false },
  ]);

  const [matchHistory, setMatchHistory] = useState<Array<{ left: Card; right: Card }>>([]);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [matchRows, setMatchRows] = useState<Array<{ left: Card | null; right: Card | null; rowId: string }>>([
    { left: null, right: null, rowId: '1' },
    { left: null, right: null, rowId: '2' },
    { left: null, right: null, rowId: '3' },
    { left: null, right: null, rowId: '4' },
    { left: null, right: null, rowId: '5' },
  ]);

  const [scores, setScores] = useState<{ red: number; yellow: number; green: number }>({
    red: 0,
    yellow: 0,
    green: 0,
  });
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showComboEffect, setShowComboEffect] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [lastMatchTime, setLastMatchTime] = useState<number>(0);
  const [usedCards, setUsedCards] = useState<Set<number>>(new Set());
  const [idCounter, setIdCounter] = useState<number>(2000);

  // 获取当前关卡信息 - 优先从URL参数读取，然后从state读取
  const urlLevel = searchParams.get('level');
  const urlTheme = searchParams.get('theme');
  const urlMode = searchParams.get('mode');

  const currentLevel = urlLevel ? parseInt(urlLevel) : (location.state?.level || 1);
  const currentTheme = urlTheme || location.state?.theme || 'addition_subtraction';
  const mode: GameMode = (urlMode as GameMode) || location.state?.mode || 'fixed';
  const fixedPool = mode === 'fixed';

  // 获取模式显示文本
  const getModeDisplayText = (mode: GameMode): string => {
    switch (mode) {
      case 'fixed':
        return '固定模式';
      case 'refresh':
        return '循环模式';
      case 'infinite':
        return '无限模式';
      default:
        return '未知模式';
    }
  };

  const modeDisplay = getModeDisplayText(mode);

  // 获取关卡目标分数
  const getLevelTarget = (level: number) => {
    const targets = [8, 10, 12, 15, 18, 20, 25, 30, 35, 40];
    return targets[level - 1] || 8;
  };

  // 如果level中定义了targetScore（来自createThemes），优先使用它
  const { gameProgress, updateProgress } = useGameProgress();
  const themesFromProgress = createThemes(gameProgress);
  const getLevelTargetFromTheme = (level: number) => {
    const theme = themesFromProgress.find((t) => t.id === currentTheme);
    if (!theme) return getLevelTarget(level);
    const levelObj = theme.levels.find((l) => l.id === level);
    return levelObj?.targetScore || getLevelTarget(level);
  };

  // 检查关卡完成条件
  useEffect(() => {
    const totalMatches = scores.red + scores.yellow + scores.green;
    const targetScore = getLevelTargetFromTheme(currentLevel);

    if (totalMatches >= targetScore && !levelCompleted) {
      setLevelCompleted(true);
      setShowCompletionModal(true);

      // 使用updateProgress保存关卡完成状态
      updateProgress(currentTheme, currentLevel - 1, true);
    }
  }, [scores, currentLevel, currentTheme, levelCompleted, updateProgress]);

  // 初始化关卡
  useEffect(() => {
    // 当关卡或主题变化时，重置游戏相关状态并初始化关卡
    const levelToUse = currentLevel;
    const themeToUse = currentTheme;

    // 先重置游戏状态，防止上一次完成状态残留
    setLevelCompleted(false);
    setShowCompletionModal(false);
    setScores({ red: 0, yellow: 0, green: 0 });
    setCombo(0);
    setMaxCombo(0);
    setLastMatchTime(0);
    setMatchHistory([]);
    setCompletedTasks([]);
    setMatchRows([
      { left: null, right: null, rowId: '1' },
      { left: null, right: null, rowId: '2' },
      { left: null, right: null, rowId: '3' },
      { left: null, right: null, rowId: '4' },
      { left: null, right: null, rowId: '5' },
    ]);
    setUsedCards(new Set());

    if (levelToUse && themeToUse) {
      setIsLoading(true);
      const levelData = generateLevel(levelToUse, 12, themeToUse);
      setLeftCards(levelData.leftCards);
      setRightCards(levelData.rightCards);
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [currentLevel, currentTheme]);

  const handleClear = () => {
    setMatchHistory([]);
    setCompletedTasks([]);
    setMatchRows([
      { left: null, right: null, rowId: '1' },
      { left: null, right: null, rowId: '2' },
      { left: null, right: null, rowId: '3' },
      { left: null, right: null, rowId: '4' },
      { left: null, right: null, rowId: '5' },
    ]);
    setCombo(0);
    setMaxCombo(0);
    setShowComboEffect(false);
    setLastMatchTime(0);
    setUsedCards(new Set());
  };

  const handleContinueToNextLevel = () => {
    setShowCompletionModal(false);
    // 跳转到下一关，保持当前主题
    const nextLevel = currentLevel + 1;
    navigate(`/matching-room?theme=${currentTheme}&level=${nextLevel}&mode=${mode}`);
  };

  const handleBackToThemeSelect = () => {
    setShowCompletionModal(false);
    navigate(`/level-select?theme=${currentTheme}`);
  };

  const totalMatches = scores.red + scores.yellow + scores.green;
  const targetScore = getLevelTarget(currentLevel);
  const progressPercent = Math.min((totalMatches / targetScore) * 100, 100);

  return {
    // 状态
    leftCards,
    setLeftCards,
    rightCards,
    setRightCards,
    tasks,
    matchHistory,
    setMatchHistory,
    completedTasks,
    matchRows,
    setMatchRows,
    scores,
    setScores,
    levelCompleted,
    showCompletionModal,
    setShowCompletionModal,
    showHistoryModal,
    setShowHistoryModal,
    isLoading,
    setIsLoading,
    combo,
    setCombo,
    maxCombo,
    setMaxCombo,
    showComboEffect,
    setShowComboEffect,
    lastMatchTime,
    setLastMatchTime,
    usedCards,
    setUsedCards,
    idCounter,
    setIdCounter,
    currentLevel,
    currentTheme,
    mode,
    fixedPool,
    modeDisplay,
    totalMatches,
    targetScore,
    progressPercent,

    // 方法
    handleClear,
    handleContinueToNextLevel,
    handleBackToThemeSelect,
  };
};