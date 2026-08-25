import { memo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { PoseTemplate, ScoringMode } from '@/utils/poseMatcher'

interface FollowCoachCanvasProps {
  templates: PoseTemplate[]
  currentIndex: number
  size?: number
  scoringMode?: ScoringMode
  highlight?: boolean
  mirrored?: boolean
  /** 帧开始时间戳（ms），用于计算插值进度；不传则内部跟踪 currentIndex 变化 */
  frameStartMs?: number
  /** 单帧持续时间（秒），覆盖 sourceDuration；不传则用模板的 sourceDuration */
  frameDuration?: number
  /** 教练模式：全身骨骼高亮绿色，评分关节用红点重点标记 */
  coachMode?: boolean
}

/**
 * 帧控制器：PlayEngine 的 rAF 通过此 ref 直接驱动 Canvas 切帧，零延迟
 * 绕过 React state → 重渲染 → useEffect 链路，对 30fps（33ms/帧）至关重要
 */
export interface FollowCoachCanvasHandle {
  /** 直接推进到新帧，并重置帧开始时间戳（ms） */
  advance: (newIndex: number, frameStartMs: number) => void
}

// 骨骼连接线（与 PoseFigure 一致）
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
  [0, 11], [0, 12],
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
]

const scoringPointIds: Record<ScoringMode, number[]> = {
  minimal: [11, 12],
  upper: [11, 12, 13, 14, 15, 16],
  full: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
}

/**
 * 跟练模式专属：rAF 驱动的插值骨骼图
 * 在两个关键帧之间按时间进度线性插值 33 个 landmarks，60fps 平滑过渡
 * 不触发 React 重渲染，直接操作 canvas
 *
 * 关键：帧切换通过 controllerRef.advance() 直接驱动，绕过 React state
 * 去除 easeInOut 缓动，使用线性插值，避免快速动作被"拉平"成平滑曲线
 */
