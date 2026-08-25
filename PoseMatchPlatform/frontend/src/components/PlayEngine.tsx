import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, FlipHorizontal, Upload, Trophy, CheckCircle } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import Camera from '@/components/Camera'
import PoseFigure from '@/components/PoseFigure'
import FollowCoachCanvas, { type FollowCoachCanvasHandle } from '@/components/FollowCoachCanvas'
import { calculatePoseMatchScore, calculateKeypointSimilarity, type PoseTemplate, type ScoringMode, SCORING_MODES } from '@/utils/poseMatcher'
import { useUserStore } from '@/store/userStore'
import { cn } from '@/lib/utils'

export type PlayMode = 'challenge' | 'rhythm' | 'follow'

export interface PlayEngineProps {
  mode: PlayMode
  templates: PoseTemplate[]
  levelName: string
  /** challenge 达标线，默认 80 */
  passScore?: number
  /** rhythm 每动作时长（秒），默认 8 */
  perPoseSec?: number
  /** challenge 关卡总时限（秒），到时自动结束 */
  timeLimit?: number
  /** 跟练模式骨骼视频 URL（默认播放） */
  boneVideoUrl?: string
  /** 跟练模式原视频 URL（可选切换） */
  videoUrl?: string
  onExit?: () => void
}

type Phase = 'countdown' | 'playing' | 'result'
type DisplayMode = 'overlay' | 'drawing' | 'original'

const CHALLENGE_PASS_SCORE = 80
// 单动作超时保护（秒），防止卡死
const CHALLENGE_POSE_TIMEOUT = 60

/**
 * 统一游玩引擎：支持闯关(challenge)/节拍(rhythm)/跟练(follow) 三种模式
 *
 * - challenge：rAF 持续评分，达标(≥passScore)即切换，评价=总耗时
 * - rhythm：1s 倒计时，时间到取最后瞬间分，评价=平均分
 * - follow：100ms 浮点倒计时(按 sourceDuration)，时间到取最后瞬间分，评价=平均分
 *
 * 性能优化：评分用 rAF + ref + DOM 直写，不触发 React 重渲染
 */
