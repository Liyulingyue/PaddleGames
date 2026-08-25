import React, { useState } from 'react';
import '../styles/MatchingRoom.css';
import GameHeader from '../components/pages/matching-room/GameHeader';
import CardPool from '../components/pages/matching-room/CardPool';
import MatchingCenter from '../components/pages/matching-room/MatchingCenter';
import HistoryModal from '../components/pages/matching-room/HistoryModal';
import CompletionModal from '../components/pages/matching-room/CompletionModal';
import LoadingSpinner from '../components/pages/matching-room/LoadingSpinner';
import ParticleEffect from '../components/pages/matching-room/ParticleEffect';
import HelpModal from '../components/pages/matching-room/HelpModal';
import { useMatchingGame } from '../hooks/useMatchingGame';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useParticleEffect } from '../hooks/useParticleEffect';
import { useMatchingLogic } from '../hooks/useMatchingLogic';
import { generateNewCard } from '../utils/levelGenerators';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

function MatchingRoom() {
  // 使用自定义 hooks
  const gameState = useMatchingGame();
  const dragState = useDragAndDrop();
  const particleState = useParticleEffect();
  const { handleMatch } = useMatchingLogic(
    gameState.combo,
    gameState.lastMatchTime,
    gameState.scores,
    gameState.setCombo,
    gameState.setMaxCombo,
    gameState.setLastMatchTime,
    gameState.setShowComboEffect,
    gameState.setScores,
    gameState.setMatchHistory,
    gameState.matchHistory,
    particleState.createParticles
  );

  const [showHelpModal, setShowHelpModal] = useState(false);

  // 事件处理函数
  const handleDropOnCard = (
    e: React.DragEvent<HTMLDivElement>,
    targetCard: Card
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState.draggedCard) return;

    // 左右卡片需要交叉匹配
    if (dragState.draggedCard.source !== targetCard.type) {
      if (dragState.draggedCard.source === 'left') {
        handleMatch(dragState.draggedCard.card, targetCard);
      } else {
        handleMatch(targetCard, dragState.draggedCard.card);
      }
    }

    dragState.setDraggedCard(null);
  };

  const handleDropOnSlot = (
    e: React.DragEvent<HTMLDivElement>,
    rowId: string,
    slotSide: 'left' | 'right'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState.draggedCard) return;

    // 左侧卡片拖到左侧槽位，右侧卡片拖到右侧槽位
    if (
      (slotSide === 'left' && dragState.draggedCard.source === 'left') ||
      (slotSide === 'right' && dragState.draggedCard.source === 'right')
    ) {
      // 标记卡片为已使用
      gameState.setUsedCards(new Set([...gameState.usedCards, dragState.draggedCard!.card.id]));

      gameState.setMatchRows(
        gameState.matchRows.map((row) => {
          if (row.rowId === rowId) {
            if (slotSide === 'left') {
              const updatedRow = { ...row, left: dragState.draggedCard!.card };
              // 自动匹配如果两侧都有卡片
              if (updatedRow.right) {
                const matchResult = handleMatch(updatedRow.left!, updatedRow.right);
                if (matchResult.isMatch) {
                  // 匹配成功，计算新的卡池
                  let newLeftCards = gameState.leftCards.filter(card => card.id !== updatedRow.left!.id);
                  let newRightCards = gameState.rightCards.filter(card => card.id !== updatedRow.right!.id);
                  const newUsedCards = new Set(gameState.usedCards);
                  newUsedCards.delete(updatedRow.left!.id);
                  newUsedCards.delete(updatedRow.right!.id);
                  if (!gameState.fixedPool) {
                    const newLeftCard = generateNewCard(gameState.currentLevel, gameState.currentTheme, 'left', gameState.idCounter);
                    const newRightCard = generateNewCard(gameState.currentLevel, gameState.currentTheme, 'right', gameState.idCounter + 1);
                    newLeftCards = [...newLeftCards, newLeftCard];
                    newRightCards = [...newRightCards, newRightCard];
                    gameState.setIdCounter(gameState.idCounter + 2);
                  }
                  gameState.setLeftCards(newLeftCards);
                  gameState.setRightCards(newRightCards);
                  gameState.setUsedCards(newUsedCards);
                  return { ...row, left: null, right: null };
                } else {
                  // 匹配失败，清空槽位，卡片仍在卡池中
                  // 移除已使用标记
                  const newUsedCards = new Set(gameState.usedCards);
                  newUsedCards.delete(updatedRow.left!.id);
                  newUsedCards.delete(updatedRow.right.id);
                  gameState.setUsedCards(newUsedCards);
                  return { ...row, left: null, right: null };
                }
              }
              return updatedRow;
            } else {
              const updatedRow = { ...row, right: dragState.draggedCard!.card };
              // 自动匹配如果两侧都有卡片
              if (updatedRow.left) {
                const matchResult = handleMatch(updatedRow.left, updatedRow.right!);
                if (matchResult.isMatch) {
                  // 匹配成功，计算新的卡池
                  let newLeftCards = gameState.leftCards.filter(card => card.id !== updatedRow.left!.id);
                  let newRightCards = gameState.rightCards.filter(card => card.id !== updatedRow.right!.id);
                  const newUsedCards = new Set(gameState.usedCards);
                  newUsedCards.delete(updatedRow.left!.id);
                  newUsedCards.delete(updatedRow.right!.id);
                  if (!gameState.fixedPool) {
                    const newLeftCard = generateNewCard(gameState.currentLevel, gameState.currentTheme, 'left', gameState.idCounter);
                    const newRightCard = generateNewCard(gameState.currentLevel, gameState.currentTheme, 'right', gameState.idCounter + 1);
                    newLeftCards = [...newLeftCards, newLeftCard];
                    newRightCards = [...newRightCards, newRightCard];
                    gameState.setIdCounter(gameState.idCounter + 2);
                  }
                  gameState.setLeftCards(newLeftCards);
                  gameState.setRightCards(newRightCards);
                  gameState.setUsedCards(newUsedCards);
                  return { ...row, left: null, right: null };
                } else {
                  // 匹配失败，清空槽位，卡片仍在卡池中
                  // 移除已使用标记
                  const newUsedCards = new Set(gameState.usedCards);
                  newUsedCards.delete(updatedRow.left.id);
                  newUsedCards.delete(updatedRow.right!.id);
                  gameState.setUsedCards(newUsedCards);
                  return { ...row, left: null, right: null };
                }
              }
              return updatedRow;
            }
          }
          return row;
        })
      );
    }

    dragState.setDraggedCard(null);
  };

  const handleClearWithParticles = () => {
    // 清空槽位和已使用标记
    gameState.handleClear();
    particleState.clearParticles();
  };

  const handleDragStartFromSlot = (
    _e: React.DragEvent<HTMLDivElement>,
    card: Card,
    _source: 'slot',
    rowId: string,
    slotSide: 'left' | 'right'
  ) => {
    // 从匹配槽位开始拖拽时，移除该槽位中的卡片
    gameState.setMatchRows(
      gameState.matchRows.map((row) => {
        if (row.rowId === rowId) {
          if (slotSide === 'left') {
            return { ...row, left: null };
          } else {
            return { ...row, right: null };
          }
        }
        return row;
      })
    );

    // 移除卡片的已使用标记
    const newUsedCards = new Set(gameState.usedCards);
    newUsedCards.delete(card.id);
    gameState.setUsedCards(newUsedCards);

    // 设置拖拽状态
    dragState.setDraggedCard({
      card,
      source: slotSide
    });
  };

  return (
    <div className="matching-room">
      {/* 粒子效果 */}
      <ParticleEffect particles={particleState.particles} />

      {/* 加载动画 */}
      <LoadingSpinner isLoading={gameState.isLoading} />

      {/* 顶部状态栏 */}
      <GameHeader
        currentLevel={gameState.currentLevel}
        currentTheme={gameState.currentTheme}
        mode={gameState.modeDisplay}
        totalMatches={gameState.totalMatches}
        targetScore={gameState.targetScore}
        progressPercent={gameState.progressPercent}
        combo={gameState.combo}
        maxCombo={gameState.maxCombo}
        showComboEffect={gameState.showComboEffect}
        onClear={handleClearWithParticles}
        onShowHelp={() => setShowHelpModal(true)}
        onShowHistory={() => gameState.setShowHistoryModal(true)}
        matchHistoryLength={gameState.matchHistory.length}
      />

      {/* 主要游戏区域 */}
      <div className="main-content">
        {/* 左侧卡池 */}
        <CardPool
          title="左卡池"
          cards={gameState.leftCards}
          draggedCard={dragState.draggedCard?.card || null}
          onDragStart={dragState.handleDragStart}
          onDragEnd={dragState.handleDragEnd}
          usedCards={gameState.usedCards}
        />

        {/* 中间匹配区 */}
        <MatchingCenter
          matchRows={gameState.matchRows}
          onDragOver={dragState.handleDragOver}
          onDragLeave={dragState.handleDragLeave}
          onDrop={handleDropOnSlot}
          onDragStart={handleDragStartFromSlot}
          draggedCard={dragState.draggedCard?.card || null}
        />

        {/* 右侧卡池 */}
        <CardPool
          title="右卡池"
          cards={gameState.rightCards}
          draggedCard={dragState.draggedCard?.card || null}
          onDragStart={dragState.handleDragStart}
          onDragEnd={dragState.handleDragEnd}
          onDragOver={dragState.handleDragOver}
          onDrop={handleDropOnCard}
          usedCards={gameState.usedCards}
        />
      </div>

        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
        />

      {/* 匹配历史弹窗 */}
      <HistoryModal
        isOpen={gameState.showHistoryModal}
        onClose={() => gameState.setShowHistoryModal(false)}
        matchHistory={gameState.matchHistory}
      />

      {/* 关卡完成弹窗 */}
      <CompletionModal
        isOpen={gameState.showCompletionModal}
        onClose={() => gameState.setShowCompletionModal(false)}
        onContinue={gameState.handleContinueToNextLevel}
        onBackToTheme={gameState.handleBackToThemeSelect}
        currentLevel={gameState.currentLevel}
        scores={gameState.scores}
        totalMatches={gameState.totalMatches}
        maxCombo={gameState.maxCombo}
      />
    </div>
  );
}

export default MatchingRoom;