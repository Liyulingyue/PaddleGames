import { create } from 'zustand'
import type { PoseTemplate } from '@/utils/poseMatcher'

interface GameStore {
  currentTemplate: PoseTemplate | null
  score: number
  combo: number
  maxCombo: number
  matchPercent: number
  isPlaying: boolean
  timeLeft: number
  totalTime: number

  setCurrentTemplate: (template: PoseTemplate) => void
  setScore: (score: number) => void
  addScore: (points: number) => void
  setCombo: (combo: number) => void
  addCombo: () => void
  resetCombo: () => void
  setMatchPercent: (percent: number) => void
  setIsPlaying: (playing: boolean) => void
  setTimeLeft: (time: number | ((prev: number) => number)) => void
  setTotalTime: (time: number) => void
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  currentTemplate: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  matchPercent: 0,
  isPlaying: false,
  timeLeft: 30,
  totalTime: 30,

  setCurrentTemplate: (template) => set({ currentTemplate: template }),
  setScore: (score) => set({ score }),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  setCombo: (combo) =>
    set((state) => ({
      combo,
      maxCombo: Math.max(state.maxCombo, combo),
    })),
  addCombo: () =>
    set((state) => ({
      combo: state.combo + 1,
      maxCombo: Math.max(state.maxCombo, state.combo + 1),
    })),
  resetCombo: () => set({ combo: 0 }),
  setMatchPercent: (matchPercent) => set({ matchPercent }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setTimeLeft: (timeLeft: number | ((prev: number) => number)) =>
    set((state) => ({
      timeLeft: typeof timeLeft === 'function' ? timeLeft(state.timeLeft) : timeLeft,
    })),
  setTotalTime: (totalTime) => set({ totalTime }),
  resetGame: () =>
    set({
      score: 0,
      combo: 0,
      maxCombo: 0,
      matchPercent: 0,
      isPlaying: false,
      timeLeft: 30,
    }),
}))