export default function PlayEngine({
  mode,
  templates,
  levelName,
  passScore = CHALLENGE_PASS_SCORE,
  perPoseSec = 8,
  timeLimit,
  boneVideoUrl,
  videoUrl,
  onExit,
}: PlayEngineProps) {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUserStore()

  // 视频展示模式：original（原视频，默认）/ bone（骨骼视频）
  const [videoMode, setVideoMode] = useState<'bone' | 'original'>('original')
  // 是否有可切换的视频模式
  const hasBothVideos = !!boneVideoUrl && !!videoUrl

  const [phase, setPhase] = useState<Phase>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [currentIndex, setCurrentIndex] = useState(0)

  // rhythm/follow 倒计时
  const [poseCountdown, setPoseCountdown] = useState(0)
  // challenge 已用时间
  const [elapsed, setElapsed] = useState(0)

  const [actionScores, setActionScores] = useState<number[]>([])
  const [actionTimes, setActionTimes] = useState<number[]>([]) // challenge 各动作达标用时
  const [currentBest, setCurrentBest] = useState(0)

  const [displayMode, setDisplayMode] = useState<DisplayMode>('overlay')
  const [mirrored, setMirrored] = useState(true)

  // 切换视频模式时，确保视频继续播放（src 变化后浏览器会暂停）
  useEffect(() => {
    if (phase !== 'playing' || !videoBgRef.current) return
    const video = videoBgRef.current
    // 等待新 src 加载完成后恢复播放
    const onLoaded = () => { video.play().catch(() => {}) }
    video.addEventListener('loadeddata', onLoaded, { once: true })
    // 如果已经加载好了直接播放
    if (video.readyState >= 2) {
      video.removeEventListener('loadeddata', onLoaded)
      video.play().catch(() => {})
    }
    return () => video.removeEventListener('loadeddata', onLoaded)
  }, [videoMode, phase])
  const [scoringMode, setScoringMode] = useState<ScoringMode>('upper')
  const [uploaded, setUploaded] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 性能优化：ref + DOM 直写，避免每帧重渲染
  const scoreRef = useRef(0)
  const scoreDisplayRef = useRef<HTMLSpanElement>(null)
  const ringCircleRef = useRef<SVGCircleElement>(null)
  const ringTextRef = useRef<HTMLSpanElement>(null)

  const tickRef = useRef<number | null>(null)
  const challengeTimerRef = useRef<number | null>(null)

  // challenge 模式：当前动作开始时间 / 整局开始时间
  const poseStartRef = useRef(0)
  const sessionStartRef = useRef(0)

  // rAF 异步评分
  const latestLandmarksRef = useRef<{ landmarks: any[]; time: number } | null>(null)
  const scorePendingRef = useRef(false)
  const scoreRafRef = useRef<number | null>(null)

  // challenge 达标切换防抖
  const lastSwitchRef = useRef(0)

  // follow 模式：当前帧开始时间戳（ms），驱动 FollowCoachCanvas 插值
  const followFrameStartRef = useRef(0)
  // follow 模式：倒计时 DOM 直写（避免 60fps rAF 触发 React 重渲染）
  const followCountdownDisplayRef = useRef<HTMLSpanElement>(null)
  const followProgressRef = useRef<HTMLDivElement>(null)
  // follow 模式：教练 Canvas 控制器，rAF 内部直接 advance，绕过 React state（零延迟切帧）
  const coachCanvasRef = useRef<FollowCoachCanvasHandle | null>(null)
  // follow 模式：内部帧索引 ref，热路径读写，避免 setState 抖动（33ms/帧时 16ms 延迟占比 50%）
  const followIndexRef = useRef(0)
  // follow 模式：视频驱动路径下，记录已计分的帧索引（ref 避免 rAF 闭包 stale）
  const lastScoredIdxRef = useRef(-1)
  // follow 模式：视频背景元素 ref（有视频时）
  const videoBgRef = useRef<HTMLVideoElement | null>(null)
  // follow 模式：固定播放帧率（fps），默认 3fps 跟练节奏更稳
  const FOLLOW_FPS = 3

  const currentPose = templates[currentIndex]
  const isFollow = mode === 'follow'
  const isChallenge = mode === 'challenge'
  const isRhythm = mode === 'rhythm'
  // 当前实际播放的视频 URL
  const currentVideoUrl = videoMode === 'bone' ? boneVideoUrl : videoUrl
  const hasVideoBg = isFollow && !!currentVideoUrl

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

  // ============ 倒计时阶段 ============
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      if (isRhythm) {
        setPoseCountdown(perPoseSec)
      } else if (isFollow) {
        setPoseCountdown(currentPose?.sourceDuration ?? 1)
        followFrameStartRef.current = Date.now()
        // 同步内部帧索引 ref（从 0 开始）
        followIndexRef.current = 0
        lastScoredIdxRef.current = 0
        coachCanvasRef.current?.advance(0, followFrameStartRef.current)
        // 视频背景定位到起始位置
        if (videoBgRef.current && templates[0]?.timestamp !== undefined) {
          videoBgRef.current.currentTime = templates[0].timestamp
        }
      } else if (isChallenge) {
        poseStartRef.current = Date.now()
        sessionStartRef.current = Date.now()
      }
      setCurrentBest(0)
      setPhase('playing')
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, perPoseSec, isRhythm, isFollow, isChallenge, currentPose])

  // ============ 实时评分 (rAF + DOM 直写) ============
  const handlePoseResult = useCallback(
    (_hasPerson: boolean, landmarks: any[] | null) => {
      if (phase !== 'playing' || !currentPose || !landmarks) {
        updateScoreDOM(0)
        return
      }
      latestLandmarksRef.current = { landmarks, time: Date.now() }
      if (scorePendingRef.current) return
      scorePendingRef.current = true
      scoreRafRef.current = requestAnimationFrame(() => {
        scorePendingRef.current = false
        const data = latestLandmarksRef.current
        if (!data) return
        // follow 模式：用 followIndexRef 读取最新帧（state 有延迟，会导致评分对旧帧）
        const pose = isFollow ? templates[followIndexRef.current] : currentPose
        if (!pose) return
        // 跟练模式：关键点向量余弦相似度；闯关/节拍：角度规则评分
        const match = isFollow
          ? calculateKeypointSimilarity(data.landmarks, pose, scoringMode)
          : calculatePoseMatchScore(data.landmarks, pose, scoringMode)
        updateScoreDOM(match)
        if (match > currentBest) setCurrentBest(match)

        // challenge 模式：达标即切换
        if (isChallenge) {
          const ts = Date.now()
          if (ts - lastSwitchRef.current < 500) return
          if (match >= passScore) {
            lastSwitchRef.current = ts
            const poseTime = (ts - poseStartRef.current) / 1000
            setActionTimes((prev) => [...prev, poseTime])
            setActionScores((prev) => [...prev, match])
            setCurrentIndex((idx) => {
              const next = idx + 1
              if (next >= templates.length) {
                setPhase('result')
                return idx
              }
              poseStartRef.current = Date.now()
              setCurrentBest(0)
              return next
            })
          }
        }
      })
    },
    [phase, currentPose, currentBest, scoringMode, isChallenge, isFollow, passScore, templates.length, updateScoreDOM]
  )

  // ============ tick (rhythm / follow) ============
  useEffect(() => {
    if (phase !== 'playing' || isChallenge) return

    if (isFollow) {
      // 有视频 → 视频是主时钟，自然播放；评分层按视频时间映射到对应模板
      // 无视频 → rAF 驱动固定帧率 + 骨骼插值（兜底）
      if (hasVideoBg && videoBgRef.current) {
        const video = videoBgRef.current

        // 播放视频
        video.play().catch(() => {})

        // 用 rAF 轮询视频时间，驱动评分模板定位和 UI 更新
        const tick = () => {
          const ct = video.currentTime
          const total = templates.length
          if (total === 0) {
            tickRef.current = requestAnimationFrame(tick)
            return
          }

          // 在关键帧时间轴上定位：找到最后一个 timestamp <= ct 的帧
          let idx = 0
          for (let i = 0; i < total; i++) {
            if ((templates[i].timestamp ?? 0) <= ct) {
              idx = i
            } else {
              break
            }
          }
          idx = Math.min(idx, total - 1)

          // 同步内部帧索引给评分层
          followIndexRef.current = idx
          if (lastScoredIdxRef.current !== idx) {
            // 帧切换：记录前一帧的最后瞬间分
            const prevScore = scoreRef.current
            setActionScores((prev) => [...prev, prevScore])
            lastScoredIdxRef.current = idx
            setCurrentIndex(idx)
            setCurrentBest(0)
            // 同步骨骼图 Canvas（视频驱动路径下 advance 未被调用，需手动触发）
            coachCanvasRef.current?.advance(idx, Date.now())
          }

          const firstTs = templates[0]?.timestamp ?? 0
          const lastTs = templates[total - 1]?.timestamp ?? 0
          const totalRemain = Math.max(0, lastTs - ct)

          // DOM 直写倒计时
          if (followCountdownDisplayRef.current) {
            followCountdownDisplayRef.current.textContent = `${totalRemain.toFixed(1)}s`
            followCountdownDisplayRef.current.style.color = totalRemain <= 1 ? '#f87171' : '#ffffff'
          }
          // DOM 直写整体进度条
          if (followProgressRef.current) {
            const overallPct = lastTs > firstTs
              ? ((ct - firstTs) / (lastTs - firstTs)) * 100
              : 0
            followProgressRef.current.style.width = `${Math.max(0, Math.min(100, overallPct))}%`
          }

          tickRef.current = requestAnimationFrame(tick)
        }
        tickRef.current = requestAnimationFrame(tick)

        // 视频结束 → 课程完成
        const onEnded = () => {
          // 记录最后一帧的分数
          const finalScore = scoreRef.current
          setActionScores((prev) => {
            // 如果帧切换已记录了部分分数，只需补最后一帧
            if (prev.length < templates.length) {
              return [...prev, finalScore]
            }
            return prev
          })
          setPhase('result')
        }
        video.addEventListener('ended', onEnded)

        return () => {
          if (tickRef.current) cancelAnimationFrame(tickRef.current)
          video.removeEventListener('ended', onEnded)
          video.pause()
        }
      }

      // ========== 无视频：rAF 驱动固定帧率 + 骨骼插值（兜底） ==========
      const tick = () => {
        const idx = followIndexRef.current
        const pose = templates[idx]
        if (!pose) {
          tickRef.current = requestAnimationFrame(tick)
          return
        }
        const frameDuration = 1 / FOLLOW_FPS
        const now = Date.now()
        const elapsed = (now - followFrameStartRef.current) / 1000
        const remaining = Math.max(0, frameDuration - elapsed)

        // DOM 直写倒计时
        if (followCountdownDisplayRef.current) {
          followCountdownDisplayRef.current.textContent = `${remaining.toFixed(1)}s`
          followCountdownDisplayRef.current.style.color = remaining <= 1 ? '#f87171' : '#ffffff'
        }
        // DOM 直写进度条
        if (followProgressRef.current) {
          const pct = Math.min(100, (elapsed / frameDuration) * 100)
          followProgressRef.current.style.width = `${pct}%`
        }

        // 检查是否该切换帧
        if (elapsed >= frameDuration) {
          // 帧结束，取最后瞬间分
          const finalScore = scoreRef.current
          setActionScores((prevScores) => [...prevScores, finalScore])

          const nextIdx = idx + 1
          if (nextIdx >= templates.length) {
            // 全部完成
            setPhase('result')
            return
          }
          // ref 直切 + Canvas 零延迟通知
          followIndexRef.current = nextIdx
          const newStart = Date.now()
          followFrameStartRef.current = newStart
          coachCanvasRef.current?.advance(nextIdx, newStart)
          setCurrentIndex(nextIdx)
          setCurrentBest(0)
          tickRef.current = requestAnimationFrame(tick)
          return
        }

        tickRef.current = requestAnimationFrame(tick)
      }
      tickRef.current = requestAnimationFrame(tick)
      return () => {
        if (tickRef.current) cancelAnimationFrame(tickRef.current)
      }
    } else {
      // rhythm: 1s 倒计时，时间到取最后瞬间分
      tickRef.current = window.setInterval(() => {
        setPoseCountdown((prev) => {
          if (prev <= 1) {
            const finalScore = scoreRef.current
            setActionScores((prevScores) => [...prevScores, finalScore])
            setCurrentIndex((idx) => {
              const next = idx + 1
              if (next >= templates.length) {
                setPhase('result')
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
    }

    return () => {
      if (tickRef.current) {
        if (isFollow) {
          cancelAnimationFrame(tickRef.current)
        } else {
          window.clearInterval(tickRef.current)
        }
      }
    }
  }, [phase, isChallenge, isFollow, isRhythm, perPoseSec, templates.length])

  // ============ challenge 计时器 ============
  useEffect(() => {
    if (phase !== 'playing' || !isChallenge) return
    challengeTimerRef.current = window.setInterval(() => {
      const sec = (Date.now() - sessionStartRef.current) / 1000
      setElapsed(sec)
      // 关卡总时限到 → 自动结束（未完成动作记 0 分）
      if (timeLimit && sec >= timeLimit) {
        setActionScores((prev) => {
          const remain = templates.length - prev.length
          return remain > 0 ? [...prev, ...Array(remain).fill(0)] : prev
        })
        setActionTimes((prev) => {
          const remain = templates.length - prev.length
          return remain > 0 ? [...prev, ...Array(remain).fill(timeLimit)] : prev
        })
        setPhase('result')
      }
    }, 100)
    return () => {
      if (challengeTimerRef.current) window.clearInterval(challengeTimerRef.current)
    }
  }, [phase, isChallenge, timeLimit, templates.length])

  // ============ challenge 单动作超时保护 ============
  useEffect(() => {
    if (phase !== 'playing' || !isChallenge) return
    const poseElapsed = (Date.now() - poseStartRef.current) / 1000
    if (poseElapsed >= CHALLENGE_POSE_TIMEOUT) {
      setActionScores((prev) => [...prev, 0])
      setActionTimes((prev) => [...prev, CHALLENGE_POSE_TIMEOUT])
      setCurrentIndex((idx) => {
        const next = idx + 1
        if (next >= templates.length) {
          setPhase('result')
          return idx
        }
        poseStartRef.current = Date.now()
        setCurrentBest(0)
        return next
      })
    }
  }, [elapsed, phase, isChallenge])

  // ============ 记录最后一个动作分数（rhythm/follow 防漏记） ============
  useEffect(() => {
    if (phase === 'result' && !isChallenge && templates.length > actionScores.length) {
      setActionScores((prev) => [...prev, scoreRef.current])
    }
  }, [phase, templates.length, actionScores.length, isChallenge])

  // 清理 rAF
  useEffect(() => {
    return () => {
      if (scoreRafRef.current) cancelAnimationFrame(scoreRafRef.current)
    }
  }, [])

  // ESC 退出
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onExit) onExit()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onExit])

  // ============ 统计 ============
  const averageScore =
    actionScores.length > 0
      ? Math.round(actionScores.reduce((a, b) => a + b, 0) / actionScores.length)
      : 0
  const totalDuration = isChallenge
    ? Math.round(actionTimes.reduce((a, b) => a + b, 0))
    : isFollow
      ? Math.round(templates.reduce((sum, t) => sum + (t.sourceDuration ?? 0), 0))
      : templates.length * perPoseSec

  // ============ 提交分数 ============
  const handleSubmitScore = async () => {
    if (!isLoggedIn || !user || uploaded) return
    setUploading(true)
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          nickname: user.nickname,
          template_name: levelName,
          score: averageScore,
          max_combo: 0,
          accuracy: averageScore,
          duration: totalDuration,
          game_mode: mode,
        }),
      })
      setUploaded(true)
    } catch (e) {
      console.error('提交分数失败', e)
    } finally {
      setUploading(false)
    }
  }

  const handleExit = () => {
    if (onExit) onExit()
    else navigate(-1)
  }

  // 重置游戏状态（代替 window.location.reload()，避免丢失 location.state 中的视频URL）
  const handleRestart = useCallback(() => {
    setPhase('countdown')
    setCountdown(3)
    setCurrentIndex(0)
    setActionScores([])
    setActionTimes([])
    setCurrentBest(0)
    setElapsed(0)
    setPoseCountdown(0)
    setUploaded(false)
    scoreRef.current = 0
    updateScoreDOM(0)
    followIndexRef.current = 0
    lastScoredIdxRef.current = -1
    followFrameStartRef.current = 0
    lastSwitchRef.current = 0
    poseStartRef.current = 0
    sessionStartRef.current = 0
    // 重置视频：暂停并回到起始位置
    if (videoBgRef.current) {
      videoBgRef.current.pause()
      videoBgRef.current.currentTime = templates[0]?.timestamp ?? 0
    }
    // 跟练模式默认切回原视频
    if (videoUrl) {
      setVideoMode('original')
    }
  }, [updateScoreDOM, videoUrl, templates])

  // ============ 倒计时 UI ============
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <FloatingNav />
        <main className="pt-20 flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 mb-2">{levelName}</p>
            <div className="text-9xl font-bold bg-gradient-to-b from-white to-transparent bg-clip-text text-transparent animate-pulse">
              {countdown > 0 ? countdown : '开始'}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ============ 结果页 ============
  if (phase === 'result') {
    const success = isChallenge ? actionScores.every((s) => s >= passScore) : true
    return (
      <div className="min-h-screen text-white">
        <FloatingNav />
        <main className="pt-20 pb-12 px-4 flex items-center justify-center min-h-[80vh]">
          <div className="text-center max-w-md w-full">
            <div className="text-7xl mb-4">
              {isChallenge ? (success ? '🏆' : '💪') : averageScore >= 80 ? '🏆' : averageScore >= 60 ? '🎉' : '💪'}
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {isChallenge ? (success ? '闯关成功！' : '闯关结束') : '练习完成！'}
            </h2>
            <p className="text-white/60 mb-6">{levelName}</p>
            <div className="glass rounded-2xl p-6 mb-6 space-y-3">
              {isChallenge ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/60">总耗时</span>
                    <span className="text-2xl font-bold text-cyan-400">{totalDuration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">平均达标分</span>
                    <span className="text-xl font-bold text-yellow-400">{averageScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">完成动作</span>
                    <span className="text-lg">{actionScores.filter((s) => s >= passScore).length} / {templates.length}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/60">平均分</span>
                    <span className="text-2xl font-bold text-yellow-400">{averageScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">总时长</span>
                    <span className="text-lg">{totalDuration}s</span>
                  </div>
                </>
              )}
            </div>

            {/* 各动作详情 */}
            <div className="glass rounded-2xl p-4 mb-6 max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {templates.slice(0, actionScores.length).map((t, i) => (
                  <div key={`${t.id}-${i}`} className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
                    <PoseFigure template={t} size={36} />
                    <span className="flex-1 text-sm truncate">{t.name}</span>
                    {isChallenge && (
                      <span className="text-xs text-cyan-400 font-mono">{actionTimes[i]?.toFixed(1)}s</span>
                    )}
                    <span
                      className={cn(
                        'font-bold w-10 text-right text-sm',
                        actionScores[i] >= 80 ? 'text-green-400' : actionScores[i] >= 60 ? 'text-yellow-400' : 'text-red-400'
                      )}
                    >
                      {actionScores[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {isLoggedIn && !uploaded && (
                <button
                  onClick={handleSubmitScore}
                  disabled={uploading}
                  className={cn(
                    'w-full px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                    uploading
                      ? 'bg-white/20 text-white/60 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:shadow-lg'
                  )}
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Trophy size={20} />
                  )}
                  {uploading ? '上传中...' : '上传到排行榜'}
                </button>
              )}
              {uploaded && (
                <div className="w-full px-6 py-4 bg-green-500/20 border border-green-500/50 rounded-xl font-bold flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle size={20} /> 已上传到排行榜
                </div>
              )}
              {!isLoggedIn && (
                <button
                  onClick={() => document.getElementById('nav-login-btn')?.click()}
                  className="w-full px-6 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold flex items-center justify-center gap-2 text-white/70"
                >
                  <Upload size={20} /> 登录后上传成绩
                </button>
              )}
              <button
                onClick={handleRestart}
                className="w-full px-6 py-4 bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} /> 再来一次
              </button>
              <button onClick={handleExit} className="w-full px-6 py-4 text-white/60 hover:text-white">
                返回
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ============ 游戏进行中 ============
  if (!currentPose) return null

  const currentDuration = isFollow ? currentPose.sourceDuration ?? 1 : perPoseSec
  const progress = isFollow
    ? ((currentDuration - poseCountdown) / currentDuration) * 100
    : isRhythm
      ? ((perPoseSec - poseCountdown) / perPoseSec) * 100
      : 0

  return (
    <div className="min-h-screen text-white">
      <main className="pt-6 pb-6 px-4">
        <div className="mx-auto">
          {/* 顶部栏 */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={handleExit} className="flex items-center gap-2 text-white/70 hover:text-white">
              <ArrowLeft size={20} />
              <span>退出</span>
            </button>
            <div className="text-center">
              <div className="text-xs text-white/50">{levelName}</div>
              <div className="text-sm font-medium">
                动作 {currentIndex + 1} / {templates.length}
              </div>
            </div>
            <div className="text-sm">
              {isChallenge && (
                <span className="text-cyan-400 font-mono font-bold">{elapsed.toFixed(1)}s</span>
              )}
              {isRhythm && (
                <span className="text-white/60">
                  最佳: <span className="text-green-400 font-bold">{currentBest}</span>
                </span>
              )}
              {isFollow && (
                <span className="text-white/60">
                  帧 {currentIndex + 1}/{templates.length}
                  {currentPose.timestamp !== undefined && ` · ${currentPose.timestamp.toFixed(1)}s`}
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
                  {(templates.reduce((s, t) => s + (t.sourceDuration ?? 0), 0)).toFixed(1)}s
                </span>
              </div>
              {/* 帧时间轴：每个帧一个小方块，当前帧高亮 */}
              <div className="flex gap-0.5 items-center">
                {templates.map((t, i) => {
                  const dur = t.sourceDuration ?? 1
                  // 按时长占比分配宽度（最小 8px 保证可见）
                  const widthPercent = (dur / templates.reduce((s, x) => s + (x.sourceDuration ?? 0), 0)) * 100
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
                      title={`帧 ${i + 1} · ${t.timestamp?.toFixed(1)}s · ${dur.toFixed(1)}s`}
                    />
                  )
                })}
              </div>
              {/* 帧索引标尺 */}
              <div className="flex justify-between mt-1 text-[10px] text-white/40 font-mono">
                <span>帧 {currentIndex + 1} / {templates.length}</span>
                <span>
                  下一帧 {currentIndex + 2 <= templates.length ? `· ${templates[currentIndex + 1]?.timestamp?.toFixed(1) ?? '--'}s` : '(结束)'}
                </span>
              </div>
            </div>
          )}

          {/* ============ 跟练模式：左右分屏大布局 ============ */}
          {isFollow ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-230px)]">
              {/* 左侧：用户摄像头（全屏） */}
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
                      <span ref={ringTextRef} className="text-sm font-bold" style={{ color: '#ef4444' }}>
                        0%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">实时分数</div>
                    <span ref={scoreDisplayRef} className="text-2xl font-bold block leading-none" style={{ color: '#ffffff' }}>
                      0
                    </span>
                  </div>
                </div>
                {/* 右下角：本帧倒计时（rAF DOM 直写，不触发重渲染） */}
                <div className="absolute bottom-3 right-3 z-20 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm text-center">
                  <div className="text-[10px] text-white/50 mb-0.5">本帧倒计时</div>
                  <span
                    ref={followCountdownDisplayRef}
                    className="text-2xl font-bold font-mono"
                    style={{ color: '#ffffff' }}
                  >
                    {(currentPose?.sourceDuration ?? 1).toFixed(1)}s
                  </span>
                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                    <div
                      ref={followProgressRef}
                      className="h-full rounded-full"
                      style={{
                        width: '0%',
                        background: 'linear-gradient(to right, #10b981, #06b6d4)',
                      }}
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

              {/* 右侧：教练示范（大尺寸全身绿色骨骼，rAF 插值动画） */}
              <div className="relative glass rounded-2xl overflow-hidden flex flex-col">
                {/* 顶部标签栏 */}
                <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
                  <div className="px-3 py-1 rounded-full bg-emerald-500/30 backdrop-blur-sm text-xs font-medium text-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                    教练示范
                  </div>
                  {currentIndex + 1 < templates.length && (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                      <span className="text-[10px] text-white/50">下一帧</span>
                      <div className="w-8 h-8 flex items-center justify-center bg-black/40 rounded">
                        <PoseFigure template={templates[currentIndex + 1]} size={28} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 动作名称 + 时间戳 */}
                <div className="relative z-10 pt-16 pb-2 text-center">
                  <h2 className="text-2xl font-bold mb-0.5">{currentPose.name}</h2>
                  {currentPose.timestamp !== undefined && (
                    <p className="text-cyan-400/70 text-xs font-mono">
                      ⏱ {currentPose.timestamp.toFixed(1)}s · 持续 {currentPose.sourceDuration?.toFixed(1)}s
                    </p>
                  )}
                </div>

                {/* 大尺寸教练视频 / 骨骼叠加 */}
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
                      templates={templates}
                      currentIndex={currentIndex}
                      size={480}
                      scoringMode={scoringMode}
                      highlight={currentBest >= 60}
                      mirrored={mirrored}
                      frameStartMs={followFrameStartRef.current}
                      frameDuration={1 / FOLLOW_FPS}
                      coachMode
                    />
                  )}
                  {/* 视频模式切换按钮 */}
                  {hasBothVideos && (
                    <button
                      onClick={() => setVideoMode(v => v === 'bone' ? 'original' : 'bone')}
                      className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg backdrop-blur-sm border border-white/10 transition-colors"
                    >
                      {videoMode === 'bone' ? '切换原视频' : '切换骨骼'}
                    </button>
                  )}
                  {/* 有视频时，小骨骼图作为参考显示在右下角（仅原视频模式下显示） */}
                  {hasVideoBg && videoMode === 'original' && (
                    <div className="absolute bottom-4 right-4 w-32 h-32 bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 z-10">
                      <FollowCoachCanvas
                        ref={coachCanvasRef}
                        templates={templates}
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

                {/* 底部控制栏 */}
                <div className="relative z-10 p-4 flex items-center justify-center gap-2 flex-wrap">
                  {(Object.keys(SCORING_MODES) as ScoringMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setScoringMode(m)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
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
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        displayMode === m ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      )}
                    >
                      {m === 'overlay' ? '叠加' : m === 'drawing' ? '骨架' : '原图'}
                    </button>
                  ))}
                  <button
                    onClick={() => setMirrored((v) => !v)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1',
                      mirrored ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    )}
                  >
                    <FlipHorizontal size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
          /* ============ 闯关/节拍模式：原有布局 ============ */
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

            {/* 右侧：仪表盘 */}
            <div className="lg:col-span-2 relative glass rounded-2xl overflow-hidden flex flex-col">
              {/* 目标骨骼图 */}
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
                    <svg width={160} height={160} className="transform -rotate-90">
                      <circle cx={80} cy={80} r={74} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={12} />
                      <circle
                        ref={ringCircleRef}
                        cx={80}
                        cy={80}
                        r={74}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={12}
                        strokeLinecap="round"
                        strokeDasharray={74 * 2 * Math.PI}
                        strokeDashoffset={74 * 2 * Math.PI}
                        style={{ transition: 'stroke-dashoffset 0.1s ease-out, stroke 0.1s' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span ref={ringTextRef} className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                        0%
                      </span>
                    </div>
                  </div>
                  <p className="text-white/50 text-sm mt-3">匹配度</p>
                  <span ref={scoreDisplayRef} className="text-4xl font-bold mt-1 block" style={{ color: '#ffffff' }}>
                    0
                  </span>
                </div>
              </div>

              {/* 下部：数据面板 */}
              <div className="relative z-10 p-6 space-y-4">
                {/* 倒计时/计时 */}
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-xs">
                      {isChallenge ? '已用时间' : '动作倒计时'}
                    </span>
                    <span
                      className={cn(
                        'text-xl font-bold font-mono',
                        isChallenge ? 'text-cyan-400' : poseCountdown <= 3 && 'text-red-400 animate-pulse'
                      )}
                    >
                      {isChallenge
                        ? `${elapsed.toFixed(1)}s`
                        : `${Math.ceil(poseCountdown)}s`}
                    </span>
                  </div>
                  {!isChallenge && (
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
                  )}
                  {isChallenge && (
                    <div className="text-xs text-white/50 mt-1">
                      达标线 {passScore} 分 · 达标即切换下一个
                    </div>
                  )}
                </div>

                {/* 评分模式 */}
                <div className="glass rounded-xl p-3">
                  <div className="text-white/60 text-xs mb-2">评分范围</div>
                  <div className="flex gap-1">
                    {(Object.keys(SCORING_MODES) as ScoringMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setScoringMode(m)}
                        className={cn(
                          'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                          scoringMode === m ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                        )}
                      >
                        <span className="mr-1">{SCORING_MODES[m].icon}</span>
                        {SCORING_MODES[m].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="flex gap-2">
                  {(['overlay', 'drawing', 'original'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setDisplayMode(m)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        displayMode === m ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      )}
                    >
                      {m === 'overlay' ? '叠加' : m === 'drawing' ? '骨架' : '原图'}
                    </button>
                  ))}
                  <button
                    onClick={() => setMirrored((v) => !v)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1',
                      mirrored ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    )}
                  >
                    <FlipHorizontal size={14} />
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
