import { memo, useEffect, useRef, useState, useCallback } from 'react'
import type { PoseTemplate, ScoringMode } from '@/utils/poseMatcher'
import { cn } from '@/lib/utils'

interface PoseFigureProps {
  template: PoseTemplate
  size?: number
  /** 自动适配父容器尺寸，忽略 size prop */
  autoSize?: boolean
  className?: string
  highlight?: boolean
  scoringMode?: ScoringMode
  /** 是否镜像显示（与摄像头镜像视角一致，便于用户直接模仿）。默认 true */
  mirrored?: boolean
}

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

export default memo(function PoseFigure({
  template,
  size = 120,
  autoSize = false,
  className,
  highlight = false,
  scoringMode = 'minimal',
  mirrored = true,
}: PoseFigureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [computedSize, setComputedSize] = useState(size)

  // ResizeObserver 自动适配容器尺寸
  useEffect(() => {
    if (!autoSize) return
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        // 取宽高较小值，保持正方形
        const s = Math.floor(Math.min(width, height))
        if (s > 0) setComputedSize(s)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [autoSize])

  const effectiveSize = autoSize ? computedSize : size

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const s = effectiveSize
    const dpr = window.devicePixelRatio || 1
    canvas.width = s * dpr
    canvas.height = s * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, s, s)

    const landmarks = template.landmarks || []
    if (landmarks.length === 0) return

    const activeSet = new Set(scoringPointIds[scoringMode])

    const activeLineColor = highlight ? '#f0abfc' : '#00FF00'
    const activePointColor = highlight ? '#f5d0fe' : '#FF0000'
    const dimLineColor = highlight ? '#6b21a8' : '#1a4731'
    const dimPointColor = highlight ? '#86198f' : '#166534'

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // 镜像绘制：与摄像头镜像视角一致，用户看模板 = 看镜子里的教练
    ctx.save()
    if (mirrored) {
      ctx.scale(-1, 1)
      ctx.translate(-s, 0)
    }

    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = landmarks[a]
      const pb = landmarks[b]
      if (!pa || !pb) continue
      const isActive = activeSet.has(a) || activeSet.has(b)
      ctx.strokeStyle = isActive ? activeLineColor : dimLineColor
      ctx.lineWidth = isActive ? 2.5 : 1.5
      ctx.globalAlpha = isActive ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(pa.x * s, pa.y * s)
      ctx.lineTo(pb.x * s, pb.y * s)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i]
      if (!lm) continue
      const isActive = activeSet.has(i)
      ctx.fillStyle = isActive ? activePointColor : dimPointColor
      ctx.globalAlpha = isActive ? 1 : 0.4
      const r = isActive ? 3 : 2
      ctx.beginPath()
      ctx.arc(lm.x * s, lm.y * s, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
    for (const idx of activeSet) {
      const lm = landmarks[idx]
      if (!lm) continue
      ctx.fillStyle = activeLineColor
      ctx.beginPath()
      ctx.arc(lm.x * s, lm.y * s, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }, [template, effectiveSize, highlight, scoringMode, mirrored])

  if (autoSize) {
    return (
      <div ref={containerRef} className={cn('w-full h-full flex items-center justify-center', className)}>
        <canvas
          ref={canvasRef}
          width={effectiveSize}
          height={effectiveSize}
          className="select-none"
          style={{ width: effectiveSize, height: effectiveSize }}
          aria-label={template.name}
        />
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={effectiveSize}
      height={effectiveSize}
      className={cn('select-none', className)}
      style={{ width: effectiveSize, height: effectiveSize }}
      aria-label={template.name}
    />
  )
})
