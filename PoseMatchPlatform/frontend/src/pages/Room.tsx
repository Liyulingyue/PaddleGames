import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Copy,
  Users,
  Play,
  Crown,
  Trophy,
  Zap,
  Target,
  Check,
  X,
  LogOut,
  ArrowLeft,
  FlipHorizontal,
  Music,
} from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import Camera from '@/components/Camera'
import PoseFigure from '@/components/PoseFigure'
import FollowCoachCanvas, { type FollowCoachCanvasHandle } from '@/components/FollowCoachCanvas'
import { calculatePoseMatchScore, calculateKeypointSimilarity, type PoseTemplate, type ScoringMode, SCORING_MODES } from '@/utils/poseMatcher'
import { useUserStore } from '@/store/userStore'
import { usePoseTemplates } from '@/hooks/usePoseTemplates'
import { cn } from '@/lib/utils'

interface Player {
  id: number
  user_id: number
  nickname: string
  avatar: string
  total_score: number
  current_score: number
  is_ready: boolean
  is_host: boolean
  finished: boolean
  duration: number
}

interface RoomInfo {
  id: number
  room_code: string
  host_id: number
  game_mode: string
  level_name: string
  templates: PoseTemplate[] | null
  per_pose_sec: number
  video_path: string
  bone_video_path: string
  status: string
  max_players: number
  current_round: number
  total_rounds: number
  round_duration: number
  started_at: string | null
  players: Player[]
}

type GamePhase = 'waiting' | 'countdown' | 'playing' | 'waiting_result' | 'result'
type DisplayMode = 'overlay' | 'drawing' | 'original'