const FollowCoachCanvas = forwardRef<FollowCoachCanvasHandle, FollowCoachCanvasProps>(function FollowCoachCanvas({
  templates,
  currentIndex,
  size = 340,
  scoringMode = 'minimal',
  highlight = false,
  mirrored = true,
  frameStartMs,
  frameDuration,
  coachMode = false,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  // 内部跟踪帧开始时间（仅初始化和 controllerRef.advance 时重置）
  const internalFrameStartRef = useRef<number>(frameStartMs ?? Date.now())
  const currentIndexRef = useRef<number>(currentIndex)
  const highlightRef = useRef<boolean>(highlight)
  const templatesRef = useRef<PoseTemplate[]>(templates)
  const scoringModeRef = useRef<ScoringMode>(scoringMode)
  const mirroredRef = useRef<boolean>(mirrored)
  const coachModeRef = useRef<boolean>(coachMode)
  const frameDurationRef = useRef<number | undefined>(frameDuration)

  // 同步 ref（非关键路径，不影响热路径）
  useEffect(() => { highlightRef.current = highlight }, [highlight])
  useEffect(() => { templatesRef.current = templates }, [templates])
  useEffect(() => { scoringModeRef.current = scoringMode }, [scoringMode])
  useEffect(() => { mirroredRef.current = mirrored }, [mirrored])
  useEffect(() => { coachModeRef.current = coachMode }, [coachMode])
  useEffect(() => { frameDurationRef.current = frameDuration }, [frameDuration])

  // 仅在首次挂载或外部主动 reset 时同步 currentIndex（如重新开始）
  // 切帧热路径不再走这里，由 controllerRef.advance 直接更新
  useEffect(() => {
    currentIndexRef.current = currentIndex
    internalFrameStartRef.current = frameStartMs ?? Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 仅挂载时初始化

  // 暴露 advance 接口给 PlayEngine 的 rAF 调用，零延迟切帧
  useImperativeHandle(ref, () => ({
    advance: (newIndex: number, frameStartMs: number) => {
      currentIndexRef.current = newIndex
      internalFrameStartRef.current = frameStartMs
    },
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const draw = () => {
      const idx = currentIndexRef.current
      const tpls = templatesRef.current
      const current = tpls[idx]
      const next = tpls[idx + 1]
      if (!current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // frameDuration 优先（外部固定帧率控制），否则回退到 sourceDuration
      const duration = Math.max(0.016, frameDurationRef.current ?? current.sourceDuration ?? 1)
      const elapsed = (Date.now() - internalFrameStartRef.current) / 1000
      // clamp 到 [0, 1]，线性插值（不再 easeInOut，避免快速动作被拉平）
      const t = Math.min(Math.max(elapsed / duration, 0), 1)

      // 插值 landmarks
      const currentLm = current.landmarks || []
      const nextLm = next?.landmarks || currentLm
      const interpolated = currentLm.map((lm, i) => {
        const nl = nextLm[i]
        if (!nl) return lm
        return {
          x: lm.x * (1 - t) + nl.x * t,
          y: lm.y * (1 - t) + nl.y * t,
          z: (lm.z ?? 0) * (1 - t) + (nl.z ?? 0) * t,
        }
      })

      // ===== 绘制 =====
      ctx.clearRect(0, 0, size, size)

      const sm = scoringModeRef.current
      const activeSet = new Set(scoringPointIds[sm])
      const isHighlight = highlightRef.current
      const isCoach = coachModeRef.current
      const isMirrored = mirroredRef.current

      // 教练模式：全身亮绿色骨骼，评分关节红色重点标记
      // 标准模式：复用 PoseFigure 逻辑（评分点亮色，非评分点暗色）
      let lineColor: string, lineWidth: number, lineAlpha: number
      let pointColor: string, pointRadius: number, pointAlpha: number
      let scorePointColor: string, scorePointRadius: number

      if (isCoach) {
        // 教练模式：全身统一亮绿色，粗线条
        lineColor = '#22c55e'
        lineWidth = 4
        lineAlpha = 0.9
        pointColor = '#22c55e'
        pointRadius = 3
        pointAlpha = 0.8
        scorePointColor = '#ef4444'
        scorePointRadius = 6
      } else {
        lineColor = isHighlight ? '#f0abfc' : '#00FF00'
        lineWidth = 2.5
        lineAlpha = 1
        pointColor = isHighlight ? '#f5d0fe' : '#FF0000'
        pointRadius = 3
        pointAlpha = 1
        scorePointColor = isHighlight ? '#f0abfc' : '#00FF00'
        scorePointRadius = 3.5
      }

      const dimLineColor = isHighlight ? '#6b21a8' : '#1a4731'
      const dimPointColor = isHighlight ? '#86198f' : '#166534'

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.save()
      if (isMirrored) {
        ctx.scale(-1, 1)
        ctx.translate(-size, 0)
      }

      // 连接线
      for (const [a, b] of POSE_CONNECTIONS) {
        const pa = interpolated[a]
        const pb = interpolated[b]
        if (!pa || !pb) continue
        const isActive = activeSet.has(a) || activeSet.has(b)
        if (isCoach) {
          // 教练模式：所有连线统一亮绿色
          ctx.strokeStyle = lineColor
          ctx.lineWidth = lineWidth
          ctx.globalAlpha = lineAlpha
        } else {
          ctx.strokeStyle = isActive ? lineColor : dimLineColor
          ctx.lineWidth = isActive ? lineWidth : 1.5
          ctx.globalAlpha = isActive ? lineAlpha : 0.5
        }
        ctx.beginPath()
        ctx.moveTo(pa.x * size, pa.y * size)
        ctx.lineTo(pb.x * size, pb.y * size)
        ctx.stroke()
      }

      // 所有关键点
      ctx.globalAlpha = 1
      for (let i = 0; i < interpolated.length; i++) {
        const lm = interpolated[i]
        if (!lm) continue
        const isActive = activeSet.has(i)
        if (isCoach) {
          ctx.fillStyle = pointColor
          ctx.globalAlpha = pointAlpha
          ctx.beginPath()
          ctx.arc(lm.x * size, lm.y * size, pointRadius, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = isActive ? pointColor : dimPointColor
          ctx.globalAlpha = isActive ? pointAlpha : 0.4
          ctx.beginPath()
          ctx.arc(lm.x * size, lm.y * size, isActive ? pointRadius : 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 评分关节重点标记
      ctx.globalAlpha = 1
      for (const idx2 of activeSet) {
        const lm = interpolated[idx2]
        if (!lm) continue
        if (isCoach) {
          // 教练模式：红色大圆点 + 外圈光晕
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'
          ctx.beginPath()
          ctx.arc(lm.x * size, lm.y * size, scorePointRadius + 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = scorePointColor
          ctx.beginPath()
          ctx.arc(lm.x * size, lm.y * size, scorePointRadius, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = scorePointColor
          ctx.beginPath()
          ctx.arc(lm.x * size, lm.y * size, scorePointRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      aria-label="教练示范"
    />
  )
})

export default memo(FollowCoachCanvas)
