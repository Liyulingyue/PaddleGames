import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Play, Home, Trophy, Zap, ChevronRight, Monitor, Hand, ArrowUp, User, BookOpen } from 'lucide-react'
import Camera from '@/components/Camera'
import PoseFigure from '@/components/PoseFigure'
import FollowCoachCanvas, { type FollowCoachCanvasHandle } from '@/components/FollowCoachCanvas'
import ModeGuideModal, { type GuideSection } from '@/components/ModeGuideModal'
import { type Keypoint } from '@/types/pose'
import { calculatePoseMatchScore, calculateKeypointSimilarity, type PoseTemplate, type ScoringMode, SCORING_MODES } from '@/utils/poseMatcher'
import { usePoseTemplates } from '@/hooks/usePoseTemplates'
import { useLevelConfigs } from '@/hooks/useLevelConfigs'
import { resolveLevelPoses, resolveRhythmPoses } from '@/utils/levelConfigs'
import { useUserStore } from '@/store/userStore'
import { cn } from '@/lib/utils'

// ============ 手势参数 ============
const HAND_UP_THRESHOLD = 0.10    // 手腕高于肩膀的归一化距离阈值（增大防噪声）
const CROSS_X_THRESHOLD = 0.12   // 左右手腕X距离小于此值视为交叉（归一化坐标）
const SHOULDER_TOUCH_DIST = 0.10 // 手腕与同侧肩膀的距离阈值（摸肩手势）
const STABLE_FRAMES = 5           // 连续 N 帧相同手势才认定有效
const NAV_COOLDOWN = 800          // 导航手势冷却（ms）
const MODE_SWITCH_COOLDOWN = 1200 // 模式切换冷却（ms）
const CONFIRM_HOLD_MS = 1500      // 确认保持时长（ms）
const EXIT_HOLD_MS = 2000         // 游戏中退出保持时长（ms）
const CONFIRM_CANCEL_MS = 400     // 确认中断后多久重置（ms）

const SCORING_MODE_ORDER: ScoringMode[] = ['minimal', 'upper', 'full']

type GestureType = 'none' | 'leftUp' | 'rightUp' | 'bothUp' | 'crossAbove' | 'touchShoulder'

type ImmersiveScreen = 'menu' | 'select' | 'game' | 'result'
type GameMode = 'challenge' | 'rhythm' | 'follow'

interface UserLevel {
  id: number
  name: string
  templates: PoseTemplate[]
  fps: number | null
  total_duration: number
  video_path?: string | null
  bone_video_path?: string | null
}

interface MenuItem {
  id: string
  title: string
  desc: string
  icon: typeof Play
  color: string
  action: () => void
}