export default function Room() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { user } = useUserStore()
  const { templates } = usePoseTemplates()
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting')
  const [countdown, setCountdown] = useState(3)
  const [toast, setToast] = useState('')

  // 游戏中状态
  const [currentIndex, setCurrentIndex] = useState(0)
  const [poseCountdown, setPoseCountdown] = useState(0)
  const [currentBest, setCurrentBest] = useState(0)
  const [actionScores, setActionScores] = useState<number[]>([])
  const [displayMode, setDisplayMode] = useState<DisplayMode>('overlay')
  const [mirrored, setMirrored] = useState(true)
  const [scoringMode, setScoringMode] = useState<ScoringMode>('upper')
  // 其他玩家实时分数/用时
  const [liveScores, setLiveScores] = useState<Record<number, number>>({})
  const [liveDurations, setLiveDurations] = useState<Record<number, number>>({})
  const [totalScore, setTotalScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  // challenge 模式状态
  const [elapsed, setElapsed] = useState(0)
  const [actionTimes, setActionTimes] = useState<number[]>([])
  // follow 模式状态
  const [videoMode, setVideoMode] = useState<'original' | 'bone'>('original')

  const tickRef = useRef<number | null>(null)
  const posesRef = useRef<PoseTemplate[]>([])
  const gamePhaseRef = useRef<GamePhase>('waiting')
  const mountedRef = useRef(true)
  const challengeTimerRef = useRef<number | null>(null)
  const sessionStartRef = useRef(0)
  const poseStartRef = useRef(0)
  const lastSwitchRef = useRef(0)
  // rAF 评分优化
  const scoreRef = useRef(0)
  const scoreDisplayRef = useRef<HTMLSpanElement>(null)
  const ringCircleRef = useRef<SVGCircleElement>(null)
  const ringTextRef = useRef<HTMLSpanElement>(null)
  const latestLandmarksRef = useRef<{ landmarks: any[]; time: number } | null>(null)
  const scorePendingRef = useRef(false)
  const scoreRafRef = useRef<number | null>(null)
  const comboRef = useRef(0)
  const lastMatchTimeRef = useRef(0)
  const matchedRef = useRef(false)
  // follow 模式 ref
  const followIndexRef = useRef(0)
  const lastScoredIdxRef = useRef(-1)
  const followFrameStartRef = useRef(0)
  const coachCanvasRef = useRef<FollowCoachCanvasHandle | null>(null)
  const videoBgRef = useRef<HTMLVideoElement | null>(null)
  const followCountdownDisplayRef = useRef<HTMLSpanElement>(null)
  const followProgressRef = useRef<HTMLDivElement>(null)

  // 同步 ref
  useEffect(() => { gamePhaseRef.current = gamePhase }, [gamePhase])

  // follow 视频切换后恢复播放
  useEffect(() => {
    if (gamePhase !== 'playing' || !videoBgRef.current) return
    const video = videoBgRef.current
    const onLoaded = () => { video.play().catch(() => {}) }
    video.addEventListener('loadeddata', onLoaded, { once: true })
    if (video.readyState >= 2) {
      video.removeEventListener('loadeddata', onLoaded)
      video.play().catch(() => {})
    }
    return () => video.removeEventListener('loadeddata', onLoaded)
  }, [videoMode, gamePhase])

  // toast 自动消失
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // 初始化 posesRef
  useEffect(() => {
    if (templates.length > 0 && posesRef.current.length === 0) {
      posesRef.current = [...templates]
    }
  }, [templates])

  // 浅比较：仅当数据实际变化时才更新 state，避免轮询导致抖动
  const roomRef = useRef<RoomInfo | null>(null)
  const shallowEqual = (a: RoomInfo, b: RoomInfo) => {
    if (a.status !== b.status || a.host_id !== b.host_id || a.level_name !== b.level_name) return false
    if (a.players.length !== b.players.length) return false
    for (let i = 0; i < a.players.length; i++) {
      const ap = a.players[i], bp = b.players[i]
      if (ap.user_id !== bp.user_id || ap.is_ready !== bp.is_ready || ap.total_score !== bp.total_score || ap.nickname !== bp.nickname || ap.finished !== bp.finished) return false
    }
    return true
  }

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomCode}`)
      if (!res.ok) throw new Error('房间不存在')
      const data = await res.json()
      if (data.templates && Array.isArray(data.templates) && data.templates.length > 0) {
        posesRef.current = data.templates
      }
      // waiting 阶段：完整同步游戏阶段
      if (gamePhaseRef.current === 'waiting') {
        if (data.status === 'finished') {
          setGamePhase('result')
        } else if (data.status === 'playing') {
          setGamePhase('countdown')
          setCountdown(3)
        }
      }
      // 游戏中/等待结果/结果页：同步其他玩家的服务器分数和用时
      if (gamePhaseRef.current === 'playing' || gamePhaseRef.current === 'waiting_result' || gamePhaseRef.current === 'result') {
        let scoresChanged = false
        setLiveScores(prev => {
          const next = { ...prev }
          for (const p of data.players || []) {
            if (p.user_id !== user.id) {
              // 已完成用 total_score，进行中用 current_score（实时同步）
              const serverScore = p.finished ? p.total_score : (p.current_score || 0)
              if (serverScore > 0) {
                const local = prev[p.user_id] ?? 0
                if (serverScore > local) {
                  next[p.user_id] = serverScore
                  scoresChanged = true
                }
              }
            }
          }
          return scoresChanged ? next : prev
        })
        let durationsChanged = false
        setLiveDurations(prev => {
          const next = { ...prev }
          for (const p of data.players || []) {
            if (p.user_id !== user.id && p.duration > 0) {
              const local = prev[p.user_id] ?? 0
              if (p.duration > local) {
                next[p.user_id] = p.duration
                durationsChanged = true
              }
            }
          }
          return durationsChanged ? next : prev
        })
        // 服务器标记游戏结束（所有人完成）→ 进入结果页
        if (data.status === 'finished' && gamePhaseRef.current !== 'result') {
          setGamePhase('result')
        }
      }
      // 只在数据实际变化时更新 room，避免无谓重渲染
      if (!roomRef.current || !shallowEqual(roomRef.current, data)) {
        roomRef.current = data
        setRoom(data)
      }
      setLoading(false)
    } catch {
      // 房间不存在（房主解散等）→ 直接回大厅
      navigate('/multi', { replace: true })
    }
  }, [roomCode, user.id])

  // 组件卸载清理
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (scoreRafRef.current) cancelAnimationFrame(scoreRafRef.current)
    }
  }, [])

  useEffect(() => {
    fetchRoom()
  }, [fetchRoom])

  const isChallenge = room?.game_mode === 'challenge'
  const isFollow = room?.game_mode === 'follow'
  const myAvgScore = actionScores.length > 0 ? Math.round(actionScores.reduce((a, b) => a + b, 0) / actionScores.length) : 0

  // 轮询状态同步：waiting 2s，游戏中 3s，等待结果 2s，结果页 3s
  useEffect(() => {
    if (!roomCode) return
    const interval = gamePhase === 'waiting' ? 2000
      : gamePhase === 'playing' ? 3000
      : gamePhase === 'waiting_result' ? 2000
      : gamePhase === 'result' ? 3000
      : 0
    if (interval === 0) return
    const timer = setInterval(fetchRoom, interval)
    return () => clearInterval(timer)
  }, [roomCode, gamePhase, fetchRoom])

  // 游戏中实时同步分数（每 3 秒）
  useEffect(() => {
    if (gamePhase !== 'playing' || !roomCode || !user.id) return
    const syncLiveScore = async () => {
      const score = isFollow ? myAvgScore : totalScore
      try {
        await fetch(`/api/rooms/${roomCode}/submit-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            score,
            max_combo: maxCombo,
            accuracy: 0,
            duration: Math.round(elapsed),
            is_final: false,
          }),
        })
      } catch { /* ignore */ }
    }
    syncLiveScore()
    const timer = setInterval(syncLiveScore, 3000)
    return () => clearInterval(timer)
  }, [gamePhase, roomCode, user.id, totalScore, maxCombo, elapsed, isFollow, myAvgScore])

  const handleReady = async () => {
    if (!user.id) return
    try {
      await fetch(`/api/rooms/${roomCode}/ready?user_id=${user.id}`, {
        method: 'POST',
      })
      fetchRoom()
    } catch (e) {
      console.error('Ready error:', e)
    }
  }

  const handleStartGame = async () => {
    if (!user.id) return
    try {
      const res = await fetch(`/api/rooms/${roomCode}/start?user_id=${user.id}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json()
        setToast(err.detail || '开始游戏失败')
        return
      }
      const roomPoses = room?.templates && room.templates.length > 0
        ? room.templates
        : [...templates].sort(() => Math.random() - 0.5)
      posesRef.current = roomPoses
      setGamePhase('countdown')
      setCountdown(3)
    } catch (e: any) {
      setToast('开始游戏失败')
    }
  }

  const handleLeaveRoom = async () => {
    if (!user.id) return
    // 游戏中退出：先提交当前分数，避免结算失效
    if (gamePhase === 'playing' || gamePhase === 'waiting_result') {
      try {
        const score = isFollow ? myAvgScore : totalScore
        const duration = isChallenge
          ? Math.round(elapsed)
          : isFollow
            ? Math.round(posesRef.current.reduce((s, t) => s + (t.sourceDuration ?? 0), 0))
            : posesRef.current.length * (room?.per_pose_sec || 8)
        await fetch(`/api/rooms/${roomCode}/submit-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            score,
            max_combo: maxCombo,
            accuracy: 0,
            duration,
            is_final: true,
          }),
        })
      } catch { /* 尽力提交 */ }
    }
    try {
      const res = await fetch(`/api/rooms/${roomCode}/leave?user_id=${user.id}`, {
        method: 'POST',
      })
      if (res.ok) {
        navigate('/multi', { replace: true })
      } else {
        // 房间可能已被解散，直接回大厅
        navigate('/multi', { replace: true })
      }
    } catch (e) {
      // 请求失败（房间不存在等），直接回大厅
      navigate('/multi', { replace: true })
    }
  }

  // ============ 倒计时阶段 ============
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('playing')
      setCurrentIndex(0)
      setPoseCountdown(room?.per_pose_sec || 8)
      setCurrentBest(0)
      setActionScores([])
      setActionTimes([])
      setTotalScore(0)
      setMaxCombo(0)
      setCombo(0)
      setElapsed(0)
      comboRef.current = 0
      matchedRef.current = false
      setLiveScores({})
      const now = Date.now()
      sessionStartRef.current = now
      poseStartRef.current = now
      lastSwitchRef.current = now
      // follow 模式初始化
      if (isFollow) {
        followIndexRef.current = 0
        lastScoredIdxRef.current = 0
        followFrameStartRef.current = now
        coachCanvasRef.current?.advance(0, now)
        if (videoBgRef.current && posesRef.current[0]?.timestamp !== undefined) {
          videoBgRef.current.currentTime = posesRef.current[0].timestamp
        }
      }
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [gamePhase, countdown, room?.per_pose_sec])

  // ============ DOM 直写分数 ============
  const updateScoreDOM = useCallback((score: number) => {
    scoreRef.current = score
    const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
    if (scoreDisplayRef.current) {
      scoreDisplayRef.current.textContent = String(score)
      scoreDisplayRef.current.style.color = color
    }
    if (ringCircleRef.current) {
      const r = 74
      const c = r * 2 * Math.PI
      ringCircleRef.current.style.strokeDashoffset = String(c - (score / 100) * c)
      ringCircleRef.current.style.stroke = color
    }
    if (ringTextRef.current) {
      ringTextRef.current.textContent = `${score}%`
      ringTextRef.current.style.color = color
    }
  }, [])

  // ============ 游戏中实时评分 ============
  const currentVideoUrl = videoMode === 'bone'
    ? (room?.bone_video_path ? `/videos/${room.bone_video_path}` : undefined)
    : (room?.video_path ? `/videos/${room.video_path}` : undefined)
  const hasVideoBg = isFollow && !!currentVideoUrl
  const hasBothVideos = isFollow && !!room?.bone_video_path && !!room?.video_path
  const handlePoseResult = useCallback(
    (_hasPerson: boolean, landmarks: any[] | null) => {
      if (gamePhaseRef.current !== 'playing' || !landmarks) {
        updateScoreDOM(0)
        return
      }
      // follow 模式：用 followIndexRef 读取最新帧（state 有延迟）
      const pose = isFollow ? posesRef.current[followIndexRef.current] : posesRef.current[currentIndex]
      if (!pose) return

      latestLandmarksRef.current = { landmarks, time: Date.now() }
      if (scorePendingRef.current) return
      scorePendingRef.current = true
      scoreRafRef.current = requestAnimationFrame(() => {
        scorePendingRef.current = false
        const data = latestLandmarksRef.current
        if (!data) return

        // follow 模式：关键点余弦相似度；闯关/节拍：角度规则评分
        const match = isFollow
          ? calculateKeypointSimilarity(data.landmarks, pose, scoringMode)
          : calculatePoseMatchScore(data.landmarks, pose, scoringMode)
        updateScoreDOM(match)
        if (match > currentBest) setCurrentBest(match)

        // challenge 模式：达标即切换
        if (isChallenge) {
          const ts = Date.now()
          if (ts - lastSwitchRef.current < 500) return
          if (match >= 80) {
            lastSwitchRef.current = ts
            const poseTime = (ts - poseStartRef.current) / 1000
            setActionTimes(prev => [...prev, poseTime])
            setActionScores(prev => [...prev, match])

            setCurrentIndex(idx => {
              const next = idx + 1
              if (next >= posesRef.current.length) {
                setGamePhase('waiting_result')
                submitScore()
                return idx
              }
              poseStartRef.current = Date.now()
              setCurrentBest(0)
              return next
            })
          }
          return
        }

        // rhythm 模式：达标计分（切换由定时器驱动）
        const now = Date.now()
        if (match >= 80 && now - lastMatchTimeRef.current > 1000 && !matchedRef.current) {
          lastMatchTimeRef.current = now
          matchedRef.current = true
          const currentCombo = comboRef.current
          const basePoints = 100
          const comboBonus = currentCombo * 10
          const points = basePoints + comboBonus

          setTotalScore(prev => prev + points)
          setCombo((c) => {
            const newCombo = c + 1
            comboRef.current = newCombo
            setMaxCombo((m) => Math.max(m, newCombo))
            return newCombo
          })

          setTimeout(() => {
            matchedRef.current = false
          }, 800)
        } else if (match < 50 && matchedRef.current) {
          setCombo(0)
          comboRef.current = 0
          matchedRef.current = false
        }
      })
    },
    [currentIndex, currentBest, scoringMode, updateScoreDOM, user.id, isChallenge, isFollow]
  )

  // ============ rhythm/follow tick ============
  useEffect(() => {
    if (gamePhase !== 'playing' || isChallenge) return

    // follow 模式：视频驱动或 rAF 驱动
    if (isFollow) {
      if (hasVideoBg && videoBgRef.current) {
        const video = videoBgRef.current
        video.play().catch(() => {})

        const tick = () => {
          const ct = video.currentTime
          const total = posesRef.current.length
          if (total === 0) {
            tickRef.current = requestAnimationFrame(tick)
            return
          }

          // 定位当前帧
          let idx = 0
          for (let i = 0; i < total; i++) {
            if ((posesRef.current[i].timestamp ?? 0) <= ct) idx = i
            else break
          }
          idx = Math.min(idx, total - 1)

          // 同步帧索引给评分层
          followIndexRef.current = idx
          if (lastScoredIdxRef.current !== idx) {
            const prevScore = scoreRef.current
            setActionScores(prev => [...prev, prevScore])
            lastScoredIdxRef.current = idx
            setCurrentIndex(idx)
            setCurrentBest(0)
            coachCanvasRef.current?.advance(idx, Date.now())
          }

          // DOM 直写倒计时
          const lastTs = posesRef.current[total - 1]?.timestamp ?? 0
          const firstTs = posesRef.current[0]?.timestamp ?? 0
          const totalRemain = Math.max(0, lastTs - ct)
          if (followCountdownDisplayRef.current) {
            followCountdownDisplayRef.current.textContent = `${totalRemain.toFixed(1)}s`
            followCountdownDisplayRef.current.style.color = totalRemain <= 1 ? '#f87171' : '#ffffff'
          }
          if (followProgressRef.current) {
            const overallPct = lastTs > firstTs ? ((ct - firstTs) / (lastTs - firstTs)) * 100 : 0
            followProgressRef.current.style.width = `${Math.max(0, Math.min(100, overallPct))}%`
          }

          tickRef.current = requestAnimationFrame(tick)
        }
        tickRef.current = requestAnimationFrame(tick)

        const onEnded = () => {
          const finalScore = scoreRef.current
          setActionScores(prev => {
            if (prev.length < posesRef.current.length) return [...prev, finalScore]
            return prev
          })
          setGamePhase('waiting_result')
          submitScore()
        }
        video.addEventListener('ended', onEnded)
        return () => {
          if (tickRef.current) cancelAnimationFrame(tickRef.current)
          video.removeEventListener('ended', onEnded)
          video.pause()
        }
      }

      // 无视频：rAF 驱动固定帧率
      const FOLLOW_FPS = 3
      const tick = () => {
        const idx = followIndexRef.current
        const pose = posesRef.current[idx]
        if (!pose) { tickRef.current = requestAnimationFrame(tick); return }
        const frameDuration = 1 / FOLLOW_FPS
        const now = Date.now()
        const elapsedMs = (now - followFrameStartRef.current) / 1000
        const remaining = Math.max(0, frameDuration - elapsedMs)

        if (followCountdownDisplayRef.current) {
          followCountdownDisplayRef.current.textContent = `${remaining.toFixed(1)}s`
          followCountdownDisplayRef.current.style.color = remaining <= 1 ? '#f87171' : '#ffffff'
        }
        if (followProgressRef.current) {
          followProgressRef.current.style.width = `${Math.min(100, (elapsedMs / frameDuration) * 100)}%`
        }

        if (elapsedMs >= frameDuration) {
          const finalScore = scoreRef.current
          setActionScores(prev => [...prev, finalScore])
          const nextIdx = idx + 1
          if (nextIdx >= posesRef.current.length) {
            setGamePhase('waiting_result')
            submitScore()
            return
          }
          followIndexRef.current = nextIdx
          const newStart = Date.now()
          followFrameStartRef.current = newStart
          lastScoredIdxRef.current = nextIdx
          coachCanvasRef.current?.advance(nextIdx, newStart)
          setCurrentIndex(nextIdx)
          setCurrentBest(0)
        }
        tickRef.current = requestAnimationFrame(tick)
      }
      tickRef.current = requestAnimationFrame(tick)
      return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current) }
    }

    // rhythm: 1s 倒计时

    tickRef.current = window.setInterval(() => {
      setPoseCountdown((prev) => {
        if (prev <= 1) {
          // 当前动作结束，记录分数
          const finalScore = scoreRef.current
          setActionScores((prevScores) => [...prevScores, finalScore])

          setCurrentIndex((idx) => {
            const next = idx + 1
            if (next >= posesRef.current.length) {
              // 个人完成 → 提交分数，进入等待结果
              setGamePhase('waiting_result')
              submitScore()
              return idx
            }
            setCurrentBest(0)
            return next
          })
          return perPoseSec
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [gamePhase, room?.per_pose_sec, isChallenge, isFollow, hasVideoBg])

  // ============ challenge 计时器 ============
  useEffect(() => {
    if (gamePhase !== 'playing' || !isChallenge) return
    challengeTimerRef.current = window.setInterval(() => {
      setElapsed((Date.now() - sessionStartRef.current) / 1000)
    }, 100)
    return () => {
      if (challengeTimerRef.current) window.clearInterval(challengeTimerRef.current)
    }
  }, [gamePhase, isChallenge])

  // ============ ESC 退出（仅游戏中） ============
  useEffect(() => {
    if (gamePhase !== 'playing') return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleLeaveRoom()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [gamePhase, handleLeaveRoom])

  // 提交分数到服务器
  const submitScore = async () => {
    if (!user.id || !room) return
    try {
      // follow 模式提交平均分，challenge 提交总分+用时，rhythm 提交总分
      const finalScore = isFollow
        ? (actionScores.length > 0 ? Math.round(actionScores.reduce((a, b) => a + b, 0) / actionScores.length) : 0)
        : totalScore
      const duration = isChallenge
        ? Math.round(elapsed)
        : isFollow
          ? Math.round(posesRef.current.reduce((s, t) => s + (t.sourceDuration ?? 0), 0))
          : posesRef.current.length * (room.per_pose_sec || 8)
      await fetch(`/api/rooms/${roomCode}/submit-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          score: finalScore,
          max_combo: maxCombo,
          accuracy: 0,
          duration,
        }),
      })
      fetchRoom() // 同步最终排名
    } catch (e) {
      console.error('Submit score error:', e)
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '')
  }

  const isHost = room?.host_id === user.id
  const me = room?.players.find((p) => p.user_id === user.id)

  // 合并服务器分数和实时分数用于排名
  const sortedPlayers = [...(room?.players || [])].map(p => ({
    ...p,
    displayScore: p.user_id === user.id
      ? (gamePhase === 'playing' || gamePhase === 'result'
          ? (isFollow ? myAvgScore : totalScore)
          : p.total_score)
      : (liveScores[p.user_id] ?? p.total_score),
    displayDuration: p.user_id === user.id
      ? (gamePhase === 'playing' || gamePhase === 'result' ? Math.round(elapsed) : p.duration)
      : p.finished
        ? (liveDurations[p.user_id] ?? p.duration)
        : (room?.started_at ? Math.round((Date.now() - new Date(room.started_at).getTime()) / 1000) : 0),
  })).sort((a, b) => {
    if (isChallenge) {
      if (a.finished && b.finished) return a.displayDuration - b.displayDuration
      if (a.finished) return -1
      if (b.finished) return 1
      return 0
    }
    return b.displayScore - a.displayScore
  })

  const currentPose = posesRef.current[currentIndex]
  const perPoseSec = room?.per_pose_sec || 8
  const progress = ((perPoseSec - poseCountdown) / perPoseSec) * 100
  const averageScore = actionScores.length > 0
    ? Math.round(actionScores.reduce((a, b) => a + b, 0) / actionScores.length)
    : 0
  const totalDuration = posesRef.current.length * perPoseSec

  // ============ 加载中 ============
  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <GameBackground />
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>加载房间中...</p>
        </div>
      </div>
    )
  }

  // ============ 错误 ============
  if (error || !room) {
    return (
      <div className="min-h-screen text-white">
        <GameBackground />
        <FloatingNav />
        <main className="pt-20 pb-12 px-4 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-2xl font-bold mb-2">{error || '房间不存在'}</h2>
            <p className="text-white/60 mb-6">
              {error === '房主已解散房间' ? '房间已被房主解散' : '请检查房间号是否正确'}
            </p>
            <button
              onClick={() => navigate('/multi')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium"
            >
              返回多人模式
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ============ 倒计时 ============
  if (gamePhase === 'countdown') {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <GameBackground />
        <FloatingNav />
        <main className="pt-20 flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 mb-2">{room.level_name}</p>
            <div className="text-9xl font-bold bg-gradient-to-b from-white to-transparent bg-clip-text text-transparent animate-pulse">
              {countdown > 0 ? countdown : '开始'}
            </div>
            <p className="text-white/40 text-sm mt-4">{posesRef.current.length} 个动作 · 每动作 {room.per_pose_sec}s</p>
          </div>
        </main>
      </div>
    )
  }

  // ============ 等待其他玩家完成 ============
  if (gamePhase === 'waiting_result') {
    const finishedCount = room?.players.filter(p => p.finished).length || 0
    const totalCount = room?.players.length || 1
    return (
      <div className="min-h-screen text-white flex flex-col">
        <GameBackground />
        <FloatingNav />
        <main className="pt-20 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold mb-2">你完成了！</h2>
            <p className="text-white/60 mb-6">
              等待其他玩家完成… ({finishedCount}/{totalCount})
            </p>
            <div className="flex justify-center gap-4 mb-8">
              <div className="glass rounded-2xl p-4 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-yellow-400">{totalScore}</div>
                <div className="text-white/50 text-xs mt-1">总分</div>
              </div>
              <div className="glass rounded-2xl p-4 text-center min-w-[100px]">
                <div className="text-2xl font-bold text-orange-400">{maxCombo}</div>
                <div className="text-white/50 text-xs mt-1">最高连击</div>
              </div>
            </div>
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </main>
      </div>
    )
  }

  // ============ 游戏结果 ============
  if (gamePhase === 'result') {
    return (
      <div className="min-h-screen text-white">
        <GameBackground />
        <FloatingNav />
        <main className="pt-20 pb-12 px-4 flex items-center justify-center min-h-[80vh]">
          <div className="text-center max-w-md w-full">
            <div className="text-7xl mb-4">
              {sortedPlayers[0]?.user_id === user.id ? '🏆' : '💪'}
            </div>
            <h2 className="text-3xl font-bold mb-2">游戏结束！</h2>
            <p className="text-white/60 mb-6">{room.level_name}</p>

            {/* 个人统计 */}
            <div className="glass rounded-2xl p-6 mb-6 space-y-3">
              {isFollow ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/60">平均分</span>
                    <span className="text-2xl font-bold text-yellow-400">{myAvgScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">总时长</span>
                    <span className="text-lg">{Math.round(posesRef.current.reduce((s, t) => s + (t.sourceDuration ?? 0), 0))}s</span>
                  </div>
                </>
              ) : isChallenge ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/60">总分</span>
                    <span className="text-2xl font-bold text-yellow-400">{totalScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">总用时</span>
                    <span className="text-xl font-bold text-emerald-400">{elapsed.toFixed(1)}s</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/60">总分</span>
                    <span className="text-2xl font-bold text-yellow-400">{totalScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">平均匹配度</span>
                    <span className="text-xl font-bold">{averageScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">最高连击</span>
                    <span className="text-lg text-orange-400">{maxCombo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">总时长</span>
                    <span className="text-lg">{totalDuration}s</span>
                  </div>
                </>
              )}
            </div>

            {/* 各动作详情 */}
            <div className="glass rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {posesRef.current.slice(0, actionScores.length).map((t, i) => (
                  <div key={`${t.id}-${i}`} className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
                    <PoseFigure template={t} size={36} />
                    <span className="flex-1 text-sm truncate">{t.name}</span>
                    {isChallenge ? (
                      <span className="text-emerald-400 text-sm font-mono">
                        {actionTimes[i]?.toFixed(1)}s
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'font-bold w-10 text-right text-sm',
                          actionScores[i] >= 80 ? 'text-green-400' : actionScores[i] >= 60 ? 'text-yellow-400' : 'text-red-400'
                        )}
                      >
                        {actionScores[i]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 排名榜 */}
            <div className="glass rounded-2xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-white/60 mb-3">最终排名</h3>
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl',
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
                        : player.user_id === user.id
                        ? 'bg-purple-500/20 border border-purple-500/30'
                        : 'bg-white/5'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </span>
                      <span className="font-medium">{player.nickname}</span>
                      {player.is_host && <Crown className="text-yellow-400" size={14} />}
                    </div>
                    <span className="font-bold text-lg">
                      {isChallenge ? `${player.displayDuration}s` : `${player.displayScore}分`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleLeaveRoom}
                className="flex-1 px-6 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-all"
              >
                {isHost ? '解散房间' : '退出房间'}
              </button>
              <button
                onClick={async () => {
                  // 房主调用 restart 重置房间
                  if (isHost) {
                    try {
                      const res = await fetch(`/api/rooms/${roomCode}/restart?user_id=${user.id}`, { method: 'POST' })
                      if (!res.ok) {
                        // 房间不存在，回大厅
                        navigate('/multi', { replace: true })
                        return
                      }
                    } catch {
                      navigate('/multi', { replace: true })
                      return
                    }
                  } else {
                    // 非房主先检查房间是否还在且未被解散
                    try {
                      const res = await fetch(`/api/rooms/${roomCode}`)
                      if (!res.ok) {
                        navigate('/multi', { replace: true })
                        return
                      }
                      const data = await res.json()
                      if (data.status === 'finished') {
                        // 房间已解散，回大厅
                        navigate('/multi', { replace: true })
                        return
                      }
                    } catch {
                      navigate('/multi', { replace: true })
                      return
                    }
                  }
                  setGamePhase('waiting')
                  setCurrentIndex(0)
                  setPoseCountdown(0)
                  setCurrentBest(0)
                  setActionScores([])
                  setActionTimes([])
                  setTotalScore(0)
                  setMaxCombo(0)
                  setCombo(0)
                  setElapsed(0)
                  comboRef.current = 0
                  setLiveScores({})
                  setLiveDurations({})
                  // follow 模式重置
                  followIndexRef.current = 0
                  lastScoredIdxRef.current = -1
                  followFrameStartRef.current = 0
                  if (videoBgRef.current) {
                    videoBgRef.current.pause()
                  }
                  if (room?.video_path) {
                    setVideoMode('original')
                  }
                  fetchRoom()
                }}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                返回房间
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ============ 游戏进行中 ============
  if (gamePhase === 'playing') {
    if (!currentPose) {
      return (
        <div className="min-h-screen text-white flex items-center justify-center">
          <GameBackground />
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>加载中...</p>
          </div>
        </div>
      )
    }

    // 跟练模式：隐藏视频元素（src 变化后恢复播放）
    const videoModeEffect = (
      <style>{`
        .follow-video-hidden { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
      `}</style>
    )

    return (
      <div className="min-h-screen text-white">
        {videoModeEffect}
        <main className="pt-6 pb-6 px-4">
          <div className="mx-auto">
            {/* 顶部栏 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleLeaveRoom}
                className="flex items-center gap-2 text-white/70 hover:text-white"
              >
                <ArrowLeft size={20} />
                <span>退出</span>
              </button>
              <div className="text-center">
                <div className="text-xs text-white/50">{room.level_name}</div>
                <div className="text-sm font-medium">
                  {isFollow ? `帧 ${currentIndex + 1} / ${posesRef.current.length}` : `动作 ${currentIndex + 1} / ${posesRef.current.length}`}
                </div>
              </div>
              <div className="text-sm">
                {isChallenge ? (
                  <span className="text-emerald-400 font-mono font-bold">{elapsed.toFixed(1)}s</span>
                ) : (
                  <span className="text-white/60">
                    最佳: <span className="text-green-400 font-bold">{currentBest}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 跟练模式：视频时间轴 */}
            {isFollow && (
              <div className="mb-3 glass rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-white/60">视频时间轴</span>
                  <span className="font-mono text-cyan-400">
                    {currentPose.timestamp !== undefined ? `${currentPose.timestamp.toFixed(1)}s` : '--'}
                    {' / '}
                    {posesRef.current.reduce((s, t) => s + (t.sourceDuration ?? 0), 0).toFixed(1)}s
                  </span>
                </div>
                <div className="flex gap-0.5 items-center">
                  {posesRef.current.map((t, i) => {
                    const dur = t.sourceDuration ?? 1
                    const widthPercent = (dur / posesRef.current.reduce((s, x) => s + (x.sourceDuration ?? 0), 0)) * 100
                    const isCurrent = i === currentIndex
                    const isDone = i < currentIndex
                    return (
                      <div
                        key={`${t.id}-${i}`}
                        className={cn(
                          'h-2 rounded-sm transition-all',
                          isCurrent
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 ring-2 ring-emerald-300/50'
                            : isDone
                              ? 'bg-emerald-500/40'
                              : 'bg-white/15'
                        )}
                        style={{ width: `${Math.max(0.5, widthPercent)}%` }}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* ============ 跟练模式：左右分屏布局 ============ */}
            {isFollow ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-230px)]">
                {/* 左侧：用户摄像头 */}
                <div className="relative">
                  <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-xs font-medium text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                    我的动作
                  </div>
                  {/* 左下角：实时分数浮层 */}
                  <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm">
                    <div className="relative inline-flex items-center justify-center">
                      <svg width={56} height={56} className="transform -rotate-90">
                        <circle cx={28} cy={28} r={24} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={5} />
                        <circle
                          ref={ringCircleRef}
                          cx={28}
                          cy={28}
                          r={24}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth={5}
                          strokeLinecap="round"
                          strokeDasharray={24 * 2 * Math.PI}
                          strokeDashoffset={24 * 2 * Math.PI}
                          style={{ transition: 'stroke-dashoffset 0.1s ease-out, stroke 0.1s' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span ref={ringTextRef} className="text-sm font-bold" style={{ color: '#ef4444' }}>0%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/50">实时分数</div>
                      <span ref={scoreDisplayRef} className="text-2xl font-bold block leading-none" style={{ color: '#ffffff' }}>0</span>
                    </div>
                  </div>
                  {/* 右下角：倒计时 + 进度条 */}
                  <div className="absolute bottom-3 right-3 z-20 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm text-center">
                    <div className="text-[10px] text-white/50 mb-0.5">剩余时间</div>
                    <span
                      ref={followCountdownDisplayRef}
                      className="text-2xl font-bold font-mono"
                      style={{ color: '#ffffff' }}
                    >
                      {(currentPose.sourceDuration ?? 1).toFixed(1)}s
                    </span>
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                      <div
                        ref={followProgressRef}
                        className="h-full rounded-full"
                        style={{ width: '0%', background: 'linear-gradient(to right, #10b981, #06b6d4)' }}
                      />
                    </div>
                  </div>
                  <Camera
                    enabled
                    width={1280}
                    height={720}
                    mirrored={mirrored}
                    displayMode={displayMode}
                    template={currentPose}
                    scoringMode={scoringMode}
                    onPoseResult={handlePoseResult}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>

                {/* 右侧：教练示范 */}
                <div className="relative glass rounded-2xl overflow-hidden flex flex-col">
                  {/* 顶部标签 */}
                  <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
                    <div className="px-3 py-1 rounded-full bg-emerald-500/30 backdrop-blur-sm text-xs font-medium text-emerald-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                      教练示范
                    </div>
                    {currentIndex + 1 < posesRef.current.length && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                        <span className="text-[10px] text-white/50">下一帧</span>
                        <div className="w-8 h-8 flex items-center justify-center bg-black/40 rounded">
                          <PoseFigure template={posesRef.current[currentIndex + 1]} size={28} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 动作名称 */}
                  <div className="relative z-10 pt-16 pb-2 text-center">
                    <h2 className="text-2xl font-bold mb-0.5">{currentPose.name}</h2>
                    {currentPose.timestamp !== undefined && (
                      <p className="text-cyan-400/70 text-xs font-mono">
                        ⏱ {currentPose.timestamp.toFixed(1)}s · 持续 {currentPose.sourceDuration?.toFixed(1)}s
                      </p>
                    )}
                  </div>

                  {/* 视频 / 骨骼图 */}
                  <div className="flex-1 flex items-center justify-center relative">
                    {hasVideoBg && (
                      <video
                        ref={videoBgRef}
                        src={currentVideoUrl}
                        className={cn(
                          "absolute inset-0 w-full h-full object-contain rounded-xl",
                          mirrored && "scale-x-[-1]"
                        )}
                        muted
                        playsInline
                      />
                    )}
                    {!hasVideoBg && (
                      <FollowCoachCanvas
                        ref={coachCanvasRef}
                        templates={posesRef.current}
                        currentIndex={currentIndex}
                        size={480}
                        scoringMode={scoringMode}
                        highlight={currentBest >= 60}
                        mirrored={mirrored}
                        frameStartMs={followFrameStartRef.current}
                        frameDuration={1 / 3}
                        coachMode
                      />
                    )}
                    {/* 视频切换按钮 */}
                    {hasBothVideos && (
                      <button
                        onClick={() => setVideoMode(v => v === 'bone' ? 'original' : 'bone')}
                        className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg backdrop-blur-sm border border-white/10 transition-colors"
                      >
                        {videoMode === 'bone' ? '切换原视频' : '切换骨骼'}
                      </button>
                    )}
                    {/* 小骨骼图（原视频模式下） */}
                    {hasVideoBg && videoMode === 'original' && (
                      <div className="absolute bottom-4 right-4 w-32 h-32 bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 z-10">
                        <FollowCoachCanvas
                          ref={coachCanvasRef}
                          templates={posesRef.current}
                          currentIndex={currentIndex}
                          size={128}
                          scoringMode={scoringMode}
                          highlight={currentBest >= 60}
                          mirrored={mirrored}
                          frameStartMs={followFrameStartRef.current}
                        />
                      </div>
                    )}
                  </div>

                  {/* 底部：实时排名 + 控制 */}
                  <div className="relative z-10 p-4 space-y-3">
                    {/* 实时排名 */}
                    <div className="glass rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white/60 text-xs flex items-center gap-1">
                          <Trophy size={12} /> 实时排名
                        </span>
                        <span className="text-yellow-400 text-sm font-bold">{myAvgScore}</span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {sortedPlayers.map((player, index) => (
                          <div
                            key={player.id}
                            className={cn(
                              'flex items-center justify-between px-2 py-1 rounded-lg text-xs',
                              player.user_id === user.id ? 'bg-purple-500/30' : 'bg-white/5'
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 text-[10px]">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index + 1}
                              </span>
                              <span className="font-medium truncate max-w-16">{player.nickname}</span>
                              {player.is_host && <Crown className="text-yellow-400" size={10} />}
                            </div>
                            <span className="font-bold">{player.displayScore}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 控制按钮 */}
                    <div className="flex gap-1.5 flex-wrap">
                      {(Object.keys(SCORING_MODES) as ScoringMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setScoringMode(m)}
                          className={cn(
                            'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                            scoringMode === m ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                          )}
                        >
                          <span className="mr-1">{SCORING_MODES[m].icon}</span>
                          {SCORING_MODES[m].label}
                        </button>
                      ))}
                      <div className="w-px h-5 bg-white/20 mx-1" />
                      {(['overlay', 'drawing', 'original'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setDisplayMode(m)}
                          className={cn(
                            'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                            displayMode === m ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                          )}
                        >
                          {m === 'overlay' ? '叠加' : m === 'drawing' ? '骨架' : '原图'}
                        </button>
                      ))}
                      <button
                        onClick={() => setMirrored((v) => !v)}
                        className={cn(
                          'px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1',
                          mirrored ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                        )}
                      >
                        <FlipHorizontal size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-180px)]">
              {/* 左侧：摄像头 */}
              <div className="lg:col-span-3 relative">
                <Camera
                  enabled
                  width={1280}
                  height={720}
                  mirrored={mirrored}
                  displayMode={displayMode}
                  template={currentPose}
                  scoringMode={scoringMode}
                  onPoseResult={handlePoseResult}
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>

              {/* 右侧：仪表盘 + 积分榜 */}
              <div className="lg:col-span-2 relative glass rounded-2xl overflow-hidden flex flex-col">
                {/* 目标骨骼图（背景） */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                  <PoseFigure
                    template={currentPose}
                    autoSize
                    className="w-full h-full"
                    highlight={currentBest >= 60}
                    scoringMode={scoringMode}
                  />
                </div>

                {/* 顶部：动作名称 */}
                <div className="relative z-10 p-6 text-center">
                  <h2 className="text-2xl font-bold mb-1">{currentPose.name}</h2>
                  <p className="text-white/50 text-sm">{currentPose.description}</p>
                </div>

                {/* 中部：匹配度环形 */}
                <div className="relative z-10 flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center">
                      <svg width={140} height={140} className="transform -rotate-90">
                        <circle cx={70} cy={70} r={64} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} />
                        <circle
                          ref={ringCircleRef}
                          cx={70}
                          cy={70}
                          r={64}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth={10}
                          strokeLinecap="round"
                          strokeDasharray={64 * 2 * Math.PI}
                          strokeDashoffset={64 * 2 * Math.PI}
                          style={{ transition: 'stroke-dashoffset 0.1s ease-out, stroke 0.1s' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span ref={ringTextRef} className="text-xl font-bold" style={{ color: '#ef4444' }}>0%</span>
                      </div>
                    </div>
                    <p className="text-white/50 text-sm mt-2">匹配度</p>
                    <span ref={scoreDisplayRef} className="text-3xl font-bold mt-1 block" style={{ color: '#ffffff' }}>0</span>
                  </div>
                </div>

                {/* 下部：数据面板 */}
                <div className="relative z-10 p-4 space-y-3">
                  {/* 倒计时 / 计时器 */}
                  <div className="glass rounded-xl p-3">
                    {isChallenge ? (
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-xs">总用时</span>
                        <span className="text-xl font-bold font-mono text-emerald-400">
                          {elapsed.toFixed(1)}s
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/60 text-xs">动作倒计时</span>
                          <span className={cn(
                            'text-xl font-bold font-mono',
                            poseCountdown <= 3 && 'text-red-400 animate-pulse'
                          )}>
                            {poseCountdown}s
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all ease-linear"
                            style={{
                              width: `${progress}%`,
                              transitionDuration: '1000ms',
                              background: poseCountdown <= 3
                                ? '#ef4444'
                                : 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* 积分榜 */}
                  <div className="glass rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60 text-xs flex items-center gap-1">
                        <Trophy size={12} /> 实时排名
                      </span>
                      <span className="text-yellow-400 text-sm font-bold">
                        {isChallenge ? `${Math.round(elapsed)}s` : totalScore}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {sortedPlayers.map((player, index) => (
                        <div
                          key={player.id}
                          className={cn(
                            'flex items-center justify-between px-2 py-1 rounded-lg text-xs',
                            player.user_id === user.id ? 'bg-purple-500/30' : 'bg-white/5'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 text-[10px]">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index + 1}
                            </span>
                            <span className="font-medium truncate max-w-16">{player.nickname}</span>
                            {player.is_host && <Crown className="text-yellow-400" size={10} />}
                          </div>
                          <span className="font-bold">
                            {isChallenge ? `${player.displayDuration}s` : player.displayScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 控制按钮 */}
                  <div className="flex gap-1.5">
                    {(['overlay', 'drawing', 'original'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDisplayMode(m)}
                        className={cn(
                          'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                          displayMode === m ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                        )}
                      >
                        {m === 'overlay' ? '叠加' : m === 'drawing' ? '骨架' : '原图'}
                      </button>
                    ))}
                    <button
                      onClick={() => setMirrored((v) => !v)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1',
                        mirrored ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      )}
                    >
                      <FlipHorizontal size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ============ 等待大厅 ============
  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav />
      {/* toast 提示 */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500/90 text-white rounded-xl shadow-lg backdrop-blur-sm animate-bounce text-sm font-medium">
          {toast}
        </div>
      )}

      <main className="pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">房间 {roomCode}</h1>
              <button
                onClick={copyRoomCode}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="复制房间号"
              >
                <Copy size={20} />
              </button>
            </div>
            <button
              onClick={handleLeaveRoom}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all"
            >
              <LogOut size={18} />
              {isHost ? '解散房间' : '退出房间'}
            </button>
          </div>

          <div className="glass rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-white/60">
                  {posesRef.current.length > 0 ? `${posesRef.current.length} 个动作 × ${room.per_pose_sec}s` : `${room.round_duration} 秒`} · {room.players.length}/{room.max_players} 人
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
                <Users size={20} />
                <span className="font-bold">{room.players.length}</span>
              </div>
            </div>

            {/* 关卡信息 */}
            {room.level_name && (
              <div className="mb-8 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Target size={20} />
                  </div>
                  <div>
                    <div className="font-bold">{room.level_name}</div>
                    <div className="text-sm text-white/50">
                      {room.game_mode === 'challenge' ? '闯关模式' : room.game_mode === 'follow' ? '跟练模式' : '节拍模式'}
                      {room.templates && ` · ${room.templates.length} 个动作`}
                      {!isFollow && ` · 每动作 ${room.per_pose_sec}s`}
                      {isFollow && room.video_path && ' · 有视频'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users size={20} />
                玩家列表
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all',
                      player.user_id === user.id
                        ? 'bg-purple-500/20 border-purple-500/50'
                        : 'bg-white/5 border-white/10'
                    )}
                  >
                    <div className="text-3xl mb-2 text-center">
                      {player.is_host ? '👑' : '🎮'}
                    </div>
                    <div className="text-center">
                      <div className="font-bold truncate">{player.nickname}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {player.is_host ? '房主' : '玩家'}
                      </div>
                      <div className="mt-2">
                        {player.is_ready ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400">
                            <Check size={14} />
                            已准备
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <X size={14} />
                            未准备
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, room.max_players - room.players.length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="p-4 rounded-2xl border border-dashed border-white/10 flex items-center justify-center h-[120px]"
                  >
                    <span className="text-white/30 text-sm">等待加入...</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleReady}
                className={cn(
                  'flex-1 py-4 rounded-xl font-bold transition-all',
                  me?.is_ready
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:shadow-green-500/30'
                )}
              >
                {me?.is_ready ? '取消准备' : '准备就绪'}
              </button>
              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={room.players.length < 2}
                  className={cn(
                    'flex-1 py-4 rounded-xl font-bold transition-all',
                    room.players.length < 2
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02]'
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Play size={20} />
                    开始游戏
                  </span>
                </button>
              )}
            </div>
            {isHost && room.players.length < 2 && (
              <p className="text-center text-white/40 text-sm mt-3">
                至少需要 2 名玩家才能开始游戏
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
