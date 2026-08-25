import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/LevelSelect.css';
import ThemeSelector from '../components/pages/level-select/ThemeSelector';
import LevelGrid from '../components/pages/level-select/LevelGrid';
import LevelHeader from '../components/pages/level-select/LevelHeader';
import ThemeHeader from '../components/pages/level-select/ThemeHeader';
import type { Theme, Level } from '../types/game';
import { createThemes } from '../data/gameData';
import { getDifficultyColor } from '../utils/gameUtils';
import { useGameProgress } from '../hooks/useGameProgress';

function LevelSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { gameProgress } = useGameProgress();
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  // 根据游戏进度动态生成主题数据
  const themes = createThemes(gameProgress);

  // 从URL参数中读取主题和关卡信息
  useEffect(() => {
    const themeParam = searchParams.get('theme');
    const levelParam = searchParams.get('level');

    if (themeParam && levelParam) {
      // 如果同时有theme和level参数，直接跳转到关卡
      const theme = themes.find(t => t.id === themeParam);
      if (theme) {
        const levelNumber = parseInt(levelParam);
        const level = theme.levels.find(l => l.id === levelNumber);
        if (level && level.unlocked) {
          navigate(`/matching-room?theme=${theme.id}&level=${level.id}&mode=${level.mode}`);
          return;
        }
      }
    }

    // 只有theme参数时，设置选中的主题
    if (themeParam && !levelParam) {
      const theme = themes.find(t => t.id === themeParam);
      if (theme) {
        // 仅在当前选中的主题不同时更新，避免无限循环
        if (!selectedTheme || selectedTheme.id !== theme.id) {
          setSelectedTheme(theme);
        }
      }
    }
  }, [searchParams, themes, selectedTheme]); // 移除navigate依赖并加入selectedTheme检查

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
    // 更新URL参数
    navigate(`/level-select?theme=${theme.id}`, { replace: true });
  };

  const handleLevelSelect = (level: Level) => {
    navigate(`/matching-room?theme=${selectedTheme?.id}&level=${level.id}&mode=${level.mode}`);
  };

  const handleBackToThemes = () => {
    setSelectedTheme(null);
    // 清除URL参数
    navigate('/level-select', { replace: true });
  };

  if (selectedTheme) {
    // 显示关卡选择界面
    return (
      <div className="level-select-container">
        <LevelHeader theme={selectedTheme} />

        <LevelGrid
          levels={selectedTheme.levels}
          onLevelSelect={handleLevelSelect}
          getDifficultyColor={getDifficultyColor}
        />

        <button className="back-button" onClick={handleBackToThemes}>
          ← 返回主题选择
        </button>
      </div>
    );
  }

  // 显示主题选择界面
  return (
    <div className="level-select-container">
      <ThemeHeader />

      <ThemeSelector
        themes={themes}
        onThemeSelect={handleThemeSelect}
      />
    </div>
  );
}

export default LevelSelect;