export default function ImmersiveMode() {
  const [screen, setScreen] = useState<ImmersiveScreen>('menu')
  const [gameMode, setGameMode] = useState<GameMode>('challenge')
  const [currentPose, setCurrentPose] = useState<PoseTemplate | null>(null)
  const [poseIndex, setPoseIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [matched, setMatched] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [uploaded, setUploaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [scoringMode, setScoringMode] = useState<ScoringMode>('upper')
  const [modelReady, setModelReady] = useState(false)
  const [hasPerson, setHasPerson] = useState(false)
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0)
  const [poseCountdown, setPoseCountdown] = useState(0) // 节拍模式当前动作倒计时（秒，含小数）
  // 实时手势状态（仅用于 UI 渲染）
  const [activeGesture, setActiveGesture] = useState<GestureType>('none')
  const [confirmProgress, setConfirmProgress] = useState(0)
  const [exitProgress, setExitProgress] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const { user, isLoggedIn } = useUserStore()
  const { templates } = usePoseTemplates()
  const { levels, rhythmLevels } = useLevelConfigs()
  // 跟练模式状态
  const [userLevels, setUserLevels] = useState<UserLevel[]>([])
  const [videoMode, setVideoMode] = useState<'original' | 'bone'>('original')

  // ============ 用 ref 追踪手势稳定性和确认状态（避免闭包陷阱） ============
  const gestureBufferRef = useRef<GestureType[]>([])           // 最近 N 帧手势
  const lastNavTimeRef = useRef<number>(0)
  const scoreRef = useRef(0)
  const confirmStartRef = useRef<number>(0)                     // 确认开始时间
  const confirmActiveRef = useRef(false)                        // 确认是否激活
  const exitStartRef = useRef<number>(0)                        // 退出确认开始时间
  const exitActiveRef = useRef(false)                           // 退出确认是否激活
  const lastModeSwitchRef = useRef<number>(0)                   // 上次模式切换时间
  const countdownRef = useRef<number>(0)
  const screenRef = useRef<ImmersiveScreen>('menu')             // screen 的 ref 版本
  const selectedMenuIndexRef = useRef(0)
  const selectedLevelIndexRef = useRef(0)
  // 跟练模式 ref
  const followIndexRef = useRef(0)
  const lastScoredIdxRef = useRef(-1)
  const followFrameStartRef = useRef(0)
  const coachCanvasRef = useRef<FollowCoachCanvasHandle | null>(null)
  const videoBgRef = useRef<HTMLVideoElement | null>(null)
  const followTickRef = useRef<number | null>(null)
  const actionScoresRef = useRef<number[]>([])
  const [actionScores, setActionScores] = useState<number[]>([])

  // 保持 ref 同步
  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { selectedMenuIndexRef.current = selectedMenuIndex }, [selectedMenuIndex])

  // 加载用户跟练关卡（新统一 API：/api/follow-levels）
  useEffect(() => {
    if (!isLoggedIn || gameMode !== 'follow') return
    const load = async () => {
      try {
        const res = await fetch(`/api/follow-levels?owner_id=${user.id}&limit=24`)
        if (res.ok) {
          const data = await res.json()
          const items = data.items || []
          // 逐个拉取详情获取 templates + 视频路径
          const resolved = await Promise.all(
            items.map(async (item: any) => {
              try {
                const dres = await fetch(`/api/follow-levels/${item.id}?user_id=${user.id}`)
                if (dres.ok) {
                  const d = await dres.json()
                  return {
                    id: item.id,
                    name: item.name,
                    templates: d.templates || [],
                    fps: d.fps ?? null,
                    total_duration: d.total_duration || 0,
                    video_path: d.video_path ?? null,
                    bone_video_path: d.bone_video_path ?? null,
                  }
                }
              } catch { /* ignore */ }
              return null
            })
          )
          setUserLevels(resolved.filter((c): c is UserLevel => c !== null && c.templates.length > 0))
        }
      } catch { /* ignore */ }
    }
    load()
  }, [isLoggedIn, gameMode, user.id])

  // 跟练模式：当前视频 URL 和辅助计算
  const selectedUserLevel = useMemo(() => {
    if (gameMode !== 'follow') return null
    return userLevels[selectedLevelIndex] || null
  }, [gameMode, userLevels, selectedLevelIndex])
  const currentVideoUrl = videoMode === 'bone'
    ? (selectedUserLevel?.bone_video_path ? `/videos/${selectedUserLevel.bone_video_path}` : undefined)
    : (selectedUserLevel?.video_path ? `/videos/${selectedUserLevel.video_path}` : undefined)
  const hasVideoBg = gameMode === 'follow' && !!currentVideoUrl
  const hasBothVideos = gameMode === 'follow' && !!selectedUserLevel?.bone_video_path && !!selectedUserLevel?.video_path
  useEffect(() => { selectedLevelIndexRef.current = selectedLevelIndex }, [selectedLevelIndex])

  const challengePoses = useMemo(
    () => templates.filter((p: PoseTemplate) => p.category !== '八段锦' && p.category !== '瑜伽'),
    [templates]
  )
  const followPoses = useMemo(
    () => templates.filter((p: PoseTemplate) => p.category === '八段锦' || p.category === '瑜伽'),
    [templates]
  )

  // 当前可选的关卡/课程列表
  const levelOptions = useMemo(() => {
    if (gameMode === 'challenge') return levels
    if (gameMode === 'follow') return userLevels  // 跟练模式只有用户自建关卡
    return rhythmLevels // rhythm
  }, [gameMode, userLevels, levels, rhythmLevels])

  // 选中关卡对应的动作模板
  const selectedLevel = levelOptions[selectedLevelIndex]
  const currentPoses = useMemo(() => {
    if (gameMode === 'follow' && selectedUserLevel) {
      return selectedUserLevel.templates
    }
    if (!selectedLevel) return challengePoses  // fallback
    if ('timeLimit' in selectedLevel) {
      // LevelConfig（闯关模式）
      const poseIds = resolveLevelPoses(selectedLevel, templates)
      return poseIds
        .map(id => templates.find((t: PoseTemplate) => String(t.id) === String(id)))
        .filter(Boolean) as PoseTemplate[]
    }
    if ('poseIds' in selectedLevel) {
      // LevelConfig（节拍模式）
      const poseIds = resolveRhythmPoses(selectedLevel, templates)
      return poseIds
        .map(id => templates.find((t: PoseTemplate) => String(t.id) === String(id)))
        .filter(Boolean) as PoseTemplate[]
    }
    return challengePoses
  }, [selectedLevel, selectedUserLevel, templates, challengePoses, gameMode])

  const isFollow = gameMode === 'follow'

  // ============ 原始手势检测（单帧） ============
  const detectRawGesture = useCallback((landmarks: Keypoint[]): GestureType => {
    const leftWrist = landmarks[15]
    const rightWrist = landmarks[16]
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]

    const leftUp = !!(leftWrist && leftShoulder &&
      leftWrist.y < leftShoulder.y - HAND_UP_THRESHOLD &&
      (leftWrist.visibility ?? 0) > 0.5)
    const rightUp = !!(rightWrist && rightShoulder &&
      rightWrist.y < rightShoulder.y - HAND_UP_THRESHOLD &&
      (rightWrist.visibility ?? 0) > 0.5)

    // 双手举高 + 手腕在头顶交叉（退出手势，与动作姿势区分）
    if (leftUp && rightUp && leftWrist && rightWrist) {
      const wristXDist = Math.abs(leftWrist.x - rightWrist.x)
      if (wristXDist < CROSS_X_THRESHOLD) return 'crossAbove'
    }

    if (leftUp && rightUp) return 'bothUp'
    if (leftUp) return 'leftUp'
    if (rightUp) return 'rightUp'

    // 摸同侧肩膀：手腕靠近同侧肩膀（未举手时检测）
    if (leftWrist && leftShoulder && (leftWrist.visibility ?? 0) > 0.5) {
      const d = Math.hypot(leftWrist.x - leftShoulder.x, leftWrist.y - leftShoulder.y)
      if (d < SHOULDER_TOUCH_DIST && !leftUp) return 'touchShoulder'
    }
    if (rightWrist && rightShoulder && (rightWrist.visibility ?? 0) > 0.5) {
      const d = Math.hypot(rightWrist.x - rightShoulder.x, rightWrist.y - rightShoulder.y)
      if (d < SHOULDER_TOUCH_DIST && !rightUp) return 'touchShoulder'
    }

    return 'none'
  }, [])

  // ============ 稳定手势（连续 N 帧一致才输出） ============
  const getStableGesture = useCallback((raw: GestureType): GestureType => {
    const buf = gestureBufferRef.current
    buf.push(raw)
    if (buf.length > STABLE_FRAMES) buf.shift()

    // 最近 STABLE_FRAMES 帧全部一致才输出该手势
    if (buf.length >= STABLE_FRAMES && buf.every(g => g === raw)) return raw
    // 如果缓冲不满或帧间不一致，取最近一帧的值作为 UI 显示（但不触发动作）
    return 'none'
  }, [])

  // ============ 导航动作（带冷却） ============
  const navigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const now = Date.now()
    if (now - lastNavTimeRef.current < NAV_COOLDOWN) return
    lastNavTimeRef.current = now

    if (screenRef.current === 'menu') {
      if (direction === 'up') setSelectedMenuIndex(i => Math.max(0, i - 1))
      if (direction === 'down') setSelectedMenuIndex(i => Math.min(menuItemsRef.current.length - 1, i + 1))
    } else if (screenRef.current === 'select') {
      if (direction === 'left') setSelectedLevelIndex(i => Math.max(0, i - 1))
      if (direction === 'right') setSelectedLevelIndex(i => Math.min(levelOptions.length - 1, i + 1))
    }
  }, [levelOptions.length])

  // 沉浸模式指南内容
  const guideSections: GuideSection[] = useMemo(() => [
    {
      icon: Monitor,
      title: '沉浸模式特点',
      desc: '全屏体感，无需触摸',
      color: 'from-indigo-400 to-purple-500',
      items: [
        { label: '全屏体验', desc: '全屏大屏适配，适合客厅、投影仪场景' },
        { label: '体感操控', desc: '手势控制菜单，无需触摸屏幕，站着也能玩', tag: '体感', tagColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: '三种模式', desc: '闯关 / 节拍 / 跟练，与单人模式玩法一致' },
      ],
    },
    {
      icon: Hand,
      title: '手势操作',
      desc: '三种核心手势 + 键盘备选',
      color: 'from-green-500 to-emerald-500',
      visual: (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { emoji: '👆', name: '切换', key: '← →' },
            { emoji: '🙌', name: '确认', key: 'Enter' },
            { emoji: '🤲', name: '退出', key: 'Esc' },
          ].map((g, i) => (
            <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/10">
              <div className="text-2xl">{g.emoji}</div>
              <div className="text-xs font-bold text-white mt-0.5">{g.name}</div>
              <div className="text-[10px] text-white/40 font-mono">{g.key}</div>
            </div>
          ))}
        </div>
      ),
      items: [
        { label: '切换菜单', desc: '单手举起上下挥动，移动选择项（也可用 ← → 方向键）' },
        { label: '确认选择', desc: '双手举高交叉保持，进度条满后确认（也可按 Enter）', tag: '保持', tagColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: '退出当前', desc: '双手放下交叉保持，进度条满后退出（也可按 Esc）', tag: '保持', tagColor: 'bg-rose-500/20 text-rose-400' },
      ],
    },
    {
      icon: Zap,
      title: '游戏机制',
      desc: '三种模式的核心规则',
      color: 'from-emerald-500 to-cyan-500',
      items: [
        { label: '闯关模式', desc: '达标即过（≥80 分），比拼总耗时', tag: '≥80分', tagColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: '节拍模式', desc: '固定节奏切换，比拼平均分', tag: '平均分', tagColor: 'bg-purple-500/20 text-purple-400' },
        { label: '跟练模式', desc: '跟着视频连续做，按原节奏推进', tag: 'Beta', tagColor: 'bg-amber-500/20 text-amber-400' },
        { label: '评分范围', desc: '极简/半身/全身三档，默认半身' },
      ],
    },
    {
      icon: BookOpen,
      title: '使用建议',
      desc: '获得最佳识别效果',
      color: 'from-yellow-500 to-orange-500',
      items: [
        { label: '站位要求', desc: '确保全身出现在画面中，光线充足' },
        { label: '手势识别', desc: '动作幅度大一些，避免背景杂乱', tag: '建议', tagColor: 'bg-yellow-500/20 text-yellow-400' },
        { label: '隐私保护', desc: '摄像头数据本地处理，不上传视频', tag: '隐私', tagColor: 'bg-green-500/20 text-green-400' },
      ],
    },
  ], [])

  // 首次进入沉浸模式自动弹出指南（localStorage 记忆）
  useEffect(() => {
    const shown = localStorage.getItem('immersive_guide_shown')
    if (!shown && modelReady) {
      setGuideOpen(true)
      localStorage.setItem('immersive_guide_shown', '1')
    }
  }, [modelReady])

  const menuItems: MenuItem[] = useMemo(() => [
    { id: 'guide', title: '玩法指南', desc: '查看手势操作与游戏机制', icon: BookOpen, color: 'from-indigo-400 to-purple-500', action: () => setGuideOpen(true) },
    { id: 'challenge', title: '闯关模式', desc: '静态姿势保持，逐级挑战', icon: Zap, color: 'from-emerald-500 to-cyan-500', action: () => { setGameMode('challenge'); setScreen('select'); setSelectedLevelIndex(0); } },
    { id: 'rhythm', title: '节拍模式', desc: '固定节奏切换，比拼得分', icon: Play, color: 'from-purple-500 to-pink-500', action: () => { setGameMode('rhythm'); setScreen('select'); setSelectedLevelIndex(0); } },
    { id: 'follow', title: '跟练模式', desc: '视频跟练，跟着教练做', icon: Hand, color: 'from-green-500 to-emerald-500', action: () => { setGameMode('follow'); setScreen('select'); setSelectedLevelIndex(0); } },
    { id: 'leaderboard', title: '排行榜', desc: '查看全国排名，挑战最高分', icon: Trophy, color: 'from-yellow-500 to-orange-500', action: () => { window.location.href = '/leaderboard'; } },
    { id: 'home', title: '返回首页', desc: '退出沉浸模式，返回主页面', icon: Home, color: 'from-purple-500 to-pink-500', action: () => { window.location.href = '/'; } },
  ], [])
  const menuItemsRef = useRef(menuItems)
  useEffect(() => { menuItemsRef.current = menuItems }, [menuItems])

  const startGame = useCallback(() => {
    if (currentPoses.length === 0) return
    setCurrentPose(currentPoses[0])
    setPoseIndex(0)
    setScore(0)
    scoreRef.current = 0
    setTotalScore(0)
    setCompletedCount(0)
    setUploaded(false)
    setActionScores([])
    actionScoresRef.current = []
    // 跟练模式初始化
    if (gameMode === 'follow') {
      followIndexRef.current = 0
      lastScoredIdxRef.current = 0
      followFrameStartRef.current = Date.now()
      coachCanvasRef.current?.advance(0, Date.now())
      if (videoBgRef.current && currentPoses[0]?.timestamp !== undefined) {
        videoBgRef.current.currentTime = currentPoses[0].timestamp
      }
    }
    setScreen('game')
    setIsPlaying(true)
    setCountdown(0)
  }, [currentPoses, gameMode])

  const exitGame = useCallback(() => {
    setIsPlaying(false)
    clearInterval(countdownRef.current)
    exitActiveRef.current = false
    setExitProgress(0)
    setScreen('menu')
  }, [])

  // ============ 主姿态回调 ============
  const handlePoseResult = useCallback((hasPerson: boolean, landmarks: Keypoint[] | null) => {
    setHasPerson(hasPerson)
    if (!modelReady && hasPerson) setModelReady(true)
    if (!hasPerson || !landmarks) {
      setActiveGesture('none')
      return
    }

    const rawGesture = detectRawGesture(landmarks)
    const stableGesture = getStableGesture(rawGesture)

    // 更新实时 UI 指示（用原始手势，让用户看到即时反馈）
    setActiveGesture(rawGesture)

    const now = Date.now()
    const curScreen = screenRef.current

    // --- 菜单/选择界面：手势导航 + 确认 ---
    if (curScreen === 'menu' || curScreen === 'select') {
      if (stableGesture === 'crossAbove') {
        // 双手举高交叉 → 确认
        if (!confirmActiveRef.current) {
          confirmActiveRef.current = true
          confirmStartRef.current = now
        }
        const elapsed = now - confirmStartRef.current
        const progress = Math.min(1, elapsed / CONFIRM_HOLD_MS)
        setConfirmProgress(progress)
        if (progress >= 1) {
          if (curScreen === 'menu') {
            menuItemsRef.current[selectedMenuIndexRef.current]?.action()
          } else {
            startGame()
          }
          confirmActiveRef.current = false
          setConfirmProgress(0)
          gestureBufferRef.current = []  // 清空缓冲，防止确认后立即重复触发
        }
        return
      }

      // 非确认：重置
      if (confirmActiveRef.current) {
        // 允许短暂中断（手抖），不立即重置
        if (now - confirmStartRef.current > CONFIRM_CANCEL_MS + CONFIRM_HOLD_MS) {
          confirmActiveRef.current = false
          setConfirmProgress(0)
        }
      } else {
        setConfirmProgress(0)
      }

      // 单手导航（用稳定手势）
      if (curScreen === 'menu') {
        if (stableGesture === 'leftUp') navigate('up')
        if (stableGesture === 'rightUp') navigate('down')
      } else {
        if (stableGesture === 'leftUp') navigate('left')
        if (stableGesture === 'rightUp') navigate('right')
      }

      // 摸肩 → 切换检测模式（选择页面）
      if (curScreen === 'select' && stableGesture === 'touchShoulder') {
        if (now - lastModeSwitchRef.current > MODE_SWITCH_COOLDOWN) {
          lastModeSwitchRef.current = now
          setScoringMode(prev => {
            const idx = SCORING_MODE_ORDER.indexOf(prev)
            return SCORING_MODE_ORDER[(idx + 1) % SCORING_MODE_ORDER.length]
          })
        }
      }
    }

    // --- 游戏中：退出手势（双手举高+交叉保持） + 评分 ---
    if (curScreen === 'game') {
      // 退出手势：双手举高并在头顶交叉保持 2s（与动作姿势区分）
      if (stableGesture === 'crossAbove' && !isPlaying) {
        // 倒计时期间不触发退出
      } else if (stableGesture === 'crossAbove') {
        if (!exitActiveRef.current) {
          exitActiveRef.current = true
          exitStartRef.current = now
        }
        const elapsed = now - exitStartRef.current
        const progress = Math.min(1, elapsed / EXIT_HOLD_MS)
        setExitProgress(progress)
        if (progress >= 1) {
          exitGame()
          return
        }
      } else {
        if (exitActiveRef.current) {
          exitActiveRef.current = false
          setExitProgress(0)
        }
      }

      // 摸肩 → 切换检测模式（游戏中也可切换）
      if (stableGesture === 'touchShoulder') {
        if (now - lastModeSwitchRef.current > MODE_SWITCH_COOLDOWN) {
          lastModeSwitchRef.current = now
          setScoringMode(prev => {
            const idx = SCORING_MODE_ORDER.indexOf(prev)
            return SCORING_MODE_ORDER[(idx + 1) % SCORING_MODE_ORDER.length]
          })
        }
      }

      // 评分
      if (isPlaying && currentPose) {
        const pose = isFollow ? currentPoses[followIndexRef.current] : currentPose
        if (pose) {
          const match = isFollow
            ? calculateKeypointSimilarity(landmarks, pose, scoringMode)
            : calculatePoseMatchScore(landmarks, pose, scoringMode)
          setScore(match)
          scoreRef.current = match
          setMatched(match >= 80)
        }
      }
    }

    // --- 结果页面：双手举高交叉确认返回菜单 ---
    if (curScreen === 'result') {
      if (stableGesture === 'crossAbove') {
        if (!confirmActiveRef.current) {
          confirmActiveRef.current = true
          confirmStartRef.current = now
        }
        const elapsed = now - confirmStartRef.current
        const progress = Math.min(1, elapsed / CONFIRM_HOLD_MS)
        setConfirmProgress(progress)
        if (progress >= 1) {
          setScreen('menu')
          confirmActiveRef.current = false
          setConfirmProgress(0)
          gestureBufferRef.current = []
        }
        return
      }
      if (confirmActiveRef.current) {
        confirmActiveRef.current = false
        setConfirmProgress(0)
      }
    }
  }, [modelReady, isPlaying, currentPose, scoringMode, isFollow, currentPoses, detectRawGesture, getStableGesture, navigate, startGame, exitGame])

  // ============ 游戏计时 ============
  useEffect(() => {
    if (!isPlaying || !currentPose) return

    // 跟练模式：视频驱动或 rAF 驱动
    if (isFollow) {
      if (hasVideoBg && videoBgRef.current) {
        const video = videoBgRef.current
        video.play().catch(() => {})

        const tick = () => {
          const ct = video.currentTime
          const total = currentPoses.length
          if (total === 0) {
            followTickRef.current = requestAnimationFrame(tick)
            return
          }

          let idx = 0
          for (let i = 0; i < total; i++) {
            if ((currentPoses[i].timestamp ?? 0) <= ct) idx = i
            else break
          }
          idx = Math.min(idx, total - 1)

          followIndexRef.current = idx
          if (lastScoredIdxRef.current !== idx) {
            const prevScore = scoreRef.current
            actionScoresRef.current = [...actionScoresRef.current, prevScore]
            setActionScores([...actionScoresRef.current])
            lastScoredIdxRef.current = idx
            setPoseIndex(idx)
            setCurrentPose(currentPoses[idx])
            setScore(0)
            scoreRef.current = 0
            coachCanvasRef.current?.advance(idx, Date.now())
          }

          followTickRef.current = requestAnimationFrame(tick)
        }
        followTickRef.current = requestAnimationFrame(tick)

        const onEnded = () => {
          const finalScore = scoreRef.current
          actionScoresRef.current = [...actionScoresRef.current, finalScore]
          setActionScores([...actionScoresRef.current])
          const avg = actionScoresRef.current.length > 0
            ? Math.round(actionScoresRef.current.reduce((a, b) => a + b, 0) / actionScoresRef.current.length)
            : 0
          setTotalScore(avg)
          setCompletedCount(currentPoses.length)
          setScreen('result')
          setIsPlaying(false)
        }
        video.addEventListener('ended', onEnded)
        return () => {
          if (followTickRef.current) cancelAnimationFrame(followTickRef.current)
          video.removeEventListener('ended', onEnded)
          video.pause()
        }
      }

      // 无视频：rAF 驱动固定帧率
      const FOLLOW_FPS = 3
      const tick = () => {
        const idx = followIndexRef.current
        const pose = currentPoses[idx]
        if (!pose) { followTickRef.current = requestAnimationFrame(tick); return }
        const frameDuration = 1 / FOLLOW_FPS
        const now = Date.now()
        const elapsedMs = (now - followFrameStartRef.current) / 1000

        if (elapsedMs >= frameDuration) {
          const finalScore = scoreRef.current
          actionScoresRef.current = [...actionScoresRef.current, finalScore]
          setActionScores([...actionScoresRef.current])
          const nextIdx = idx + 1
          if (nextIdx >= currentPoses.length) {
            const avg = actionScoresRef.current.length > 0
              ? Math.round(actionScoresRef.current.reduce((a, b) => a + b, 0) / actionScoresRef.current.length)
              : 0
            setTotalScore(avg)
            setCompletedCount(currentPoses.length)
            setScreen('result')
            setIsPlaying(false)
            return
          }
          followIndexRef.current = nextIdx
          lastScoredIdxRef.current = nextIdx
          followFrameStartRef.current = Date.now()
          setPoseIndex(nextIdx)
          setCurrentPose(currentPoses[nextIdx])
          setScore(0)
          scoreRef.current = 0
          coachCanvasRef.current?.advance(nextIdx, Date.now())
        }
        followTickRef.current = requestAnimationFrame(tick)
      }
      followTickRef.current = requestAnimationFrame(tick)
      return () => { if (followTickRef.current) cancelAnimationFrame(followTickRef.current) }
    }

    // 闯关模式：达标即过（匹配度 >= 80% 保持 0.5s 后切换）
    if (gameMode === 'challenge') {
      if (!matched) return
      const timer = setTimeout(() => {
        setTotalScore(prev => prev + scoreRef.current)
        setCompletedCount(prev => prev + 1)
        const nextIndex = poseIndex + 1
        if (nextIndex >= currentPoses.length) {
          setScreen('result')
          setIsPlaying(false)
        } else {
          setPoseIndex(nextIndex)
          setCurrentPose(currentPoses[nextIndex])
          setScore(0)
          scoreRef.current = 0
          setMatched(false)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [currentPose, isPlaying, poseIndex, currentPoses.length, isFollow, hasVideoBg, matched, gameMode])

  // 节拍模式：定时切换（独立 useEffect，不受 matched 影响）
  useEffect(() => {
    if (!isPlaying || gameMode !== 'rhythm' || !currentPose || isFollow) return

    const timer = setTimeout(() => {
      setTotalScore(prev => prev + scoreRef.current)
      setCompletedCount(prev => prev + 1)
      const nextIndex = poseIndex + 1
      if (nextIndex >= currentPoses.length) {
        setScreen('result')
        setIsPlaying(false)
      } else {
        setPoseIndex(nextIndex)
        setCurrentPose(currentPoses[nextIndex])
        setScore(0)
        scoreRef.current = 0
      }
    }, currentPose.duration * 1000)
    return () => clearTimeout(timer)
  }, [currentPose, isPlaying, poseIndex, currentPoses.length, gameMode, isFollow])

  // ============ 节拍模式倒计时更新 ============
  useEffect(() => {
    if (!isPlaying || gameMode !== 'rhythm' || !currentPose) {
      setPoseCountdown(0)
      return
    }
    const duration = currentPose.duration || 8
    setPoseCountdown(duration)
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      const remaining = Math.max(0, duration - elapsed)
      setPoseCountdown(remaining)
    }, 100)
    return () => clearInterval(interval)
  }, [isPlaying, gameMode, currentPose, poseIndex])

  // ============ 键盘控制（备用） ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen === 'menu') {
        if (e.key === 'ArrowUp') setSelectedMenuIndex(i => Math.max(0, i - 1))
        if (e.key === 'ArrowDown') setSelectedMenuIndex(i => Math.min(menuItems.length - 1, i + 1))
        if (e.key === 'Enter') menuItems[selectedMenuIndex].action()
      } else if (screen === 'select') {
        if (e.key === 'ArrowLeft') setSelectedLevelIndex(i => Math.max(0, i - 1))
        if (e.key === 'ArrowRight') setSelectedLevelIndex(i => Math.min(levelOptions.length - 1, i + 1))
        if (e.key === 'Enter') startGame()
        if (e.key === 'Escape') setScreen('menu')
      } else if (screen === 'game') {
        if (e.key === 'Escape') {
          setIsPlaying(false)
          clearInterval(countdownRef.current)
          setScreen('menu')
        }
      } else if (screen === 'result') {
        if (e.key === 'Enter') setScreen('menu')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen, menuItems, currentPoses.length, selectedMenuIndex, startGame])

  // ============ 提交分数 ============
  const submitScore = async () => {
    if (!isLoggedIn || !user || uploaded || uploading) return
    setUploading(true)
    try {
      const avgScore = gameMode === 'follow'
        ? totalScore
        : (completedCount > 0 ? Math.round(totalScore / completedCount) : 0)
      const totalDuration = gameMode === 'follow'
        ? Math.round(currentPoses.reduce((s, t) => s + (t.sourceDuration ?? 0), 0))
        : currentPoses.slice(0, completedCount).reduce((sum, p) => sum + (p.duration || 0), 0)
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          nickname: user.nickname,
          template_name: `沉浸模式-${gameMode === 'challenge' ? '闯关' : gameMode === 'rhythm' ? '节拍' : '跟练'}`,
          score: avgScore,
          max_combo: 0,
          accuracy: avgScore,
          duration: totalDuration,
          game_mode: 'immersive',
        }),
      })
      setUploaded(true)
    } catch (e) {
      console.error('提交分数失败', e)
    } finally {
      setUploading(false)
    }
  }

  // ============ 手势指示器组件 ============
  const GestureIndicator = ({ mode }: { mode: 'nav' | 'confirm' | 'exit' }) => (
    <div className="flex items-center gap-3 justify-center flex-wrap">
      {mode === 'nav' && (
        <>
          <div className={cn(
            'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
            activeGesture === 'leftUp' ? 'bg-emerald-500/40 text-emerald-200 scale-110' : 'bg-white/5 text-white/30'
          )}>
            <span className="text-lg">👈</span>
            <span className="text-[10px]">{screen === 'menu' ? '上' : '←'}</span>
          </div>
          <div className={cn(
            'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
            activeGesture === 'crossAbove' ? 'bg-emerald-500/40 text-emerald-200 scale-110' : 'bg-white/5 text-white/30'
          )}>
            <span className="text-lg">✖️</span>
            <span className="text-[10px]">确认</span>
          </div>
          <div className={cn(
            'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
            activeGesture === 'rightUp' ? 'bg-emerald-500/40 text-emerald-200 scale-110' : 'bg-white/5 text-white/30'
          )}>
            <span className="text-lg">👉</span>
            <span className="text-[10px]">{screen === 'menu' ? '下' : '→'}</span>
          </div>
          {screen !== 'menu' && (
            <div className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
              activeGesture === 'touchShoulder' ? 'bg-amber-500/40 text-amber-200 scale-110' : 'bg-white/5 text-white/30'
            )}>
              <span className="text-lg">🤷</span>
              <span className="text-[10px]">切模式</span>
            </div>
          )}
        </>
      )}
      {mode === 'confirm' && (
        <div className="w-full">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-green-400 flex items-center gap-1">
              <ArrowUp size={12} />
              双手举高交叉确认中...
            </span>
            <span className="text-green-400 font-mono">{Math.round(confirmProgress * 100)}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-150"
              style={{ width: `${confirmProgress * 100}%` }}
            />
          </div>
        </div>
      )}
      {mode === 'exit' && (
        <div className="w-full">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-red-400 flex items-center gap-1">
              <ArrowUp size={12} />
              双手举高交叉退出中...
            </span>
            <span className="text-red-400 font-mono">{Math.round(exitProgress * 100)}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-400 to-orange-500 rounded-full transition-all duration-150"
              style={{ width: `${exitProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )

  // ============ 渲染：菜单 ============
  const renderMenu = () => (
    <div className="h-full flex flex-col p-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center">
          <Monitor size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">沉浸模式</h2>
        <p className="text-white/50 text-sm">体感控制，无需触摸</p>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        {menuItems.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={cn(
                'p-4 rounded-xl transition-all duration-300 text-left',
                index === selectedMenuIndex
                  ? 'bg-white/20 shadow-lg shadow-purple-500/20 ring-1 ring-white/20'
                  : 'bg-white/5 hover:bg-white/10'
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn('w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0', item.color)}>
                  <Icon size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-white/50 text-xs">{item.desc}</p>
                </div>
                {index === selectedMenuIndex && (
                  <ChevronRight size={20} className="ml-auto text-white flex-shrink-0" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-white/10">
        {/* 手势实时指示器 */}
        <div className="mb-4">
          <GestureIndicator mode="nav" />
        </div>

        {/* 确认进度（双手举高时显示） */}
        {confirmActiveRef.current && confirmProgress > 0 && (
          <div className="mb-4">
            <GestureIndicator mode="confirm" />
          </div>
        )}

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-white/40">
            <span>👈 / 👉 单手举高</span>
            <span>选择</span>
          </div>
          <div className="flex items-center justify-between text-white/40">
            <span>✖️ 双手举高交叉保持 1.5s</span>
            <span>确认</span>
          </div>
          <div className="flex items-center justify-between text-white/40">
            <span>Esc</span>
            <span>返回</span>
          </div>
        </div>
      </div>
    </div>
  )

  // ============ 渲染：选择 ============
  const renderSelect = () => {
    const level = levelOptions[selectedLevelIndex]
    if (!level) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6">
          {gameMode === 'follow' ? (
            <>
              <div className="text-4xl mb-4">🎬</div>
              <p className="text-white/50 mb-2">暂无跟练课程</p>
              <p className="text-white/40 text-sm mb-4">跟练模式需要从视频创建课程</p>
              <button
                onClick={() => window.location.href = '/video-import'}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all mb-3"
              >
                去创建跟练课程
              </button>
            </>
          ) : (
            <p className="text-white/50 mb-4">暂无可用关卡</p>
          )}
          <button onClick={() => setScreen('menu')} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl">
            返回菜单
          </button>
        </div>
      )
    }

    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setScreen('menu')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronRight size={20} className="text-white rotate-180" />
          </button>
          <h2 className="text-xl font-bold text-white">
            {gameMode === 'challenge' ? '选择关卡' : gameMode === 'rhythm' ? '选择课程' : '选择跟练课程'}
          </h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          {/* 关卡名称和描述 */}
          <h3 className="text-xl font-bold text-white mb-1">{level.name}</h3>
          {'desc' in level && <p className="text-white/60 text-sm mb-3">{level.desc}</p>}
          <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70 mb-3">
            {gameMode === 'follow' && selectedUserLevel
              ? `${currentPoses.length} 帧 · ${selectedUserLevel.total_duration}s`
              : `${currentPoses.length} 个动作`}
          </span>
          {gameMode === 'follow' && selectedUserLevel?.video_path && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full mb-3">有视频</span>
          )}

          {/* 自适应骨架图预览 */}
          <div className="flex-1 min-h-0 w-full max-h-[50vh] bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
            {currentPoses.length > 0 ? (
              <PoseFigure template={currentPoses[0]} autoSize className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">暂无动作数据</div>
            )}
          </div>

          {/* 关卡切换 */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setSelectedLevelIndex(i => Math.max(0, i - 1))}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight size={24} className="text-white rotate-180" />
            </button>
            <span className="text-white/50 text-sm">{selectedLevelIndex + 1} / {levelOptions.length}</span>
            <button
              onClick={() => setSelectedLevelIndex(i => Math.min(levelOptions.length - 1, i + 1))}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight size={24} className="text-white" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          {/* 检测模式选择 */}
          <div className="mb-4">
            <p className="text-white/50 text-xs mb-2">检测模式</p>
            <div className="flex items-center gap-2">
              {(Object.entries(SCORING_MODES) as [ScoringMode, typeof SCORING_MODES.minimal][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setScoringMode(key)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all',
                    scoringMode === key
                      ? 'bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                  )}
                >
                  <span className="block">{info.icon} {info.label}</span>
                  <span className="block text-[10px] opacity-60 mt-0.5">{info.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 手势实时指示器 */}
          <div className="mb-3">
            <GestureIndicator mode="nav" />
          </div>
          {confirmProgress > 0 && (
            <div className="mb-3">
              <GestureIndicator mode="confirm" />
            </div>
          )}

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            开始挑战
          </button>
          <p className="text-center text-white/40 text-xs mt-3">👈👉 切换关卡 · 🤷 摸肩切模式 · ✖️ 交叉确认</p>
        </div>
      </div>
    )
  }

  // ============ 渲染：游戏 ============
  const renderGame = () => (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={exitGame}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Home size={20} className="text-white" />
        </button>
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-medium',
            scoringMode === 'minimal' ? 'bg-slate-500/20 text-slate-300' :
            scoringMode === 'upper' ? 'bg-amber-500/20 text-amber-300' :
            'bg-emerald-500/20 text-emerald-300'
          )}>
            {SCORING_MODES[scoringMode].icon} {SCORING_MODES[scoringMode].label}
          </span>
          <span className="text-xs text-white/40">🤷 切模式</span>
        </div>
      </div>

      {currentPose && (
        <div className="text-center mb-2">
          <h3 className="font-bold text-white text-lg">{currentPose.name}</h3>
          {gameMode === 'follow' && currentPose.timestamp !== undefined ? (
            <p className="text-cyan-400/70 text-xs font-mono">
              ⏱ {currentPose.timestamp.toFixed(1)}s · 持续 {currentPose.sourceDuration?.toFixed(1)}s
            </p>
          ) : (
            <p className="text-white/50 text-xs">{currentPose.description}</p>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        {countdown > 0 ? (
          <div className="text-center">
            <div className="text-8xl font-bold text-white animate-pulse mb-4">{countdown}</div>
            <p className="text-white/50 text-sm">准备...</p>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center gap-3 w-full h-full min-h-0">
            {/* 跟练模式：视频/骨骼教练 */}
            {gameMode === 'follow' ? (
              <div className="flex-1 min-h-0 w-full bg-black/30 rounded-2xl border border-white/10 overflow-hidden relative">
                {hasVideoBg && (
                  <video
                    ref={videoBgRef}
                    src={currentVideoUrl}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                  />
                )}
                {!hasVideoBg && (
                  <FollowCoachCanvas
                    ref={coachCanvasRef}
                    templates={currentPoses}
                    currentIndex={poseIndex}
                    size={480}
                    scoringMode={scoringMode}
                    highlight={matched}
                    mirrored
                    frameStartMs={followFrameStartRef.current}
                    frameDuration={1 / 3}
                    coachMode
                  />
                )}
                {/* 视频切换 */}
                {hasBothVideos && (
                  <button
                    onClick={() => setVideoMode(v => v === 'bone' ? 'original' : 'bone')}
                    className="absolute top-3 right-3 z-10 px-2 py-1 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg border border-white/10"
                  >
                    {videoMode === 'bone' ? '原视频' : '骨骼'}
                  </button>
                )}
                {/* 小骨骼图（原视频模式） */}
                {hasVideoBg && videoMode === 'original' && (
                  <div className="absolute bottom-3 right-3 w-24 h-24 bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 z-10">
                    <FollowCoachCanvas
                      ref={coachCanvasRef}
                      templates={currentPoses}
                      currentIndex={poseIndex}
                      size={96}
                      scoringMode={scoringMode}
                      highlight={matched}
                      mirrored
                      frameStartMs={followFrameStartRef.current}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* 闯关模式：目标姿态图 */
              currentPose && (
                <div className="flex-1 min-h-0 w-full bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
                  <PoseFigure template={currentPose} autoSize className="w-full h-full" />
                </div>
              )
            )}
            {/* 分数 + 达标提示 */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="relative inline-flex items-center justify-center">
                <svg width={80} height={80} className="transform -rotate-90">
                  <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
                  <circle
                    cx={40} cy={40} r={34} fill="none"
                    stroke={matched ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'}
                    strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={34 * 2 * Math.PI}
                    strokeDashoffset={34 * 2 * Math.PI - (score / 100) * 34 * 2 * Math.PI}
                    style={{ transition: 'stroke-dashoffset 0.2s ease-out, stroke 0.2s' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    'text-2xl font-bold',
                    matched ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
                  )}>
                    {score}
                  </span>
                </div>
              </div>
              {matched && (
                <span className="text-2xl font-bold text-green-400 animate-bounce">达标!</span>
              )}
              {/* 节拍模式倒计时 */}
              {gameMode === 'rhythm' && poseCountdown > 0 && (
                <div className="flex flex-col items-center">
                  <span className={cn(
                    'text-2xl font-bold tabular-nums',
                    poseCountdown <= 2 ? 'text-red-400 animate-pulse' : poseCountdown <= 4 ? 'text-yellow-400' : 'text-white/70'
                  )}>
                    {poseCountdown.toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 退出手势进度 */}
      {exitProgress > 0 && (
        <div className="mb-4">
          <GestureIndicator mode="exit" />
        </div>
      )}

      <div className="mt-4">
        {/* 跟练模式：时间轴进度条 */}
        {gameMode === 'follow' ? (
          <div className="flex gap-0.5 items-center">
            {currentPoses.map((t, i) => {
              const dur = t.sourceDuration ?? 1
              const widthPercent = (dur / currentPoses.reduce((s, x) => s + (x.sourceDuration ?? 0), 0)) * 100
              return (
                <div
                  key={i}
                  className={cn(
                    'h-2 rounded-sm transition-all',
                    i < poseIndex ? 'bg-emerald-500/60' :
                    i === poseIndex ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 animate-pulse' :
                    'bg-white/15'
                  )}
                  style={{ width: `${Math.max(0.5, widthPercent)}%` }}
                />
              )
            })}
          </div>
        ) : (
          /* 闯关/节拍模式：动作进度条 + 节拍倒计时进度 */
          <>
            <div className="flex items-center gap-1">
              {currentPoses.map((_: PoseTemplate, index: number) => (
                <div
                  key={index}
                  className="flex-1 h-2 rounded-full overflow-hidden bg-white/20"
                >
                  {index === poseIndex && gameMode === 'rhythm' && currentPose ? (
                    <div
                      className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                      style={{ width: `${((1 - poseCountdown / (currentPose.duration || 8))) * 100}%` }}
                    />
                  ) : (
                    <div className={cn(
                      'h-full rounded-full',
                      index < poseIndex ? 'bg-green-500' :
                      index === poseIndex ? 'bg-blue-500' :
                      'bg-transparent'
                    )} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between text-xs text-white/40 mt-2">
          <span>{gameMode === 'follow' ? `帧 ${poseIndex + 1}/${currentPoses.length}` : `${completedCount}/${currentPoses.length} 完成`}</span>
          {currentPose && gameMode !== 'follow' && <span>{currentPose.duration}s</span>}
        </div>
      </div>
    </div>
  )

  // ============ 渲染：结果 ============
  const renderResult = () => {
    const avgScore = gameMode === 'follow'
      ? totalScore // 跟练模式 totalScore 已经是平均分
      : (completedCount > 0 ? Math.round(totalScore / completedCount) : 0)
    const totalDuration = gameMode === 'follow'
      ? Math.round(currentPoses.reduce((s, t) => s + (t.sourceDuration ?? 0), 0))
      : currentPoses.slice(0, completedCount).reduce((sum, p) => sum + (p.duration || 0), 0)
    return (
      <div className="h-full flex flex-col p-6 items-center justify-center">
        <div className="text-center w-full">
          <div className="text-6xl mb-4">{avgScore >= 80 ? '🏆' : avgScore >= 60 ? '🎉' : '💪'}</div>
          <h2 className="text-2xl font-bold text-white mb-6">挑战完成！</h2>

          <div className="grid grid-cols-2 gap-4 mb-8 w-full">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{avgScore}</div>
              <div className="text-white/50 text-sm">{gameMode === 'follow' ? '平均分' : '平均分'}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{totalDuration}s</div>
              <div className="text-white/50 text-sm">总时长</div>
            </div>
          </div>

          {isLoggedIn && !uploaded && (
            <button
              onClick={submitScore}
              disabled={uploading}
              className={cn(
                'w-full py-4 rounded-xl font-bold text-white mb-3 transition-all flex items-center justify-center gap-2',
                uploading
                  ? 'bg-white/20 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:shadow-lg hover:shadow-orange-500/30'
              )}
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Trophy size={20} />
                  上传到排行榜
                </>
              )}
            </button>
          )}
          {uploaded && (
            <div className="w-full py-4 bg-green-500/20 border border-green-500/50 rounded-xl font-bold text-green-400 mb-3 flex items-center justify-center gap-2">
              已上传到排行榜
            </div>
          )}
          {!isLoggedIn && (
            <div className="w-full py-4 bg-white/5 rounded-xl text-white/50 text-sm mb-3">
              登录后可上传成绩到排行榜
            </div>
          )}

          {/* 确认进度（双手举高时显示） */}
          {confirmProgress > 0 && (
            <div className="mb-3">
              <GestureIndicator mode="confirm" />
            </div>
          )}

          <button
            onClick={() => setScreen('menu')}
            className="w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            返回菜单
          </button>
          <p className="text-white/40 text-xs mt-3">按 Enter · 或双手举高交叉 1.5s 确认</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] h-full">
        <div className="relative">
          <Camera
            enabled
            width={1280}
            height={720}
            mirrored
            displayMode="overlay"
            template={currentPose}
            onPoseResult={handlePoseResult}
            className="w-full h-full object-cover"
          />

          {!modelReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-xl">正在加载模型...</p>
              </div>
            </div>
          )}

          {!hasPerson && screen === 'game' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
              <div className="text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-6 shadow-lg"><User size={40} className="text-white" /></div>
                <p className="text-white text-xl">请站到摄像头前</p>
              </div>
            </div>
          )}

          {/* ============ 摄像头叠加：实时手势指示 ============ */}
          {modelReady && (screen === 'menu' || screen === 'select') && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-sm px-5 py-3 rounded-2xl">
                <div className={cn(
                  'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-150',
                  activeGesture === 'leftUp' ? 'bg-emerald-500/50 scale-110' : 'bg-white/10 opacity-50'
                )}>
                  <span className="text-base">👈</span>
                  <span className="text-[9px] text-white/80">{screen === 'menu' ? '上' : '←'}</span>
                </div>
                <div className={cn(
                  'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-150',
                  activeGesture === 'crossAbove' ? 'bg-green-500/50 scale-110' : 'bg-white/10 opacity-50'
                )}>
                  <span className="text-base">✖️</span>
                  <span className="text-[9px] text-white/80">确认</span>
                </div>
                <div className={cn(
                  'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-150',
                  activeGesture === 'rightUp' ? 'bg-emerald-500/50 scale-110' : 'bg-white/10 opacity-50'
                )}>
                  <span className="text-base">👉</span>
                  <span className="text-[9px] text-white/80">{screen === 'menu' ? '下' : '→'}</span>
                </div>
                {screen === 'select' && (
                  <div className={cn(
                    'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-150',
                    activeGesture === 'touchShoulder' ? 'bg-amber-500/50 scale-110' : 'bg-white/10 opacity-50'
                  )}>
                    <span className="text-base">🤷</span>
                    <span className="text-[9px] text-white/80">切模式</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 游戏中的手势指示 */}
          {modelReady && screen === 'game' && isPlaying && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className={cn(
                'flex items-center gap-2 bg-black/60 backdrop-blur-sm px-4 py-2.5 rounded-2xl transition-all duration-200',
                activeGesture === 'crossAbove' ? 'ring-2 ring-red-400/50' : ''
              )}>
                <div className={cn(
                  'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-150',
                  activeGesture === 'touchShoulder' ? 'bg-amber-500/50 scale-110' : 'bg-white/10 opacity-50'
                )}>
                  <span className="text-base">🤷</span>
                  <span className="text-[9px] text-white/80">切模式</span>
                </div>
                <div className={cn(
                  'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-150',
                  activeGesture === 'crossAbove' ? 'bg-red-500/50 scale-110' : 'bg-white/10 opacity-50'
                )}>
                  <span className="text-base">✖️</span>
                  <span className="text-[9px] text-white/80">交叉退出</span>
                </div>
              </div>
            </div>
          )}

          {/* 摄像头叠加：确认进度环 */}
          {modelReady && confirmProgress > 0 && (screen === 'menu' || screen === 'select' || screen === 'result') && (
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
              <div className="relative w-14 h-14">
                <svg width={56} height={56} className="transform -rotate-90">
                  <circle cx={28} cy={28} r={22} fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth={4} />
                  <circle
                    cx={28} cy={28} r={22} fill="none"
                    stroke="#22c55e"
                    strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={22 * 2 * Math.PI}
                    strokeDashoffset={22 * 2 * Math.PI - confirmProgress * 22 * 2 * Math.PI}
                    style={{ transition: 'stroke-dashoffset 0.15s ease-out' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-green-400">{Math.round(confirmProgress * 100)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* 摄像头叠加：退出进度环 */}
          {modelReady && exitProgress > 0 && screen === 'game' && (
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
              <div className="relative w-14 h-14">
                <svg width={56} height={56} className="transform -rotate-90">
                  <circle cx={28} cy={28} r={22} fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth={4} />
                  <circle
                    cx={28} cy={28} r={22} fill="none"
                    stroke="#ef4444"
                    strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={22 * 2 * Math.PI}
                    strokeDashoffset={22 * 2 * Math.PI - exitProgress * 22 * 2 * Math.PI}
                    style={{ transition: 'stroke-dashoffset 0.15s ease-out' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-400">✖ 退出</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto">
          {screen === 'menu' && renderMenu()}
          {screen === 'select' && renderSelect()}
          {screen === 'game' && renderGame()}
          {screen === 'result' && renderResult()}
        </div>
      </div>

      {/* 沉浸模式指南弹窗 */}
      <ModeGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="沉浸模式指南"
        emoji="🖥️"
        subtitle="手势操控，全屏体验"
        sections={guideSections}
      />
    </div>
  )
}
